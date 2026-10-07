import { ApiError } from "@google/genai"
import express, { type NextFunction, type Request, type Response } from "express"
import { z } from "zod"
import { avanzarConversacion, ErrorAsistente, type MensajeApi } from "./asistente/servicio.js"
import { urlBaseDatos, variablesBaseDatos } from "./tareas/repositorio.js"
import { rutasTareas } from "./tareas/rutas.js"

// Validación del cuerpo de la petición (historial con bloques text / tool_use / tool_result)
const esquemaPeticion = z.object({
  mensajes: z
    .array(z.object({
      role: z.enum(["user", "assistant"]),
      content: z.union([z.string().min(1).max(4000), z.array(z.looseObject({ type: z.string() })).min(1)]),
    }))
    .min(1)
    .max(200)
    .refine((m) => m[0]?.role === "user" && m.at(-1)?.role === "user", "La conversación debe empezar y terminar con un mensaje del usuario"),
  contexto: z.object({
    fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    diaSemana: z.string().max(20),
    zonaHoraria: z.string().max(60),
  }),
})

// Backend de la app: tareas y Asistente IA. En local lo arranca server/dev.ts; en Vercel, api/index.ts.
// El frontend se sirve desde el mismo dominio, así que no hace falta CORS.
export const app = express()
app.use(express.json({ limit: "5mb" }))

app.use("/api/tareas", rutasTareas)

app.get("/api/salud", (_req, res) => {
  res.json({
    ok: true,
    configurado: Boolean(process.env.GEMINI_API_KEY),
    baseDatos: urlBaseDatos() ? "postgres" : process.env.VERCEL ? "sin configurar" : "archivo local",
    variablesBaseDatos: variablesBaseDatos(), // solo los nombres, nunca los valores
  })
})

app.post("/api/asistente/chat", async (req, res, next) => {
  const peticion = esquemaPeticion.safeParse(req.body)
  if (!peticion.success) {
    res.status(400).json({ error: "Petición inválida." })
    return
  }
  try {
    const { mensajes, contexto } = peticion.data
    res.json(await avanzarConversacion(mensajes as MensajeApi[], contexto))
  } catch (e) {
    next(e)
  }
})

// Traduce los errores del proveedor a mensajes comprensibles sin filtrar detalles internos
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[asistente]", error)
  const estado = error instanceof ApiError ? error.status : 0
  const [codigo, mensaje] =
    error instanceof ErrorAsistente ? [error.estado, error.message]
    : estado === 400 && /api key/i.test(String((error as Error).message)) ? [500, "La GEMINI_API_KEY del servidor no es válida."]
    : estado === 401 || estado === 403 ? [500, "La GEMINI_API_KEY del servidor no es válida o no tiene permisos."]
    : estado === 429 ? [429, "Se alcanzó el límite gratuito de Gemini. Espera un minuto e inténtalo de nuevo."]
    : estado === 400 ? [502, "El asistente no pudo procesar la conversación. Prueba a iniciar una nueva."]
    : estado >= 500 ? [502, "El servicio de Gemini no está disponible en este momento."]
    : [500, "Error inesperado del asistente."]
  res.status(codigo).json({ error: mensaje })
})
