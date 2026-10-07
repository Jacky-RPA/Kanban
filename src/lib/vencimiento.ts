import { differenceInCalendarDays, parseISO } from "date-fns"
import { formatearFecha } from "@/lib/fechas"
import type { Tarea } from "@/types/tarea"

// Única fuente de verdad sobre el vencimiento de una tarea. La usan la tarjeta del tablero
// y las herramientas del asistente IA, para que lo que ve el usuario y lo que razona el LLM coincidan.

export type DeadlineStatus =
  | "overdue"      // ya pasó la fecha y no está terminada
  | "due_today"
  | "due_tomorrow"
  | "due_soon"     // vence en 2 a DIAS_PROXIMA días
  | "normal"
  | "completed"    // terminada: nunca se considera vencida
  | "no_due_date"

export const DIAS_PROXIMA = 3

export type InfoVencimiento = {
  status: DeadlineStatus
  daysRemaining: number | null // negativo = días de retraso; null si no aplica (sin fecha o terminada)
}

// FechaVencimiento es una fecha sin hora (AAAA-MM-DD). parseISO la interpreta como medianoche local
// y se compara por días de calendario contra "hoy" en la zona horaria del usuario, así que no hay
// desfases por UTC (una tarea que vence hoy no aparece como vencida a las 21:00).
export function getDeadlineStatus(tarea: Pick<Tarea, "FechaVencimiento" | "Estado">, hoy = new Date()): InfoVencimiento {
  if (tarea.Estado === "Terminado") return { status: "completed", daysRemaining: null }
  if (!tarea.FechaVencimiento) return { status: "no_due_date", daysRemaining: null }

  const dias = differenceInCalendarDays(parseISO(tarea.FechaVencimiento), hoy)
  const status: DeadlineStatus =
    dias < 0 ? "overdue"
    : dias === 0 ? "due_today"
    : dias === 1 ? "due_tomorrow"
    : dias <= DIAS_PROXIMA ? "due_soon"
    : "normal"
  return { status, daysRemaining: dias }
}

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`

// Texto que ve el usuario ("Vencida hace 2 días", "Vence hoy"…). Lo usan la tarjeta y el asistente,
// así el plan del día del LLM dice exactamente lo mismo que el tablero. null = sin fecha.
export function describirVencimiento(tarea: Pick<Tarea, "FechaVencimiento" | "Estado">, hoy = new Date()): string | null {
  if (!tarea.FechaVencimiento) return null
  const { status, daysRemaining: dias } = getDeadlineStatus(tarea, hoy)
  switch (status) {
    case "overdue": return `Vencida hace ${plural(-(dias ?? 0), "día")}`
    case "due_today": return "Vence hoy"
    case "due_tomorrow": return "Vence mañana"
    case "due_soon": return `Vence en ${plural(dias ?? 0, "día")}`
    case "completed": return formatearFecha(tarea.FechaVencimiento, "dd MMM") // terminada: solo la fecha, sin aviso
    default: return `Vence el ${formatearFecha(tarea.FechaVencimiento, "dd MMM")}`
  }
}
