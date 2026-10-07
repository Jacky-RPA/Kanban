import { Router, type NextFunction, type Request, type Response } from "express"
import { z } from "zod"
import { CATEGORIAS, ESTADOS, PRIORIDADES } from "../../src/types/tarea.js"
import { obtenerRepositorio, SinBaseDatos } from "./repositorio.js"

// API REST de las tareas:
//   GET   /api/tareas       → Tarea[]
//   POST  /api/tareas       → Tarea      (cuerpo: DatosTarea)
//   PATCH /api/tareas/:id   → Tarea      (cuerpo: Partial<DatosTarea>)

const esquemaDatos = z.object({
  Titulo: z.string().trim().min(1).max(200),
  Descripcion: z.string().trim().max(4000),
  Categoria: z.enum(CATEGORIAS),
  Prioridad: z.enum(PRIORIDADES),
  Estado: z.enum(ESTADOS),
  FechaVencimiento: z.iso.date().nullable(),
})
const esquemaCambios = esquemaDatos.partial().refine((c) => Object.keys(c).length > 0, "No hay cambios")

export const rutasTareas = Router()

rutasTareas.get("/", async (_req, res) => {
  res.json(await obtenerRepositorio().listar())
})

rutasTareas.post("/", async (req, res) => {
  const datos = esquemaDatos.safeParse(req.body)
  if (!datos.success) {
    res.status(400).json({ error: "Datos de la tarea no válidos." })
    return
  }
  res.status(201).json(await obtenerRepositorio().crear(datos.data))
})

rutasTareas.patch("/:id", async (req, res) => {
  const id = z.uuid().safeParse(req.params.id)
  const cambios = esquemaCambios.safeParse(req.body)
  if (!id.success || !cambios.success) {
    res.status(400).json({ error: "Cambios no válidos." })
    return
  }
  const tarea = await obtenerRepositorio().actualizar(id.data, cambios.data)
  if (!tarea) {
    res.status(404).json({ error: "La tarea no existe." })
    return
  }
  res.json(tarea)
})

// Errores de la base de datos: se registran y se devuelve un mensaje sin detalles internos
rutasTareas.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof SinBaseDatos) {
    res.status(503).json({ error: error.message, sinBaseDatos: true })
    return
  }
  console.error("[tareas]", error)
  res.status(500).json({ error: "No se pudo acceder a la base de datos." })
})
