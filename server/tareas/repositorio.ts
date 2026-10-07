import type { DatosTarea, Tarea } from "../../src/types/tarea.js"
import { repositorioArchivo } from "./archivo.js"
import { repositorioPostgres } from "./postgres.js"

// Dónde se guardan las tareas. Las rutas solo usan esta interfaz, así que cambiar de base de datos
// no obliga a tocar nada más.
export type Repositorio = {
  listar(): Promise<Tarea[]>
  crear(datos: DatosTarea): Promise<Tarea>
  actualizar(id: string, cambios: Partial<DatosTarea>): Promise<Tarea | null> // null si no existe
}

// Con DATABASE_URL (Neon, Supabase, Postgres local…) se usa PostgreSQL.
// Sin ella, en local se guardan en .data/tareas.json para poder probar sin configurar nada.
// En Vercel el disco es de solo lectura, así que allí la base de datos es obligatoria.
let repositorio: Repositorio | undefined

// En Vercel sin base de datos: el frontend lo detecta y guarda las tareas en el navegador
export class SinBaseDatos extends Error {}

// Al conectar Neon desde Vercel la variable puede llevar un prefijo (p. ej. STORAGE_DATABASE_URL),
// así que también se aceptan las que terminan en _DATABASE_URL o _POSTGRES_URL.
const PATRON_URL = /(^|_)(DATABASE_URL|POSTGRES_URL)$/

export const variablesBaseDatos = () => Object.keys(process.env).filter((k) => PATRON_URL.test(k) && process.env[k])

export function urlBaseDatos(): string | undefined {
  const preferida = process.env.DATABASE_URL || process.env.POSTGRES_URL
  return preferida || process.env[variablesBaseDatos()[0] ?? ""]
}

export function obtenerRepositorio(): Repositorio {
  if (repositorio) return repositorio
  const url = urlBaseDatos()
  if (url) return (repositorio = repositorioPostgres(url))
  if (process.env.VERCEL) {
    throw new SinBaseDatos("No hay base de datos conectada: las tareas se guardan solo en este navegador.")
  }
  return (repositorio = repositorioArchivo())
}
