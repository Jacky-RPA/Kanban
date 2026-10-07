import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { es } from "date-fns/locale"

// Utilidades para las fechas de vencimiento (cadenas AAAA-MM-DD, sin hora)

export const hoyISO = () => format(new Date(), "yyyy-MM-dd")

export const formatearFecha = (fecha: string, patron = "dd MMM yyyy") =>
  format(parseISO(fecha), patron, { locale: es })

// Días desde hoy hasta la fecha (negativo = ya pasó)
export const diasHasta = (fecha: string) => differenceInCalendarDays(parseISO(fecha), new Date())

// "Hoy", "Mañana", "Ayer" o null si la fecha está más lejos
export function etiquetaRelativa(fecha: string): string | null {
  const dias = diasHasta(fecha)
  return dias === 0 ? "Hoy" : dias === 1 ? "Mañana" : dias === -1 ? "Ayer" : null
}

// "Mañana (08 oct 2026)" o "08 oct 2026"
export function describirFecha(fecha: string): string {
  const relativa = etiquetaRelativa(fecha)
  return relativa ? `${relativa} (${formatearFecha(fecha)})` : formatearFecha(fecha)
}
