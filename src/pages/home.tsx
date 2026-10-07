import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  DndContext, DragOverlay, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core"
import { Plus, Search, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { ModeToggle } from "@/components/mode-toggle"
import { ColumnaKanban } from "@/components/kanban/columna-kanban"
import { FiltroPrioridad } from "@/components/kanban/filtro-prioridad"
import { TarjetaTarea } from "@/components/kanban/tarjeta-tarea"
import { PanelAsistente } from "@/components/asistente/panel-asistente"
import { useAsistente } from "@/asistente/use-asistente"
import { cn } from "@/lib/utils"
import { useTareas } from "@/hooks/use-tareas"
import { ESTADOS, PRIORIDADES, type Estado, type Prioridad, type Tarea } from "@/types/tarea"

// Pantalla principal: encabezado, buscador, filtro de prioridad y las tres columnas
export default function HomePage() {
  const navigate = useNavigate()
  const { tareas, cargando, error, recargar, cambiarEstado } = useTareas()
  const { abierto: asistenteAbierto, alternar: alternarAsistente, cerrar: cerrarAsistente } = useAsistente()

  // Búsqueda y filtro se guardan en la URL para conservarlos al volver del detalle
  const [params, setParams] = useSearchParams()
  const busqueda = params.get("q") ?? ""
  const paramPrioridad = params.get("prioridad")
  const filtroPrioridad = PRIORIDADES.find((p) => p === paramPrioridad) ?? null // null = todas

  const actualizarParam = (clave: string, valor: string | null) =>
    setParams((p) => {
      if (!valor) p.delete(clave)
      else p.set(clave, valor)
      return p
    }, { replace: true })

  // 1) Búsqueda por texto
  const tareasPorBusqueda = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return tareas
    return tareas.filter((t) =>
      [t.Titulo, t.Descripcion, t.Categoria].some((campo) => campo.toLowerCase().includes(texto))
    )
  }, [tareas, busqueda])

  // Cuántas tareas hay de cada prioridad (se muestra en los botones del filtro)
  const conteosPrioridad = useMemo(
    () => Object.fromEntries(
      PRIORIDADES.map((p) => [p, tareasPorBusqueda.filter((t) => t.Prioridad === p).length])
    ) as Record<Prioridad, number>,
    [tareasPorBusqueda]
  )

  // 2) Filtro de prioridad. El resultado se aplica a las tres columnas
  const tareasFiltradas = filtroPrioridad
    ? tareasPorBusqueda.filter((t) => t.Prioridad === filtroPrioridad)
    : tareasPorBusqueda

  const abrirTarea = (tarea: Tarea) => navigate(`/tarea/${tarea.Id}`)

  // "Ver en el tablero" desde el asistente: quita búsqueda y filtro, y destaca la tarjeta unos segundos
  const [tareaResaltada, setTareaResaltada] = useState<string | null>(null)
  const verTarea = (id: string) => {
    setParams((p) => { p.delete("q"); p.delete("prioridad"); return p }, { replace: true })
    if (window.matchMedia("(max-width: 639px)").matches) cerrarAsistente() // en móvil el panel tapa el tablero
    setTareaResaltada(id)
  }
  useEffect(() => {
    if (!tareaResaltada) return
    document.getElementById(`tarea-${tareaResaltada}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    const temporizador = setTimeout(() => setTareaResaltada(null), 2500)
    return () => clearTimeout(temporizador)
  }, [tareaResaltada])

  const moverTarea = async (tarea: Tarea, estado: Estado) => {
    try {
      await cambiarEstado(tarea.Id, estado)
      toast.success(`"${tarea.Titulo}" movida a ${estado}`)
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  // Arrastrar y soltar: el arrastre empieza tras mover 6px (mouse) o mantener 200ms (táctil),
  // así un clic o toque normal sigue abriendo la tarea y los botones ◀ ▶ siguen funcionando
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )
  const [tareaArrastrada, setTareaArrastrada] = useState<Tarea | null>(null)

  const alIniciarArrastre = ({ active }: DragStartEvent) =>
    setTareaArrastrada((active.data.current?.tarea as Tarea) ?? null)

  const alSoltar = ({ active, over }: DragEndEvent) => {
    setTareaArrastrada(null)
    const tarea = active.data.current?.tarea as Tarea | undefined
    const destino = over?.id as Estado | undefined
    if (tarea && destino && destino !== tarea.Estado) moverTarea(tarea, destino)
  }

  return (
    <div className={cn("flex flex-col gap-6 p-4 sm:p-6", asistenteAbierto && "lg:mr-[420px]")}>
      {/* Encabezado */}
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tablero de tareas</h1>
          <p className="text-sm text-muted-foreground">
            {cargando ? "Cargando tareas…" : `${tareas.length} tareas en total`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => navigate("/tarea/nueva")}>
            <Plus /> Nueva tarea
          </Button>
          <ModeToggle />
          <Button
            variant="outline"
            onClick={alternarAsistente}
            aria-pressed={asistenteAbierto}
            className={cn(asistenteAbierto && "border-violet-500/60 bg-violet-500/10")}
          >
            <Sparkles className="text-violet-600 dark:text-violet-400" />
            <span className="hidden sm:inline">Asistente IA</span>
          </Button>
        </div>
      </header>

      {/* Buscador y filtro de prioridad */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Buscar tareas"
            placeholder="Buscar por título, descripción o categoría…"
            className="pl-8"
            value={busqueda}
            onChange={(e) => actualizarParam("q", e.target.value)}
          />
        </div>
        <FiltroPrioridad
          valor={filtroPrioridad}
          conteos={conteosPrioridad}
          onCambiar={(p) => actualizarParam("prioridad", p)}
        />
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm">
          <span>{error.message}</span>
          <Button variant="outline" size="sm" onClick={() => recargar()}>Reintentar</Button>
        </div>
      )}

      {cargando && (
        <div className="grid gap-4 md:grid-cols-3">
          {ESTADOS.map((e) => (
            <div key={e} className="flex flex-col gap-3 rounded-xl bg-muted/60 p-3">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      )}

      {/* Tres columnas: cada una muestra solo las tareas de su Estado */}
      {!cargando && !error && <DndContext
        sensors={sensores}
        onDragStart={alIniciarArrastre}
        onDragEnd={alSoltar}
        onDragCancel={() => setTareaArrastrada(null)}
      >
        <div className="grid gap-4 md:grid-cols-3 items-stretch">
          {ESTADOS.map((estado) => (
            <ColumnaKanban
              key={estado}
              estado={estado}
              tareas={tareasFiltradas.filter((t) => t.Estado === estado)}
              tareaResaltada={tareaResaltada}
              onSeleccionar={abrirTarea}
              onCambiarEstado={moverTarea}
            />
          ))}
        </div>

        {/* Copia de la tarjeta que sigue al puntero mientras se arrastra */}
        <DragOverlay>
          {tareaArrastrada && (
            <TarjetaTarea
              tarea={tareaArrastrada}
              onSeleccionar={() => {}}
              onCambiarEstado={() => {}}
              className="cursor-grabbing rotate-2 shadow-xl"
            />
          )}
        </DragOverlay>
      </DndContext>}

      <PanelAsistente onVerTarea={verTarea} />
    </div>
  )
}
