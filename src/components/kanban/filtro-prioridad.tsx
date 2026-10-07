import { useEffect } from "react"
import { cn } from "@/lib/utils"
import { PRIORIDADES, type Prioridad } from "@/types/tarea"

const estilos: Record<Prioridad, { inactivo: string; activo: string; punto: string }> = {
  Alta: {
    inactivo: "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/60",
    activo: "border-red-500 bg-red-500 text-white shadow-md shadow-red-500/30 dark:border-red-600 dark:bg-red-600",
    punto: "bg-red-500",
  },
  Media: {
    inactivo: "border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900 dark:text-amber-300 dark:hover:bg-amber-950/60",
    activo: "border-amber-400 bg-amber-400 text-amber-950 shadow-md shadow-amber-400/30 dark:border-amber-500 dark:bg-amber-500",
    punto: "bg-amber-400",
  },
  Baja: {
    inactivo: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
    activo: "border-emerald-500 bg-emerald-500 text-white shadow-md shadow-emerald-500/30 dark:border-emerald-600 dark:bg-emerald-600",
    punto: "bg-emerald-500",
  },
}

type FiltroPrioridadProps = {
  valor: Prioridad | null // null = todas
  conteos: Record<Prioridad, number>
  onCambiar: (valor: Prioridad | null) => void
}

// Elementos donde un clic NO debe quitar el filtro (tarjetas, botones, campos, menús…)
const ZONAS_INTERACTIVAS =
  "button, a, input, textarea, select, [role=combobox], [role=menu], [role=dialog], [data-slot=card], [data-radix-popper-content-wrapper]"

// Filtro de prioridad en botones de color. Se quita (muestra todas) al:
// - hacer clic otra vez en el botón activo
// - hacer clic en un espacio vacío fuera del filtro
// - presionar Escape
export function FiltroPrioridad({ valor, conteos, onCambiar }: FiltroPrioridadProps) {
  useEffect(() => {
    if (!valor) return

    const alHacerClic = (e: PointerEvent) => {
      const destino = e.target as Element | null
      if (!destino?.closest(ZONAS_INTERACTIVAS)) onCambiar(null)
    }
    const alPresionarTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCambiar(null)
    }

    document.addEventListener("pointerdown", alHacerClic)
    document.addEventListener("keydown", alPresionarTecla)
    return () => {
      document.removeEventListener("pointerdown", alHacerClic)
      document.removeEventListener("keydown", alPresionarTecla)
    }
  }, [valor, onCambiar])

  return (
    <div role="group" aria-label="Filtrar por prioridad" className="flex gap-2">
      {PRIORIDADES.map((p) => {
        const activo = valor === p
        return (
          <button
            key={p}
            type="button"
            aria-pressed={activo}
            onClick={() => onCambiar(activo ? null : p)}
            className={cn(
              "flex flex-1 sm:flex-none items-center justify-center gap-2 h-9 rounded-full border px-4 text-sm font-medium",
              "transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              activo ? estilos[p].activo : cn("bg-background", estilos[p].inactivo),
            )}
          >
            <span className={cn("size-2 rounded-full", activo ? "bg-current" : estilos[p].punto)} />
            {p}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", activo ? "bg-black/15" : "bg-muted text-muted-foreground")}>
              {conteos[p]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
