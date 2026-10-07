import type { ReactNode } from "react"
import { ArrowRight, CalendarDays, Check, CircleAlert, CircleCheck, Flag, Loader2, RotateCcw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InsigniaCategoria, InsigniaEstado, InsigniaPrioridad } from "@/components/kanban/insignias"
import { describirFecha } from "@/lib/fechas"
import { describirVencimiento } from "@/lib/vencimiento"
import { cn } from "@/lib/utils"
import type { DatosTarea, Tarea } from "@/types/tarea"
import type { ElementoChat, PropuestaAccion } from "@/asistente/tipos"

type ElementoDe<T extends ElementoChat["tipo"]> = Extract<ElementoChat, { tipo: T }>

// ---------- Piezas comunes ----------

export function AvatarAsistente() {
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-violet-600 dark:text-violet-400">
      <Sparkles className="size-4" />
    </div>
  )
}

function Hora({ hora, className }: { hora: string; className?: string }) {
  return <span className={cn("text-[10px] text-muted-foreground", className)}>{hora}</span>
}

// Fila de un mensaje del asistente: avatar a la izquierda y contenido
function FilaAsistente({ hora, children }: { hora: string; children: ReactNode }) {
  return (
    <div className="flex gap-2">
      <AvatarAsistente />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {children}
        <Hora hora={hora} />
      </div>
    </div>
  )
}

export function MensajeUsuario({ texto, hora }: { texto: string; hora: string }) {
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        {texto}
      </div>
      <Hora hora={hora} />
    </div>
  )
}

export function MensajeAsistente({ texto, hora }: { texto: string; hora: string }) {
  return (
    <FilaAsistente hora={hora}>
      <div className="w-fit max-w-full whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm bg-muted px-3.5 py-2 text-sm">
        {texto}
      </div>
    </FilaAsistente>
  )
}

export function MensajeError({ elemento, onReintentar }: { elemento: ElementoDe<"error">; onReintentar: () => void }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <div className="flex flex-1 flex-col gap-2">
        <span>{elemento.texto}</span>
        {elemento.reintentable && (
          <Button variant="outline" size="sm" className="self-start" onClick={onReintentar}>
            <RotateCcw /> Reintentar
          </Button>
        )}
      </div>
    </div>
  )
}

export function Escribiendo() {
  return (
    <div className="flex items-center gap-2" role="status" aria-label="El asistente está pensando">
      <AvatarAsistente />
      <div className="flex gap-1 rounded-2xl rounded-tl-sm bg-muted px-3.5 py-3">
        {[0, 150, 300].map((retraso) => (
          <span key={retraso} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${retraso}ms` }} />
        ))}
      </div>
    </div>
  )
}

// ---------- Tarjeta con los datos de una tarea ----------

function Campo({ icono, etiqueta, children }: { icono: ReactNode; etiqueta: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground [&>svg]:size-4">{icono}</span>
      <span className="text-muted-foreground">{etiqueta}:</span>
      {children}
    </div>
  )
}

function DetalleTarea({ datos }: { datos: DatosTarea }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="font-medium leading-snug">{datos.Titulo}</h4>
        <InsigniaCategoria categoria={datos.Categoria} />
      </div>
      {datos.Descripcion && <p className="text-sm text-muted-foreground line-clamp-3">{datos.Descripcion}</p>}
      <Campo icono={<CalendarDays />} etiqueta="Fecha">
        <span>{datos.FechaVencimiento ? describirFecha(datos.FechaVencimiento) : "Sin fecha"}</span>
      </Campo>
      <Campo icono={<Flag />} etiqueta="Prioridad"><InsigniaPrioridad prioridad={datos.Prioridad} /></Campo>
      <Campo icono={<CircleCheck />} etiqueta="Estado"><InsigniaEstado estado={datos.Estado} /></Campo>
    </div>
  )
}

// ---------- Cambios propuestos (antes → después) ----------

const NOMBRES_CAMPO: Record<keyof DatosTarea, string> = {
  Titulo: "Título", Descripcion: "Descripción", Categoria: "Categoría", Prioridad: "Prioridad", Estado: "Estado", FechaVencimiento: "Fecha",
}

function valorLegible(campo: keyof DatosTarea, valor: DatosTarea[keyof DatosTarea]): ReactNode {
  if (campo === "Prioridad") return <InsigniaPrioridad prioridad={valor as Tarea["Prioridad"]} />
  if (campo === "Estado") return <InsigniaEstado estado={valor as Tarea["Estado"]} />
  if (campo === "FechaVencimiento") return valor ? describirFecha(valor as string) : "Sin fecha"
  return valor ? String(valor) : <em className="text-muted-foreground">vacío</em>
}

function ListaCambios({ tarea, cambios, motivo }: { tarea: Tarea; cambios: Partial<DatosTarea>; motivo?: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-lg border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <h4 className="min-w-0 font-medium leading-snug break-words">{tarea.Titulo}</h4>
        <InsigniaCategoria categoria={tarea.Categoria} />
      </div>
      {motivo && <p className="text-xs text-muted-foreground">{motivo}</p>}
      {(Object.keys(cambios) as (keyof DatosTarea)[]).map((campo) => (
        <div key={campo} className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">{NOMBRES_CAMPO[campo]}</span>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground line-through decoration-muted-foreground/60 line-clamp-2">{valorLegible(campo, tarea[campo])}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium">{valorLegible(campo, cambios[campo] as DatosTarea[typeof campo])}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------- Tarea en una lista (propuestas con varias tareas) ----------

function FilaTareaCompacta({ datos, onVer }: { datos: DatosTarea; onVer?: () => void }) {
  const vencimiento = describirVencimiento(datos)
  const contenido = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 text-sm font-medium leading-snug break-words">{datos.Titulo}</span>
        <InsigniaCategoria categoria={datos.Categoria} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <InsigniaPrioridad prioridad={datos.Prioridad} />
        <InsigniaEstado estado={datos.Estado} />
        {vencimiento && <span className="ml-1 text-xs text-muted-foreground">{vencimiento}</span>}
      </div>
    </>
  )
  const clases = "flex flex-col gap-2 rounded-lg border bg-card p-3 text-left"
  return onVer ? (
    <button
      type="button" onClick={onVer} title="Ver en el tablero"
      className={cn(clases, "transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
    >
      {contenido}
    </button>
  ) : (
    <div className={clases}>{contenido}</div>
  )
}

// ---------- Acción (crear / actualizar / mover, una o varias tareas) ----------

function textosAccion(p: PropuestaAccion) {
  switch (p.tipo) {
    case "crear": return { pregunta: "He preparado la siguiente tarea, ¿deseas crearla?", boton: "Crear tarea", hecho: "¡Tarea creada correctamente!" }
    case "crear_varias": {
      const n = p.datos.length
      return { pregunta: `He identificado ${n} tareas:`, boton: `Crear ${n} tareas`, hecho: `${n} tareas creadas` }
    }
    case "actualizar": return { pregunta: "Estos son los cambios propuestos, ¿los aplico?", boton: "Guardar cambios", hecho: "Tarea actualizada" }
    case "actualizar_varias": return { pregunta: "Cambios propuestos:", boton: "Aplicar cambios", hecho: "Cambios aplicados" }
    case "estado": return { pregunta: "¿Muevo esta tarea?", boton: "Mover tarea", hecho: "He actualizado la tarea" }
  }
}

type TarjetaAccionProps = {
  elemento: ElementoDe<"accion">
  onConfirmar: () => void
  onCancelar: () => void
  onVerTarea: (id: string) => void
}

export function TarjetaAccion({ elemento, onConfirmar, onCancelar, onVerTarea }: TarjetaAccionProps) {
  const { propuesta, estado, resultados } = elemento
  const textos = textosAccion(propuesta)
  const hecha = estado === "hecha"
  const esLote = propuesta.tipo === "crear_varias" || propuesta.tipo === "actualizar_varias"
  const resultado = !esLote ? resultados?.[0] : undefined

  const contenido =
    hecha && resultado ? <DetalleTarea datos={resultado} />
    : propuesta.tipo === "crear" ? <DetalleTarea datos={propuesta.datos} />
    : propuesta.tipo === "crear_varias" ? (
      <div className="flex flex-col gap-2">
        {hecha && resultados
          ? resultados.map((t) => <FilaTareaCompacta key={t.Id} datos={t} onVer={() => onVerTarea(t.Id)} />)
          : propuesta.datos.map((d) => <FilaTareaCompacta key={d.Titulo} datos={d} />)}
      </div>
    )
    : propuesta.tipo === "actualizar_varias" ? (
      <div className="flex flex-col gap-2">
        {propuesta.cambios.map((c) => <ListaCambios key={c.tarea.Id} tarea={c.tarea} cambios={c.cambios} motivo={c.motivo} />)}
      </div>
    )
    : propuesta.tipo === "actualizar" ? <ListaCambios tarea={propuesta.tarea} cambios={propuesta.cambios} />
    : <ListaCambios tarea={propuesta.tarea} cambios={{ Estado: propuesta.estado }} />

  return (
    <FilaAsistente hora={elemento.hora}>
      <div
        className={cn(
          "flex flex-col gap-3 rounded-2xl rounded-tl-sm border p-3",
          hecha ? "border-green-500/30 bg-green-500/5" : "bg-muted/60",
        )}
      >
        <p className="flex items-center gap-2 text-sm font-medium">
          {hecha && <CircleCheck className="size-4 text-green-600 dark:text-green-400" />}
          {hecha ? textos.hecho : estado === "cancelada" ? "Acción cancelada" : estado === "fallida" ? "No se pudo completar" : textos.pregunta}
        </p>

        <div className={cn(estado === "cancelada" && "opacity-60")}>{contenido}</div>

        {estado === "fallida" && <p className="text-sm text-destructive">{elemento.error}</p>}

        {(estado === "pendiente" || estado === "ejecutando") && (
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onCancelar} disabled={estado === "ejecutando"}>
              <X /> Cancelar
            </Button>
            <Button size="sm" onClick={onConfirmar} disabled={estado === "ejecutando"}>
              {estado === "ejecutando" ? <Loader2 className="animate-spin" /> : <Check />} {textos.boton}
            </Button>
          </div>
        )}

        {hecha && resultado && (
          <Button size="sm" variant="outline" className="self-end" onClick={() => onVerTarea(resultado.Id)}>
            Ver en el tablero
          </Button>
        )}
      </div>
    </FilaAsistente>
  )
}

// ---------- Elegir entre varias tareas ----------

type TarjetaSeleccionProps = {
  elemento: ElementoDe<"seleccion">
  onElegir: (tareaId: string | null) => void
}

export function TarjetaSeleccion({ elemento, onElegir }: TarjetaSeleccionProps) {
  const respondida = elemento.elegida !== undefined
  return (
    <FilaAsistente hora={elemento.hora}>
      <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm bg-muted/60 p-3">
        <p className="text-sm">{elemento.pregunta}</p>
        {elemento.candidatas.map((t) => {
          const elegida = elemento.elegida === t.Id
          return (
            <button
              key={t.Id}
              type="button"
              disabled={respondida}
              onClick={() => onElegir(t.Id)}
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-card p-3 text-left transition-colors",
                "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default",
                elegida && "border-primary ring-1 ring-primary",
                respondida && !elegida && "opacity-50 hover:border-border",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug">{t.Titulo}</span>
                <InsigniaCategoria categoria={t.Categoria} />
              </div>
              <div className="flex flex-wrap gap-1">
                <InsigniaPrioridad prioridad={t.Prioridad} />
                <InsigniaEstado estado={t.Estado} />
              </div>
            </button>
          )
        })}
        <Button
          variant="ghost" size="sm" className="self-start"
          disabled={respondida}
          onClick={() => onElegir(null)}
        >
          {elemento.elegida === null ? "Ninguna de estas ✓" : "Ninguna de estas"}
        </Button>
      </div>
    </FilaAsistente>
  )
}
