import type { DatosTarea, Estado, Tarea } from "@/types/tarea"

// ---------- Contrato con el backend (server/) ----------

// Bloque de un mensaje en el formato de la API de Claude. El frontend solo lee los bloques de texto;
// el resto (razonamiento, llamadas a herramientas…) se guarda y se reenvía sin modificar.
export type BloqueContenido = { type: string; text?: string; [clave: string]: unknown }

export type MensajeApi = { role: "user" | "assistant"; content: string | BloqueContenido[] }

export type ModoHerramienta = "lectura" | "confirmacion" | "directa" | "interaccion"

export type LlamadaHerramienta = {
  id: string
  nombre: string
  modo: ModoHerramienta
  argumentos: Record<string, unknown> // ya validados por el backend
}

export type RespuestaChat = {
  nuevosMensajes: MensajeApi[]
  llamadas: LlamadaHerramienta[]
  aviso?: string
}

export type ResultadoHerramienta = {
  type: "tool_result"
  tool_use_id: string
  content: string
  is_error?: boolean
}

export type ContextoUsuario = { fecha: string; diaSemana: string; zonaHoraria: string }

// ---------- Acciones que modifican el tablero ----------

export type CambioPropuesto = { tarea: Tarea; cambios: Partial<DatosTarea>; motivo?: string }

export type PropuestaAccion =
  | { tipo: "crear"; datos: DatosTarea }
  | { tipo: "crear_varias"; datos: DatosTarea[] }
  | { tipo: "actualizar"; tarea: Tarea; cambios: Partial<DatosTarea> }
  | { tipo: "actualizar_varias"; cambios: CambioPropuesto[] }
  | { tipo: "estado"; tarea: Tarea; estado: Estado }

export type EstadoAccion = "pendiente" | "ejecutando" | "hecha" | "cancelada" | "fallida"

// ---------- Elementos que se muestran en el chat ----------

type Base = { id: string; hora: string }

export type ElementoChat =
  | (Base & { tipo: "usuario"; texto: string })
  | (Base & { tipo: "asistente"; texto: string })
  | (Base & { tipo: "error"; texto: string; reintentable: boolean })
  | (Base & {
      tipo: "accion"
      llamadaId: string
      propuesta: PropuestaAccion
      estado: EstadoAccion
      resultados?: Tarea[] // tareas tal como quedaron (en un lote fallido, las que sí se completaron)
      error?: string
    })
  | (Base & {
      tipo: "seleccion"
      llamadaId: string
      pregunta: string
      candidatas: Tarea[]
      elegida?: string | null // undefined = sin responder, null = ninguna
    })
