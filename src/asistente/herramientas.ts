import { endOfWeek, format } from "date-fns"
import { hoyISO } from "@/lib/fechas"
import { describirVencimiento, getDeadlineStatus } from "@/lib/vencimiento"
import { CATEGORIAS, ESTADOS, PRIORIDADES, type DatosTarea, type Estado, type Tarea } from "@/types/tarea"
import type { CambioPropuesto, PropuestaAccion } from "./tipos"

// Ejecutores de las herramientas que pide el LLM. Trabajan siempre sobre las tareas recién leídas
// del servidor y escriben únicamente a través de las funciones existentes (useTareas → tareas-api).
// El backend ya validó el formato de los argumentos; aquí se valida contra los datos reales
// (que el id exista, que el cambio tenga sentido…).
// Para agregar una herramienta nueva: declárala en server/src/asistente/herramientas.ts y añade su ejecutor aquí.

// Error que se devuelve al LLM como resultado de la herramienta (is_error) para que lo explique o corrija
export class ErrorHerramienta extends Error {}

type Args = Record<string, unknown>

// ---------- Utilidades ----------

// Vencimiento calculado con la misma lógica que muestra la tarjeta del tablero
const vencimientoParaModelo = (t: Tarea) => {
  const { status, daysRemaining } = getDeadlineStatus(t)
  // vencimiento_texto es el mismo texto que muestra la tarjeta ("Vencida hace 2 días", "Vence hoy"…)
  return { estado_vencimiento: status, dias_restantes: daysRemaining, vencimiento_texto: describirVencimiento(t) }
}

// Representación compacta de una tarea para el LLM
export const tareaParaModelo = (t: Tarea) => ({
  id: t.Id,
  titulo: t.Titulo,
  descripcion: t.Descripcion,
  categoria: t.Categoria,
  prioridad: t.Prioridad,
  estado: t.Estado,
  fecha_vencimiento: t.FechaVencimiento,
  ...vencimientoParaModelo(t),
  creada: t.FechaCreacion.slice(0, 10),
})

const referencia = (t: Tarea) => ({
  id: t.Id, titulo: t.Titulo, prioridad: t.Prioridad, estado: t.Estado, fecha_vencimiento: t.FechaVencimiento,
  ...vencimientoParaModelo(t),
})

function buscarPorId(tareas: Tarea[], id: unknown): Tarea {
  const tarea = tareas.find((t) => t.Id === id)
  if (!tarea) throw new ErrorHerramienta(`No existe ninguna tarea con id "${String(id)}". Búscala con search_tasks.`)
  return tarea
}

// Defensa extra: comprueba que un valor pertenece a la lista permitida
function enLista<T extends string>(valor: unknown, permitidos: readonly T[], campo: string): T {
  const v = permitidos.find((p) => p === valor)
  if (!v) throw new ErrorHerramienta(`Valor no válido para ${campo}: "${String(valor)}".`)
  return v
}

const normalizar = (texto: string) => texto.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim()

// ---------- Lectura ----------

function getTasks(args: Args, tareas: Tarea[]) {
  const filtradas = tareas.filter((t) =>
    (!args.status || t.Estado === args.status) &&
    (!args.priority || t.Prioridad === args.priority) &&
    (!args.category || t.Categoria === args.category)
  )
  return { total: filtradas.length, tareas: filtradas.map(tareaParaModelo) }
}

function getTask(args: Args, tareas: Tarea[]) {
  return tareaParaModelo(buscarPorId(tareas, args.task_id))
}

// Puntúa cada tarea según qué tan bien coincide con el texto. No decide por el usuario:
// devuelve todas las coincidencias para que el LLM pida aclaración si hay varias.
function searchTasks(args: Args, tareas: Tarea[]) {
  const consulta = normalizar(String(args.query))
  const palabras = consulta.split(/\s+/).filter((p) => p.length > 1)

  const puntuadas = tareas.map((t) => {
    const titulo = normalizar(t.Titulo)
    const resto = normalizar(`${t.Descripcion} ${t.Categoria}`)
    let puntos = 0
    if (titulo === consulta) puntos = 100
    else if (titulo.includes(consulta)) puntos = 70
    else if (consulta.includes(titulo)) puntos = 60
    else {
      const enTitulo = palabras.filter((p) => titulo.includes(p)).length
      const enResto = palabras.filter((p) => resto.includes(p)).length
      if (palabras.length) puntos = Math.round((enTitulo / palabras.length) * 50 + (enResto / palabras.length) * 15)
    }
    return { t, puntos }
  })

  const coincidencias = puntuadas
    .filter((p) => p.puntos >= 20)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, 10)

  return {
    total: coincidencias.length,
    coincidencias: coincidencias.map(({ t, puntos }) => ({ ...tareaParaModelo(t), coincidencia: puntos >= 100 ? "exacta" : puntos >= 60 ? "alta" : "parcial" })),
  }
}

function getTaskSummary(_args: Args, tareas: Tarea[]) {
  const contar = <K extends string>(valores: readonly K[], campo: (t: Tarea) => K, lista = tareas) =>
    Object.fromEntries(valores.map((v) => [v, lista.filter((t) => campo(t) === v).length]))

  const pendientes = tareas.filter((t) => t.Estado !== "Terminado")
  const conFecha = pendientes.filter((t): t is Tarea & { FechaVencimiento: string } => t.FechaVencimiento !== null)
  const finSemana = format(endOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd")
  const hoy = hoyISO()

  return {
    fecha_hoy: hoy,
    total: tareas.length,
    por_estado: contar(ESTADOS, (t) => t.Estado),
    por_prioridad: contar(PRIORIDADES, (t) => t.Prioridad),
    por_categoria: contar(CATEGORIAS, (t) => t.Categoria),
    pendientes: {
      total: pendientes.length,
      por_prioridad: contar(PRIORIDADES, (t) => t.Prioridad, pendientes),
      vencidas: conFecha.filter((t) => getDeadlineStatus(t).status === "overdue").map(referencia),
      vencen_hoy: conFecha.filter((t) => getDeadlineStatus(t).status === "due_today").map(referencia),
      vencen_esta_semana: conFecha.filter((t) => t.FechaVencimiento > hoy && t.FechaVencimiento <= finSemana).map(referencia),
      sin_fecha: pendientes.filter((t) => t.FechaVencimiento === null).length,
      en_progreso: pendientes.filter((t) => t.Estado === "Haciendo").map(referencia),
    },
  }
}

export const LECTURA: Record<string, (args: Args, tareas: Tarea[]) => unknown> = {
  get_tasks: getTasks,
  get_task: getTask,
  search_tasks: searchTasks,
  get_task_summary: getTaskSummary,
}

// ---------- Escritura: se prepara una propuesta que luego se ejecuta (con o sin confirmación) ----------

// Valida y normaliza los datos de una tarea nueva (create_task y create_tasks)
function datosNuevaTarea(args: Args, tareas: Tarea[]): DatosTarea {
  const titulo = String(args.title).trim()
  const duplicada = tareas.find((t) => normalizar(t.Titulo) === normalizar(titulo) && t.Estado !== "Terminado")
  if (duplicada) {
    throw new ErrorHerramienta(`Ya existe una tarea pendiente con el título "${duplicada.Titulo}". Pregunta al usuario si quiere crear otra igual o modificar la existente.`)
  }
  return {
    Titulo: titulo,
    Descripcion: String(args.description ?? "").trim(),
    Categoria: enLista(args.category, CATEGORIAS, "category"),
    Prioridad: enLista(args.priority ?? "Media", PRIORIDADES, "priority"),
    Estado: enLista(args.status ?? "Por hacer", ESTADOS, "status"),
    FechaVencimiento: (args.due_date as string | undefined) ?? null,
  }
}

// Valida los cambios pedidos para una tarea y devuelve solo los campos que realmente cambian
function cambiosReales(tarea: Tarea, c: Args): Partial<DatosTarea> {
  const propuestos: Partial<DatosTarea> = {}
  if (c.title !== undefined) propuestos.Titulo = String(c.title).trim()
  if (c.description !== undefined) propuestos.Descripcion = String(c.description).trim()
  if (c.category !== undefined) propuestos.Categoria = enLista(c.category, CATEGORIAS, "category")
  if (c.priority !== undefined) propuestos.Prioridad = enLista(c.priority, PRIORIDADES, "priority")
  if (c.status !== undefined) propuestos.Estado = enLista(c.status, ESTADOS, "status")
  if (c.due_date !== undefined) {
    propuestos.FechaVencimiento = c.due_date as string | null
  }
  return Object.fromEntries(
    Object.entries(propuestos).filter(([campo, valor]) => tarea[campo as keyof DatosTarea] !== valor)
  ) as Partial<DatosTarea>
}

function prepararCrear(args: Args, tareas: Tarea[]): PropuestaAccion {
  return { tipo: "crear", datos: datosNuevaTarea(args, tareas) }
}

function prepararCrearVarias(args: Args, tareas: Tarea[]): PropuestaAccion {
  const datos = (args.tasks as Args[]).map((a) => datosNuevaTarea(a, tareas))
  const titulos = datos.map((d) => normalizar(d.Titulo))
  if (new Set(titulos).size !== titulos.length) throw new ErrorHerramienta("Hay tareas repetidas en la propuesta; cada tarea debe tener un título distinto.")
  return { tipo: "crear_varias", datos }
}

function prepararActualizar(args: Args, tareas: Tarea[]): PropuestaAccion {
  const tarea = buscarPorId(tareas, args.task_id)
  const cambios = cambiosReales(tarea, args.changes as Args)
  if (Object.keys(cambios).length === 0) {
    throw new ErrorHerramienta(`La tarea "${tarea.Titulo}" ya tiene esos valores; no hay nada que cambiar.`)
  }
  return { tipo: "actualizar", tarea, cambios }
}

// Varios cambios en una sola propuesta. Se descartan los que no cambian nada.
function prepararActualizarVarias(args: Args, tareas: Tarea[]): PropuestaAccion {
  const updates = args.updates as Args[]
  const ids = updates.map((u) => u.task_id)
  if (new Set(ids).size !== ids.length) throw new ErrorHerramienta("Una misma tarea aparece varias veces; junta todos sus cambios en un solo elemento.")

  const cambios: CambioPropuesto[] = updates
    .map((u) => {
      const tarea = buscarPorId(tareas, u.task_id)
      return { tarea, cambios: cambiosReales(tarea, u.changes as Args), motivo: String(u.reason ?? "").trim() || undefined }
    })
    .filter((c) => Object.keys(c.cambios).length > 0)
  if (cambios.length === 0) throw new ErrorHerramienta("Las tareas ya tienen esos valores; no hay nada que cambiar.")
  return { tipo: "actualizar_varias", cambios }
}

function prepararEstado(args: Args, tareas: Tarea[]): PropuestaAccion {
  const tarea = buscarPorId(tareas, args.task_id)
  const estado: Estado = enLista(args.status, ESTADOS, "status")
  if (tarea.Estado === estado) throw new ErrorHerramienta(`La tarea "${tarea.Titulo}" ya está en "${estado}".`)
  return { tipo: "estado", tarea, estado }
}

export const ESCRITURA: Record<string, (args: Args, tareas: Tarea[]) => PropuestaAccion> = {
  create_task: prepararCrear,
  create_tasks: prepararCrearVarias,
  update_task: prepararActualizar,
  update_tasks: prepararActualizarVarias,
  change_task_status: prepararEstado,
}

// Operaciones existentes del tablero (vienen de useTareas)
export type OperacionesTareas = {
  crearTarea: (datos: DatosTarea) => Promise<Tarea>
  actualizarTarea: (id: string, cambios: Partial<DatosTarea>) => Promise<unknown>
}

// Error de un lote que se quedó a medias: conserva las tareas que sí se completaron
export class ErrorLote extends Error {
  readonly hechas: Tarea[]
  constructor(mensaje: string, hechas: Tarea[]) {
    super(mensaje)
    this.hechas = hechas
  }
}

// Ejecuta los pasos uno a uno (la API no tiene transacciones). Si uno falla, se detiene.
async function enSecuencia<T>(elementos: T[], paso: (e: T) => Promise<Tarea>, nombre: (e: T) => string): Promise<Tarea[]> {
  const hechas: Tarea[] = []
  for (const e of elementos) {
    try {
      hechas.push(await paso(e))
    } catch (error) {
      const detalle = error instanceof Error ? error.message : "error desconocido"
      throw new ErrorLote(`Se completaron ${hechas.length} de ${elementos.length}. Falló "${nombre(e)}": ${detalle}`, hechas)
    }
  }
  return hechas
}

// Devuelve las tareas tal como quedaron
export async function ejecutarPropuesta(p: PropuestaAccion, ops: OperacionesTareas): Promise<Tarea[]> {
  switch (p.tipo) {
    case "crear":
      return [await ops.crearTarea(p.datos)]
    case "crear_varias":
      return enSecuencia(p.datos, ops.crearTarea, (d) => d.Titulo)
    case "actualizar":
      await ops.actualizarTarea(p.tarea.Id, p.cambios)
      return [{ ...p.tarea, ...p.cambios }]
    case "actualizar_varias":
      return enSecuencia(
        p.cambios,
        async (c) => { await ops.actualizarTarea(c.tarea.Id, c.cambios); return { ...c.tarea, ...c.cambios } },
        (c) => c.tarea.Titulo,
      )
    case "estado":
      await ops.actualizarTarea(p.tarea.Id, { Estado: p.estado })
      return [{ ...p.tarea, Estado: p.estado }]
  }
}

// ---------- Interacción ----------

export function prepararSeleccion(args: Args, tareas: Tarea[]) {
  const ids = [...new Set(args.task_ids as string[])]
  const candidatas = ids.map((id) => buscarPorId(tareas, id))
  if (candidatas.length < 2) throw new ErrorHerramienta("Se necesitan al menos dos tareas distintas para pedir una elección.")
  return { pregunta: String(args.question), candidatas }
}
