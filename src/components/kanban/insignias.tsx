import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Categoria, Estado, Prioridad } from "@/types/tarea"

const coloresPrioridad: Record<Prioridad, string> = {
  Alta: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  Media: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Baja: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
}

const coloresEstado: Record<Estado, string> = {
  "Por hacer": "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  Haciendo: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  Terminado: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
}

export function InsigniaCategoria({ categoria }: { categoria: Categoria }) {
  return <Badge variant="outline">{categoria}</Badge>
}

export function InsigniaPrioridad({ prioridad }: { prioridad: Prioridad }) {
  return <Badge className={cn("border-transparent", coloresPrioridad[prioridad])}>{prioridad}</Badge>
}

export function InsigniaEstado({ estado }: { estado: Estado }) {
  return <Badge className={cn("border-transparent", coloresEstado[estado])}>{estado}</Badge>
}
