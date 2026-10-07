import postgres from "postgres"
import type { DatosTarea, Tarea } from "../../src/types/tarea.js"
import { TAREAS_EJEMPLO } from "./ejemplos.js"
import type { Repositorio } from "./repositorio.js"

// Nombre de cada campo de la app en la tabla
const COLUMNAS = {
  Titulo: "titulo",
  Descripcion: "descripcion",
  Categoria: "categoria",
  Prioridad: "prioridad",
  Estado: "estado",
  FechaVencimiento: "fecha_vencimiento",
} as const satisfies Record<keyof DatosTarea, string>

type Fila = {
  id: string
  titulo: string
  descripcion: string
  categoria: Tarea["Categoria"]
  prioridad: Tarea["Prioridad"]
  estado: Tarea["Estado"]
  fecha_vencimiento: string | null
  fecha_creacion: Date
}

const aTarea = (f: Fila): Tarea => ({
  Id: f.id,
  Titulo: f.titulo,
  Descripcion: f.descripcion,
  Categoria: f.categoria,
  Prioridad: f.prioridad,
  Estado: f.estado,
  FechaVencimiento: f.fecha_vencimiento,
  FechaCreacion: f.fecha_creacion.toISOString(),
})

const aFila = (datos: Partial<DatosTarea>) =>
  Object.fromEntries(Object.entries(datos).map(([campo, valor]) => [COLUMNAS[campo as keyof DatosTarea], valor]))

export function repositorioPostgres(url: string): Repositorio {
  // max: 1 y sin sentencias preparadas: adecuado para funciones serverless y poolers (Neon, Supabase)
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} })

  const SELECCION = sql`id::text, titulo, descripcion, categoria, prioridad, estado,
    to_char(fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento, fecha_creacion`

  // Crea la tabla la primera vez (y carga los ejemplos si está vacía)
  let listo: Promise<void> | undefined
  const preparar = () => (listo ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS tareas (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        titulo            text NOT NULL,
        descripcion       text NOT NULL DEFAULT '',
        categoria         text NOT NULL,
        prioridad         text NOT NULL,
        estado            text NOT NULL,
        fecha_vencimiento date,
        fecha_creacion    timestamptz NOT NULL DEFAULT now()
      )`
    const [{ total }] = await sql<{ total: number }[]>`SELECT count(*)::int AS total FROM tareas`
    if (total === 0) {
      // Un milisegundo de diferencia para que conserven su orden (el tablero ordena por fecha de creación)
      const ahora = Date.now()
      await sql`INSERT INTO tareas ${sql(TAREAS_EJEMPLO.map((t, i) => ({ ...aFila(t), fecha_creacion: new Date(ahora + i) })))}`
    }
  })().catch((e) => { listo = undefined; throw e }))

  return {
    async listar() {
      await preparar()
      const filas = await sql<Fila[]>`SELECT ${SELECCION} FROM tareas ORDER BY fecha_creacion, id`
      return filas.map(aTarea)
    },
    async crear(datos) {
      await preparar()
      const [fila] = await sql<Fila[]>`INSERT INTO tareas ${sql(aFila(datos))} RETURNING ${SELECCION}`
      return aTarea(fila)
    },
    async actualizar(id, cambios) {
      await preparar()
      const [fila] = await sql<Fila[]>`UPDATE tareas SET ${sql(aFila(cambios))} WHERE id = ${id} RETURNING ${SELECCION}`
      return fila ? aTarea(fila) : null
    },
  }
}
