import type { FunctionDeclaration } from "@google/genai"
import { z } from "zod"

// Catálogo de herramientas que el LLM puede pedir. Cada herramienta tiene:
// - un esquema Zod (fuente única: valida los argumentos y genera el JSON Schema para Gemini)
// - un "modo" que le dice al frontend cómo ejecutarla:
//     lectura      → se ejecuta al instante y devuelve datos reales del tablero
//     confirmacion → se muestra una tarjeta y solo se ejecuta si el usuario confirma
//     directa      → acción de escritura sencilla y reversible que se ejecuta sin preguntar
//     interaccion  → el usuario responde desde la interfaz (por ejemplo, elegir una tarea)
// Para agregar una herramienta: declárala aquí y registra su ejecutor en src/asistente/herramientas del frontend.

export const ESTADOS = ["Por hacer", "Haciendo", "Terminado"] as const
export const PRIORIDADES = ["Alta", "Media", "Baja"] as const
export const CATEGORIAS = ["Desarrollo", "Diseño", "Documentación", "Pruebas", "Reunión"] as const

export type ModoHerramienta = "lectura" | "confirmacion" | "directa" | "interaccion"

const idTarea = z.string().trim().min(1).max(100).describe("Id exacto de la tarea, tal como lo devolvieron las otras herramientas.")
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato esperado: AAAA-MM-DD")
  .refine((v) => new Date(`${v}T00:00:00Z`).toISOString().startsWith(v), "Fecha inválida")
const titulo = z.string().trim().min(1).max(200).describe("Título corto (máx. 200 caracteres).")
const descripcion = z.string().trim().max(4000).describe("Descripción (máx. 4000 caracteres).")

// Datos de una tarea nueva (los comparten create_task y create_tasks)
const datosNuevaTarea = {
  title: titulo,
  description: descripcion.optional(),
  category: z.enum(CATEGORIAS).describe("Categoría. Si el usuario no la indica, infiérela del contenido."),
  priority: z.enum(PRIORIDADES).optional().describe("Prioridad. Si no se indica: Media."),
  status: z.enum(ESTADOS).optional().describe("Estado inicial. Si no se indica: Por hacer."),
  due_date: fecha.optional().describe("Fecha de vencimiento AAAA-MM-DD, calculada a partir de la fecha de hoy."),
}

type DefinicionHerramienta = {
  modo: ModoHerramienta
  descripcion: string
  esquema: z.ZodObject
}

const HERRAMIENTAS = {
  get_tasks: {
    modo: "lectura",
    descripcion: "Lista las tareas actuales del tablero. Los filtros son opcionales; sin filtros devuelve todas.",
    esquema: z.strictObject({
      status: z.enum(ESTADOS).optional().describe("Filtrar por estado."),
      priority: z.enum(PRIORIDADES).optional().describe("Filtrar por prioridad."),
      category: z.enum(CATEGORIAS).optional().describe("Filtrar por categoría."),
    }),
  },
  get_task: {
    modo: "lectura",
    descripcion: "Devuelve una tarea concreta por su id.",
    esquema: z.strictObject({ task_id: idTarea }),
  },
  search_tasks: {
    modo: "lectura",
    descripcion:
      "Busca tareas por texto (título, descripción o categoría), sin distinguir mayúsculas ni tildes. " +
      "Úsala siempre para obtener el id de una tarea que el usuario menciona por su nombre.",
    esquema: z.strictObject({ query: z.string().trim().min(1).max(200).describe("Texto a buscar.") }),
  },
  get_task_summary: {
    modo: "lectura",
    descripcion:
      "Resumen del tablero: totales por estado, prioridad y categoría, y tareas vencidas, que vencen hoy o esta semana.",
    esquema: z.strictObject({}),
  },
  create_task: {
    modo: "confirmacion",
    descripcion:
      "Prepara la creación de una tarea. El usuario verá una tarjeta de confirmación y la tarea solo se crea si la acepta.",
    esquema: z.strictObject(datosNuevaTarea),
  },
  create_tasks: {
    modo: "confirmacion",
    descripcion:
      "Prepara la creación de VARIAS tareas a la vez, por ejemplo cuando el usuario describe en lenguaje natural " +
      "varias cosas que tiene que hacer. El usuario verá una sola tarjeta con todas y solo se crean si la acepta.",
    esquema: z.strictObject({
      tasks: z.array(z.strictObject(datosNuevaTarea)).min(2).max(10).describe("Tareas a crear (2 a 10)."),
    }),
  },
  update_task: {
    modo: "confirmacion",
    descripcion:
      "Prepara cambios en título, descripción, categoría, prioridad o fecha de vencimiento de una tarea existente. " +
      "Envía solo los campos que cambian. Para cambiar el estado usa change_task_status. " +
      "El usuario verá los cambios y deberá confirmarlos.",
    esquema: z.strictObject({
      task_id: idTarea,
      changes: z.strictObject({
        title: titulo.optional(),
        description: descripcion.optional(),
        category: z.enum(CATEGORIAS).optional(),
        priority: z.enum(PRIORIDADES).optional(),
        due_date: fecha.nullable().optional().describe("Nueva fecha AAAA-MM-DD, o null para quitarla."),
      }).refine((c) => Object.keys(c).length > 0, "Indica al menos un campo a cambiar"),
    }),
  },
  update_tasks: {
    modo: "confirmacion",
    descripcion:
      "Prepara VARIOS cambios a la vez para organizar o repriorizar el tablero (prioridad, estado, fecha u otros campos). " +
      "Incluye solo las tareas que realmente cambian. El usuario verá una sola tarjeta con todos los cambios y su motivo; " +
      "nada se aplica hasta que la acepte.",
    esquema: z.strictObject({
      updates: z.array(z.strictObject({
        task_id: idTarea,
        changes: z.strictObject({
          title: titulo.optional(),
          description: descripcion.optional(),
          category: z.enum(CATEGORIAS).optional(),
          priority: z.enum(PRIORIDADES).optional(),
          status: z.enum(ESTADOS).optional(),
          due_date: fecha.nullable().optional().describe("Nueva fecha AAAA-MM-DD, o null para quitarla."),
        }).refine((c) => Object.keys(c).length > 0, "Indica al menos un campo a cambiar"),
        reason: z.string().trim().min(1).max(200).describe("Motivo breve del cambio, para mostrarlo al usuario."),
      })).min(1).max(15).describe("Cambios propuestos (1 a 15 tareas distintas)."),
    }),
  },
  change_task_status: {
    modo: "directa",
    descripcion:
      "Mueve UNA tarea a otra columna (estado) directamente, sin confirmación. Úsala solo cuando el usuario pida " +
      "explícitamente mover esa tarea. Para organizar el tablero usa update_tasks.",
    esquema: z.strictObject({ task_id: idTarea, status: z.enum(ESTADOS) }),
  },
  ask_user_to_select_task: {
    modo: "interaccion",
    descripcion:
      "Muestra al usuario varias tareas candidatas para que elija una. Úsala cuando la petición pueda referirse " +
      "a más de una tarea; nunca adivines. Devuelve el id elegido, o null si el usuario no eligió ninguna.",
    esquema: z.strictObject({
      question: z.string().trim().min(1).max(300).describe("Pregunta breve para el usuario."),
      task_ids: z.array(idTarea).min(2).max(10).describe("Ids de las tareas candidatas (2 a 10)."),
    }),
  },
} satisfies Record<string, DefinicionHerramienta>

export type NombreHerramienta = keyof typeof HERRAMIENTAS

// Claves de JSON Schema que Gemini no siempre admite. Se quitan del esquema que ve el modelo;
// Zod sigue aplicando esas restricciones al validar.
const CLAVES_NO_SOPORTADAS = new Set(["$schema", "minLength", "maxLength", "minItems", "maxItems", "pattern", "format"])

function limpiarEsquema(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(limpiarEsquema)
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).filter(([k]) => !CLAVES_NO_SOPORTADAS.has(k)).map(([k, v]) => [k, limpiarEsquema(v)])
    )
  }
  return valor
}

export const definicionesHerramientas: FunctionDeclaration[] = Object.entries(HERRAMIENTAS).map(
  ([nombre, h]) => ({
    name: nombre,
    description: h.descripcion,
    parametersJsonSchema: limpiarEsquema(z.toJSONSchema(h.esquema, { io: "input" })),
  })
)

export type LlamadaValidada = {
  id: string
  nombre: NombreHerramienta
  modo: ModoHerramienta
  argumentos: Record<string, unknown>
}

export type ResultadoValidacion =
  | { ok: true; llamada: LlamadaValidada }
  | { ok: false; error: string }

// Valida una llamada generada por el LLM antes de que llegue al frontend
export function validarLlamada(id: string, nombre: string, entrada: unknown): ResultadoValidacion {
  if (!(nombre in HERRAMIENTAS)) return { ok: false, error: `La herramienta "${nombre}" no existe.` }
  const def: DefinicionHerramienta = HERRAMIENTAS[nombre as NombreHerramienta]
  const r = def.esquema.safeParse(entrada)
  if (!r.success) {
    const detalle = r.error.issues.map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`).join("; ")
    return { ok: false, error: `Argumentos inválidos para ${nombre}: ${detalle}` }
  }
  return { ok: true, llamada: { id, nombre: nombre as NombreHerramienta, modo: def.modo, argumentos: r.data } }
}
