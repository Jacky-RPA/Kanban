import { useDraggable, useDroppable } from "@dnd-kit/core"
import { cn } from "@/lib/utils"
import type { Estado, Tarea } from "@/types/tarea"
import { TarjetaTarea } from "./tarjeta-tarea"

type ColumnaKanbanProps = {
  estado: Estado
  tareas: Tarea[] // ya filtradas por búsqueda/prioridad y por este estado
  tareaResaltada?: string | null
  onSeleccionar: (tarea: Tarea) => void
  onCambiarEstado: (tarea: Tarea, estado: Estado) => void
}

// Equivalente a una galería de Canvas: muestra las tareas de un solo estado.
// También es zona de destino para soltar tarjetas (su id de drop es el Estado).
export function ColumnaKanban({ estado, tareas, tareaResaltada, onSeleccionar, onCambiarEstado }: ColumnaKanbanProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id: estado })
  const vieneDeOtraColumna = active?.data.current?.estado !== estado

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-3 rounded-xl bg-muted/60 p-3 min-h-40 border-2 border-transparent transition-colors",
        isOver && vieneDeOtraColumna && "border-primary/40 bg-primary/5",
      )}
    >
      <header className="flex items-center justify-between px-1">
        <h2 className="font-semibold">{estado}</h2>
        <span className="text-xs text-muted-foreground rounded-full bg-background px-2 py-0.5">{tareas.length}</span>
      </header>
      {tareas.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          {isOver && vieneDeOtraColumna ? "Suelta aquí" : "Sin tareas"}
        </p>
      ) : (
        tareas.map((t) => (
          <TarjetaArrastrable
            key={t.Id} tarea={t} resaltada={t.Id === tareaResaltada}
            onSeleccionar={onSeleccionar} onCambiarEstado={onCambiarEstado}
          />
        ))
      )}
    </section>
  )
}

// Envuelve la tarjeta para poder arrastrarla con mouse o toque
function TarjetaArrastrable(props: Omit<ColumnaKanbanProps, "estado" | "tareas" | "tareaResaltada"> & { tarea: Tarea; resaltada: boolean }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: props.tarea.Id,
    data: { tarea: props.tarea, estado: props.tarea.Estado },
  })

  return (
    <div ref={setNodeRef} {...listeners} className={cn("touch-manipulation", isDragging && "opacity-40")}>
      <TarjetaTarea {...props} />
    </div>
  )
}
