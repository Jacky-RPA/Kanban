import { randomUUID } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import type { DatosTarea, Tarea } from "../../src/types/tarea.js"
import { TAREAS_EJEMPLO } from "./ejemplos.js"
import type { Repositorio } from "./repositorio.js"

// Almacenamiento para desarrollo local: un archivo JSON (ignorado por git).
const RUTA = path.resolve(".data", "tareas.json")

const nueva = (datos: DatosTarea): Tarea => ({ ...datos, Id: randomUUID(), FechaCreacion: new Date().toISOString() })

async function leer(): Promise<Tarea[]> {
  try {
    return JSON.parse(await readFile(RUTA, "utf8")) as Tarea[]
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e
    const iniciales = TAREAS_EJEMPLO.map(nueva)
    await guardar(iniciales)
    return iniciales
  }
}

async function guardar(tareas: Tarea[]) {
  await mkdir(path.dirname(RUTA), { recursive: true })
  await writeFile(RUTA, JSON.stringify(tareas, null, 2))
}

export function repositorioArchivo(): Repositorio {
  console.log(`[tareas] Sin DATABASE_URL: se guardan en ${RUTA}`)

  // Las escrituras se encadenan para que dos peticiones seguidas no se pisen
  let cola: Promise<unknown> = Promise.resolve()
  const enCola = <T>(op: () => Promise<T>): Promise<T> => {
    const resultado = cola.then(op)
    cola = resultado.catch(() => {})
    return resultado
  }

  return {
    listar: () => enCola(leer),
    crear: (datos) => enCola(async () => {
      const tareas = await leer()
      const tarea = nueva(datos)
      await guardar([...tareas, tarea])
      return tarea
    }),
    actualizar: (id, cambios) => enCola(async () => {
      const tareas = await leer()
      const i = tareas.findIndex((t) => t.Id === id)
      if (i === -1) return null
      tareas[i] = { ...tareas[i], ...cambios }
      await guardar(tareas)
      return tareas[i]
    }),
  }
}
