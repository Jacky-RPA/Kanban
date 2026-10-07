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

export function obtenerRepositorio(): Repositorio {
  if (repositorio) return repositorio
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (url) return (repositorio = repositorioPostgres(url))
  if (process.env.VERCEL) throw new Error("Falta DATABASE_URL en las variables de entorno de Vercel.")
  return (repositorio = repositorioArchivo())
}
