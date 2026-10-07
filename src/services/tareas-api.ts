import type { DatosTarea, Tarea } from "@/types/tarea"

// Cliente de la API de tareas del backend (server/tareas/rutas.ts).
// Si algún día cambia la fuente de datos, solo se reemplaza este archivo.

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`/api/tareas${ruta}`, { ...init, headers: { "Content-Type": "application/json" } })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Comprueba que esté en marcha (npm run dev).")
  }
  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw new Error((cuerpo as { error?: string } | null)?.error ?? `El servidor respondió con un error (${respuesta.status}).`)
  }
  return cuerpo as T
}

export const listarTareas = () => pedir<Tarea[]>("")

export const crearTarea = (datos: DatosTarea) =>
  pedir<Tarea>("", { method: "POST", body: JSON.stringify(datos) })

export async function actualizarTarea(id: string, cambios: Partial<DatosTarea>): Promise<void> {
  await pedir<Tarea>(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(cambios) })
}
