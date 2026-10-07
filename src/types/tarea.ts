// Modelo de una tarea. Lo comparten el frontend y el backend (server/tareas).
export const ESTADOS = ["Por hacer", "Haciendo", "Terminado"] as const
export const PRIORIDADES = ["Alta", "Media", "Baja"] as const
export const CATEGORIAS = ["Desarrollo", "Diseño", "Documentación", "Pruebas", "Reunión"] as const

export type Estado = (typeof ESTADOS)[number]
export type Prioridad = (typeof PRIORIDADES)[number]
export type Categoria = (typeof CATEGORIAS)[number]

export type Tarea = {
  Id: string
  Titulo: string
  Descripcion: string
  Categoria: Categoria
  Prioridad: Prioridad
  Estado: Estado
  FechaVencimiento: string | null // AAAA-MM-DD, opcional
  FechaCreacion: string // ISO 8601
}

// Datos que el usuario captura en el formulario (Id y FechaCreacion los asigna el sistema)
export type DatosTarea = Omit<Tarea, "Id" | "FechaCreacion">
