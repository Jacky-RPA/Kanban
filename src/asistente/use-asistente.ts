import { format } from "date-fns"
import { es } from "date-fns/locale"
import { create } from "zustand"
import { useTareas } from "@/hooks/use-tareas"
import { hoyISO } from "@/lib/fechas"
import type { Tarea } from "@/types/tarea"
import { enviarConversacion } from "./api"
import {
  ESCRITURA, ErrorHerramienta, ErrorLote, LECTURA, ejecutarPropuesta, prepararSeleccion, tareaParaModelo, type OperacionesTareas,
} from "./herramientas"
import type { BloqueContenido, ElementoChat, LlamadaHerramienta, MensajeApi, ResultadoHerramienta } from "./tipos"

// Estado de la conversación. Vive en un store (y no en el componente) para que el chat
// se conserve al cerrar el panel o al ir al detalle de una tarea y volver.
type EstadoAsistente = {
  abierto: boolean
  elementos: ElementoChat[] // lo que se ve en el chat
  historial: MensajeApi[] // lo que se envía al LLM
  // Llamadas del turno actual: el orden original y los resultados que ya se tienen
  turno: { orden: string[]; resultados: Record<string, ResultadoHerramienta> } | null
  cargando: boolean
  sesion: number // cambia con cada conversación nueva para descartar respuestas de la anterior
}

const ESTADO_INICIAL = { elementos: [], historial: [], turno: null, cargando: false }

const useStore = create<EstadoAsistente>(() => ({ abierto: false, sesion: 0, ...ESTADO_INICIAL }))

const { getState: leer, setState: escribir } = useStore

// ---------- utilidades ----------

const hora = () => format(new Date(), "HH:mm")
const nuevoId = () => crypto.randomUUID()

const agregar = (elemento: ElementoChat) => escribir((s) => ({ elementos: [...s.elementos, elemento] }))

const actualizarElemento = (id: string, cambios: Partial<ElementoChat>) =>
  escribir((s) => ({ elementos: s.elementos.map((e) => (e.id === id ? ({ ...e, ...cambios } as ElementoChat) : e)) }))

const contexto = () => ({
  fecha: hoyISO(),
  diaSemana: format(new Date(), "EEEE", { locale: es }),
  zonaHoraria: Intl.DateTimeFormat().resolvedOptions().timeZone,
})

const textoDe = (m: MensajeApi) =>
  typeof m.content === "string"
    ? m.content
    : m.content.filter((b: BloqueContenido) => b.type === "text" && b.text).map((b) => b.text).join("\n\n")

const resultado = (llamadaId: string, contenido: unknown, esError = false): ResultadoHerramienta => ({
  type: "tool_result",
  tool_use_id: llamadaId,
  content: typeof contenido === "string" ? contenido : JSON.stringify(contenido),
  ...(esError && { is_error: true }),
})

const mensajeError = (e: unknown) => (e instanceof Error ? e.message : "Error inesperado")

// ---------- hook ----------

export function useAsistente() {
  const estado = useStore()
  const { crearTarea, actualizarTarea, consultarTareasActuales } = useTareas()
  const ops: OperacionesTareas = { crearTarea, actualizarTarea }

  // Envía el historial al backend y procesa la respuesta (texto y/o herramientas)
  async function consultarLLM() {
    const sesion = leer().sesion
    escribir({ cargando: true })
    try {
      const r = await enviarConversacion(leer().historial, contexto())
      if (leer().sesion !== sesion) return // el usuario empezó otra conversación mientras tanto
      escribir((s) => ({ historial: [...s.historial, ...r.nuevosMensajes] }))
      for (const m of r.nuevosMensajes) {
        const texto = m.role === "assistant" ? textoDe(m).trim() : ""
        if (texto) agregar({ id: nuevoId(), hora: hora(), tipo: "asistente", texto })
      }
      if (r.aviso) agregar({ id: nuevoId(), hora: hora(), tipo: "asistente", texto: r.aviso })
      if (r.llamadas.length) await procesarLlamadas(r.llamadas)
    } catch (e) {
      if (leer().sesion === sesion) agregar({ id: nuevoId(), hora: hora(), tipo: "error", texto: mensajeError(e), reintentable: true })
    } finally {
      if (leer().sesion === sesion) escribir({ cargando: false })
    }
  }

  // Ejecuta las herramientas pedidas. Las que necesitan al usuario quedan pendientes;
  // cuando todas tienen resultado se devuelven juntas al LLM.
  async function procesarLlamadas(llamadas: LlamadaHerramienta[]) {
    escribir({ turno: { orden: llamadas.map((l) => l.id), resultados: {} } })

    let tareas: Tarea[]
    try {
      tareas = await consultarTareasActuales() // datos reales y actuales, no la caché
    } catch (e) {
      for (const l of llamadas) await resolver(l.id, resultado(l.id, `No se pudieron leer las tareas: ${mensajeError(e)}`, true))
      return
    }

    for (const l of llamadas) {
      try {
        if (l.modo === "lectura") {
          const ejecutor = LECTURA[l.nombre]
          if (!ejecutor) throw new ErrorHerramienta(`Herramienta desconocida: ${l.nombre}`)
          await resolver(l.id, resultado(l.id, ejecutor(l.argumentos, tareas)))
        } else if (l.modo === "confirmacion" || l.modo === "directa") {
          const preparar = ESCRITURA[l.nombre]
          if (!preparar) throw new ErrorHerramienta(`Herramienta desconocida: ${l.nombre}`)
          const propuesta = preparar(l.argumentos, tareas)
          const id = nuevoId()
          agregar({ id, hora: hora(), tipo: "accion", llamadaId: l.id, propuesta, estado: "pendiente" })
          if (l.modo === "directa") await ejecutarAccion(id)
        } else {
          const { pregunta, candidatas } = prepararSeleccion(l.argumentos, tareas)
          agregar({ id: nuevoId(), hora: hora(), tipo: "seleccion", llamadaId: l.id, pregunta, candidatas })
        }
      } catch (e) {
        await resolver(l.id, resultado(l.id, mensajeError(e), true))
      }
    }
  }

  // Guarda el resultado de una llamada; si ya están todas, continúa la conversación
  async function resolver(llamadaId: string, r: ResultadoHerramienta) {
    const turno = leer().turno
    if (!turno) return
    const resultados = { ...turno.resultados, [llamadaId]: r }
    if (Object.keys(resultados).length < turno.orden.length) {
      escribir({ turno: { ...turno, resultados }, cargando: false }) // faltan respuestas del usuario
      return
    }
    escribir((s) => ({
      turno: null,
      historial: [...s.historial, { role: "user", content: turno.orden.map((id) => resultados[id]) }],
    }))
    await consultarLLM()
  }

  async function ejecutarAccion(elementoId: string) {
    const el = leer().elementos.find((e) => e.id === elementoId)
    if (el?.tipo !== "accion" || el.estado !== "pendiente") return
    actualizarElemento(elementoId, { estado: "ejecutando" })
    escribir({ cargando: true })
    try {
      const tareas = await ejecutarPropuesta(el.propuesta, ops) // el tablero se actualiza solo (React Query)
      actualizarElemento(elementoId, { estado: "hecha", resultados: tareas })
      await resolver(el.llamadaId, resultado(
        el.llamadaId,
        tareas.length === 1 ? { ok: true, tarea: tareaParaModelo(tareas[0]) } : { ok: true, tareas: tareas.map(tareaParaModelo) },
      ))
    } catch (e) {
      const hechas = e instanceof ErrorLote ? e.hechas : undefined
      actualizarElemento(elementoId, { estado: "fallida", error: mensajeError(e), resultados: hechas })
      await resolver(el.llamadaId, resultado(el.llamadaId, `No se pudo completar la acción: ${mensajeError(e)}`, true))
    }
  }

  async function cancelarAccion(elementoId: string) {
    const el = leer().elementos.find((e) => e.id === elementoId)
    if (el?.tipo !== "accion" || el.estado !== "pendiente") return
    actualizarElemento(elementoId, { estado: "cancelada" })
    escribir({ cargando: true })
    await resolver(el.llamadaId, resultado(el.llamadaId, "El usuario canceló la acción. No se realizó ningún cambio."))
  }

  async function elegirTarea(elementoId: string, tareaId: string | null) {
    const el = leer().elementos.find((e) => e.id === elementoId)
    if (el?.tipo !== "seleccion" || el.elegida !== undefined) return
    actualizarElemento(elementoId, { elegida: tareaId })
    escribir({ cargando: true })
    const tarea = el.candidatas.find((t) => t.Id === tareaId)
    await resolver(el.llamadaId, resultado(
      el.llamadaId,
      tarea ? { tarea_elegida: tareaParaModelo(tarea) } : "El usuario indicó que no es ninguna de esas tareas.",
    ))
  }

  async function enviarMensaje(texto: string) {
    const limpio = texto.trim().slice(0, 4000)
    if (!limpio || leer().cargando || leer().turno) return
    agregar({ id: nuevoId(), hora: hora(), tipo: "usuario", texto: limpio })
    escribir((s) => ({ historial: [...s.historial, { role: "user", content: limpio }] }))
    await consultarLLM()
  }

  // Repite la última consulta fallida (el historial termina en un mensaje del usuario)
  async function reintentar(elementoId: string) {
    escribir((s) => ({ elementos: s.elementos.filter((e) => e.id !== elementoId) }))
    if (leer().historial.at(-1)?.role === "user") await consultarLLM()
  }

  return {
    ...estado,
    esperandoUsuario: estado.turno !== null && !estado.cargando,
    abrir: () => escribir({ abierto: true }),
    cerrar: () => escribir({ abierto: false }),
    alternar: () => escribir((s) => ({ abierto: !s.abierto })),
    nuevaConversacion: () => escribir((s) => ({ ...ESTADO_INICIAL, sesion: s.sesion + 1 })),
    enviarMensaje,
    ejecutarAccion,
    cancelarAccion,
    elegirTarea,
    reintentar,
  }
}
