import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clock, TriangleAlert, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { estadoVecino } from "@/hooks/use-tareas"
import { formatearFecha } from "@/lib/fechas"
import { cn } from "@/lib/utils"
import { describirVencimiento, getDeadlineStatus, type DeadlineStatus } from "@/lib/vencimiento"
import type { Estado, Tarea } from "@/types/tarea"
import { InsigniaCategoria, InsigniaEstado, InsigniaPrioridad } from "./insignias"

type TarjetaTareaProps = {
  tarea: Tarea
  onSeleccionar: (tarea: Tarea) => void
  onCambiarEstado: (tarea: Tarea, estado: Estado) => void
  resaltada?: boolean // se destaca brevemente, p. ej. al llegar desde el asistente IA
  className?: string
}

// Cómo se muestra cada estado de vencimiento: icono, texto, color y acento lateral (solo vencida / hoy)
const estilosVencimiento: Record<DeadlineStatus, { icono: LucideIcon; texto: string; acento?: string }> = {
  overdue: { icono: TriangleAlert, texto: "text-red-600 dark:text-red-400", acento: "before:bg-red-500/80" },
  due_today: { icono: Clock, texto: "text-orange-600 dark:text-orange-400", acento: "before:bg-orange-400/80" },
  due_tomorrow: { icono: CalendarClock, texto: "text-foreground/80 font-medium" },
  due_soon: { icono: CalendarClock, texto: "text-muted-foreground font-medium" },
  normal: { icono: CalendarDays, texto: "text-muted-foreground" },
  completed: { icono: CalendarDays, texto: "text-muted-foreground" },
  no_due_date: { icono: CalendarDays, texto: "text-muted-foreground" },
}

// Tarjeta reutilizable: título, categoría, descripción, prioridad, estado y botones ◀ ▶
export function TarjetaTarea({ tarea, onSeleccionar, onCambiarEstado, resaltada = false, className }: TarjetaTareaProps) {
  const anterior = estadoVecino(tarea.Estado, -1)
  const siguiente = estadoVecino(tarea.Estado, 1)
  const vencimiento = getDeadlineStatus(tarea)
  const estilo = estilosVencimiento[vencimiento.status]
  const IconoVencimiento = estilo.icono

  return (
    <Card
      id={`tarea-${tarea.Id}`}
      className={cn(
        "gap-3 p-4 transition-shadow hover:shadow-md cursor-grab",
        // Acento lateral fino; el overflow-hidden lo recorta a las esquinas redondeadas de la tarjeta
        estilo.acento && "relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-[3px]",
        estilo.acento,
        resaltada && "ring-2 ring-violet-500 shadow-lg shadow-violet-500/20",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSeleccionar(tarea)}
        className="flex flex-col gap-2 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 font-medium leading-snug break-words">{tarea.Titulo}</h3>
          <InsigniaCategoria categoria={tarea.Categoria} />
        </div>
        <p className="text-sm text-muted-foreground line-clamp-3 break-words">{tarea.Descripcion}</p>
        {tarea.FechaVencimiento && (
          <span
            className={cn("inline-flex items-center gap-1 text-xs", estilo.texto)}
            title={`Fecha de vencimiento: ${formatearFecha(tarea.FechaVencimiento)}`}
          >
            <IconoVencimiento className="size-3 shrink-0" />
            {describirVencimiento(tarea)}
          </span>
        )}
      </button>

      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap gap-1">
          <InsigniaPrioridad prioridad={tarea.Prioridad} />
          <InsigniaEstado estado={tarea.Estado} />
        </div>
        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost" size="icon" className="size-7"
            disabled={!anterior}
            onClick={() => anterior && onCambiarEstado(tarea, anterior)}
            aria-label={anterior ? `Mover a ${anterior}` : "Sin columna anterior"}
            title={anterior ? `Mover a ${anterior}` : undefined}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost" size="icon" className="size-7"
            disabled={!siguiente}
            onClick={() => siguiente && onCambiarEstado(tarea, siguiente)}
            aria-label={siguiente ? `Mover a ${siguiente}` : "Sin columna siguiente"}
            title={siguiente ? `Mover a ${siguiente}` : undefined}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </Card>
  )
}
