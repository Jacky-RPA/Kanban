import { randomUUID } from "node:crypto"
import { ApiError, FinishReason, GoogleGenAI, type Content, type GenerateContentParameters, type Part } from "@google/genai"
import { definicionesHerramientas, validarLlamada, type LlamadaValidada } from "./herramientas.js"
import { PROMPT_SISTEMA, promptContexto, type ContextoUsuario } from "./prompt.js"

// ---------- Formato del historial ----------
// El frontend guarda la conversación con bloques neutros (text, tool_use, tool_result) y solo lee los de
// texto. Cada respuesta del modelo incluye además un bloque "gemini_parts" con las partes originales,
// que se reenvían tal cual (Gemini necesita sus firmas de razonamiento para continuar con herramientas).

type Bloque = { type: string; [clave: string]: unknown }
export type MensajeApi = { role: "user" | "assistant"; content: string | Bloque[] }

// Si el modelo principal está saturado o sin cupo, se usa el de respaldo
const MODELOS = [
  process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
  process.env.GEMINI_MODEL_RESPALDO || "gemini-flash-latest",
]
// Veces que se le devuelve al modelo un error de validación para que corrija sus argumentos
const MAX_CORRECCIONES = 2

// Lee GEMINI_API_KEY del entorno (.env o variables de entorno de Vercel). Nunca llega al navegador.
// Se crea al primer uso para que el servidor arranque aunque falte la clave.
let cliente: GoogleGenAI | undefined
const obtenerCliente = () =>
  (cliente ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 25_000, retryOptions: { attempts: 1 } }, // sin reintentos largos: se pasa al respaldo
  }))

const esErrorTemporal = (e: unknown) =>
  (e instanceof ApiError && [429, 500, 503, 504].includes(e.status)) || (e instanceof Error && /timeout|abort/i.test(e.message))

async function generar(params: Omit<GenerateContentParameters, "model">) {
  for (const [i, model] of MODELOS.entries()) {
    try {
      return await obtenerCliente().models.generateContent({ ...params, model })
    } catch (e) {
      if (i === MODELOS.length - 1 || !esErrorTemporal(e)) throw e
      console.warn(`[asistente] ${model} no disponible, usando ${MODELOS[i + 1]}`)
    }
  }
  throw new ErrorAsistente("No hay modelos disponibles.")
}

// Error con un mensaje pensado para mostrarse al usuario
export class ErrorAsistente extends Error {
  readonly estado: number
  constructor(mensaje: string, estado = 500) {
    super(mensaje)
    this.estado = estado
  }
}

export type RespuestaAsistente = {
  // Mensajes nuevos que el frontend debe añadir tal cual a su historial
  nuevosMensajes: MensajeApi[]
  // Herramientas que el frontend debe ejecutar (vacío si el modelo terminó su turno)
  llamadas: LlamadaValidada[]
  // Mensaje para mostrar cuando el modelo no pudo responder
  aviso?: string
}

const parsear = (texto: string): unknown => {
  try { return JSON.parse(texto) } catch { return texto }
}

// Convierte el historial neutro al formato de Gemini
function aContenidosGemini(historial: MensajeApi[]): Content[] {
  const llamadas = new Map<string, { nombre: string; idGemini?: string }>()
  const contenidos: Content[] = []

  for (const m of historial) {
    const role = m.role === "assistant" ? "model" : "user"
    let parts: Part[]

    if (typeof m.content === "string") {
      parts = [{ text: m.content }]
    } else if (m.role === "assistant") {
      for (const b of m.content) {
        if (b.type === "tool_use") llamadas.set(String(b.id), { nombre: String(b.name), idGemini: b.idGemini as string | undefined })
      }
      const originales = m.content.find((b) => b.type === "gemini_parts")
      parts = originales
        ? (originales.parts as Part[])
        : m.content.flatMap((b): Part[] =>
            b.type === "text" ? [{ text: String(b.text) }]
            : b.type === "tool_use" ? [{ functionCall: { name: String(b.name), args: b.input as Record<string, unknown> } }]
            : [])
    } else {
      parts = m.content.flatMap((b): Part[] => {
        if (b.type === "text") return [{ text: String(b.text) }]
        if (b.type !== "tool_result") return []
        const llamada = llamadas.get(String(b.tool_use_id))
        const contenido = String(b.content ?? "")
        return [{
          functionResponse: {
            ...(llamada?.idGemini && { id: llamada.idGemini }),
            name: llamada?.nombre ?? "desconocida",
            response: b.is_error ? { error: contenido } : { output: parsear(contenido) },
          },
        }]
      })
    }

    // Gemini espera turnos alternados: se juntan los mensajes seguidos del mismo rol
    const anterior = contenidos.at(-1)
    if (anterior?.role === role) anterior.parts = [...(anterior.parts ?? []), ...parts]
    else contenidos.push({ role, parts })
  }
  return contenidos
}

// Un paso de la conversación: envía el historial a Gemini y devuelve su respuesta.
// El backend no ejecuta las herramientas: valida sus argumentos y se las pasa al frontend, que las
// ejecuta con la API de tareas existente (/api/tareas) y devuelve el resultado.
export async function avanzarConversacion(historial: MensajeApi[], contexto: ContextoUsuario): Promise<RespuestaAsistente> {
  if (!process.env.GEMINI_API_KEY) {
    throw new ErrorAsistente("El asistente no está configurado: falta GEMINI_API_KEY en las variables de entorno.", 503)
  }
  const nuevos: MensajeApi[] = []

  for (let intento = 0; ; intento++) {
    const respuesta = await generar({
      contents: aContenidosGemini([...historial, ...nuevos]),
      config: {
        systemInstruction: `${PROMPT_SISTEMA}\n\n${promptContexto(contexto)}`,
        tools: [{ functionDeclarations: definicionesHerramientas }],
      },
    })

    const candidato = respuesta.candidates?.[0]
    const parts = candidato?.content?.parts ?? []
    if (!candidato || parts.length === 0) {
      const bloqueada = respuesta.promptFeedback?.blockReason || candidato?.finishReason === FinishReason.SAFETY
      return {
        nuevosMensajes: nuevos,
        llamadas: [],
        aviso: bloqueada ? "Lo siento, no puedo ayudarte con esa solicitud." : "No obtuve respuesta del asistente. Inténtalo de nuevo.",
      }
    }

    // Se traduce la respuesta a bloques neutros, guardando también las partes originales
    const usos = parts
      .filter((p) => p.functionCall)
      .map((p) => ({ id: randomUUID(), idGemini: p.functionCall!.id, nombre: p.functionCall!.name ?? "", args: p.functionCall!.args ?? {} }))
    const texto = parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("")

    nuevos.push({
      role: "assistant",
      content: [
        ...(texto ? [{ type: "text", text: texto }] : []),
        ...usos.map((u) => ({ type: "tool_use", id: u.id, idGemini: u.idGemini, name: u.nombre, input: u.args })),
        { type: "gemini_parts", parts },
      ],
    })

    if (usos.length === 0) return { nuevosMensajes: nuevos, llamadas: [] }

    const truncada = candidato.finishReason === FinishReason.MAX_TOKENS
    const validaciones = usos.map((u) =>
      truncada ? { ok: false as const, error: "La respuesta se cortó antes de terminar la llamada." } : validarLlamada(u.id, u.nombre, u.args)
    )

    if (validaciones.every((v) => v.ok)) {
      return { nuevosMensajes: nuevos, llamadas: validaciones.map((v) => v.llamada) }
    }

    if (intento >= MAX_CORRECCIONES) {
      throw new ErrorAsistente("El asistente generó una acción no válida varias veces seguidas. Intenta reformular tu mensaje.")
    }

    // Alguna llamada es inválida: se devuelven todos los resultados juntos y el modelo corrige.
    // Las válidas tampoco se ejecutan, para no aplicar a medias un grupo de acciones.
    nuevos.push({
      role: "user",
      content: usos.map((u, i) => {
        const v = validaciones[i]
        return {
          type: "tool_result",
          tool_use_id: u.id,
          is_error: true,
          content: v.ok ? "No se ejecutó porque otra llamada del mismo turno era inválida. Vuelve a intentarlo." : v.error,
        }
      }),
    })
  }
}
