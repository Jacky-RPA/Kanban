import type { DatosTarea, Tarea } from "@/types/tarea"
import * as local from "./tareas-locales"

// Cliente de la API de tareas del backend (server/tareas/rutas.ts).
// Si el servidor no tiene base de datos conectada, las tareas se guardan en el navegador
// (tareas-locales.ts). Al conectar la base de datos en Vercel se usa ella automáticamente.

class SinBaseDatos extends Error {}

let soloNavegador = false
export const guardadoSoloEnNavegador = () => soloNavegador

async function pedir<T>(ruta: string, init?: RequestInit): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch(`/api/tareas${ruta}`, { ...init, headers: { "Content-Type": "application/json" } })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Comprueba que esté en marcha (npm run dev).")
  }
  const cuerpo = (await respuesta.json().catch(() => null)) as { error?: string; sinBaseDatos?: boolean } | null
  if (!respuesta.ok) {
    if (cuerpo?.sinBaseDatos) throw new SinBaseDatos()
    throw new Error(cuerpo?.error ?? `El servidor respondió con un error (${respuesta.status}).`)
  }
  return cuerpo as T
}

// Usa el servidor y, si responde que no hay base de datos, el navegador a partir de ese momento
async function conRespaldo<T>(remoto: () => Promise<T>, enNavegador: () => Promise<T>): Promise<T> {
  if (soloNavegador) return enNavegador()
  try {
    return await remoto()
  } catch (e) {
    if (!(e instanceof SinBaseDatos)) throw e
    soloNavegador = true
    return enNavegador()
  }
}

export const listarTareas = () =>
  conRespaldo(() => pedir<Tarea[]>(""), local.listarTareas)

export const crearTarea = (datos: DatosTarea) =>
  conRespaldo(() => pedir<Tarea>("", { method: "POST", body: JSON.stringify(datos) }), () => local.crearTarea(datos))

export const actualizarTarea = (id: string, cambios: Partial<DatosTarea>) =>
  conRespaldo(
    async () => { await pedir<Tarea>(`/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(cambios) }) },
    () => local.actualizarTarea(id, cambios),
  )
