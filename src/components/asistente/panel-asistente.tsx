import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react"
import { CalendarDays, Plus, SendHorizontal, Sparkles, SquarePen, WandSparkles, X, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useAsistente } from "@/asistente/use-asistente"
import {
  AvatarAsistente, Escribiendo, MensajeAsistente, MensajeError, MensajeUsuario, TarjetaAccion, TarjetaSeleccion,
} from "./elementos-chat"

// Opciones iniciales: las capacidades principales del agente. "enviar" manda el mensaje al instante;
// "escribir" deja el texto preparado para que el usuario lo complete con sus propias palabras.
const SUGERENCIAS: { icono: LucideIcon; texto: string; enviar?: string; escribir?: string }[] = [
  { icono: Sparkles, texto: "¿Qué debería hacer primero?", enviar: "¿Qué debería hacer primero?" },
  { icono: CalendarDays, texto: "Planifica mi día", enviar: "Planifica mi día." },
  { icono: WandSparkles, texto: "Organiza mis tareas", enviar: "Organiza mis tareas." },
  { icono: Plus, texto: "Crear tareas con IA", escribir: "Crea tareas a partir de esto: " },
]

type PanelAsistenteProps = {
  onVerTarea: (id: string) => void
}

// Panel lateral de chat. Se superpone al tablero por la derecha (pantalla completa en móviles).
export function PanelAsistente({ onVerTarea }: PanelAsistenteProps) {
  const asistente = useAsistente()
  const { abierto, elementos, cargando, esperandoUsuario, cerrar } = asistente
  const [texto, setTexto] = useState("")
  const finRef = useRef<HTMLDivElement>(null)
  const entradaRef = useRef<HTMLTextAreaElement>(null)

  // Desplaza al último mensaje cuando llega algo nuevo
  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [elementos.length, cargando])

  useEffect(() => {
    if (!abierto) return
    entradaRef.current?.focus()
    const alPresionarTecla = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") cerrar()
    }
    document.addEventListener("keydown", alPresionarTecla)
    return () => document.removeEventListener("keydown", alPresionarTecla)
  }, [abierto, cerrar])

  if (!abierto) return null

  const bloqueado = cargando || esperandoUsuario

  // Deja el texto en el campo con el cursor al final, listo para seguir escribiendo
  const prepararTexto = (inicio: string) => {
    setTexto(inicio)
    requestAnimationFrame(() => {
      const campo = entradaRef.current
      campo?.focus()
      campo?.setSelectionRange(inicio.length, inicio.length)
    })
  }

  const enviar = (e?: FormEvent) => {
    e?.preventDefault()
    if (!texto.trim() || bloqueado) return
    asistente.enviarMensaje(texto)
    setTexto("")
  }

  // Enter envía; Shift+Enter hace salto de línea
  const alEscribir = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      enviar()
    }
  }

  return (
    <aside
      aria-label="Asistente IA"
      className="fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l bg-background shadow-xl animate-in slide-in-from-right duration-200 sm:w-[420px]"
    >
      <header className="flex items-center gap-3 border-b px-4 py-3">
        <AvatarAsistente />
        <div className="flex-1">
          <h2 className="font-semibold leading-tight">Asistente IA</h2>
          <p className="text-xs text-muted-foreground">Te ayudo a gestionar tus tareas</p>
        </div>
        <Button
          variant="ghost" size="icon" className="size-8"
          onClick={asistente.nuevaConversacion} disabled={elementos.length === 0}
          aria-label="Nueva conversación" title="Nueva conversación"
        >
          <SquarePen />
        </Button>
        <Button variant="ghost" size="icon" className="size-8" onClick={cerrar} aria-label="Cerrar asistente" title="Cerrar">
          <X />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {elementos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <AvatarAsistente />
            <div>
              <p className="font-medium">¿En qué te ayudo hoy?</p>
              <p className="text-sm text-muted-foreground">Prioriza, planifica y organiza tu trabajo, o cuéntame lo que tienes pendiente y lo convierto en tareas.</p>
            </div>
            <div className="flex w-full max-w-xs flex-col gap-2">
              {SUGERENCIAS.map(({ icono: Icono, texto: etiqueta, enviar: mensaje, escribir }) => (
                <Button
                  key={etiqueta} variant="outline" size="sm" className="h-auto justify-start whitespace-normal py-2 text-left"
                  onClick={() => (mensaje ? asistente.enviarMensaje(mensaje) : prepararTexto(escribir ?? ""))}
                >
                  <Icono className="text-violet-600 dark:text-violet-400" /> {etiqueta}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {elementos.map((el) => {
              switch (el.tipo) {
                case "usuario":
                  return <MensajeUsuario key={el.id} texto={el.texto} hora={el.hora} />
                case "asistente":
                  return <MensajeAsistente key={el.id} texto={el.texto} hora={el.hora} />
                case "error":
                  return <MensajeError key={el.id} elemento={el} onReintentar={() => asistente.reintentar(el.id)} />
                case "accion":
                  return (
                    <TarjetaAccion
                      key={el.id} elemento={el} onVerTarea={onVerTarea}
                      onConfirmar={() => asistente.ejecutarAccion(el.id)}
                      onCancelar={() => asistente.cancelarAccion(el.id)}
                    />
                  )
                case "seleccion":
                  return <TarjetaSeleccion key={el.id} elemento={el} onElegir={(id) => asistente.elegirTarea(el.id, id)} />
              }
            })}
            {cargando && <Escribiendo />}
          </div>
        )}
        <div ref={finRef} />
      </div>

      <form onSubmit={enviar} className="flex flex-col gap-1.5 border-t p-3">
        {esperandoUsuario && (
          <p className="text-xs text-muted-foreground">Responde a la tarjeta de arriba para continuar.</p>
        )}
        <div className="flex items-end gap-2">
          <Textarea
            ref={entradaRef}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={alEscribir}
            placeholder="Escribe un mensaje…"
            aria-label="Mensaje para el asistente"
            rows={1}
            maxLength={4000}
            className="max-h-32 min-h-9 resize-none"
          />
          <Button type="submit" size="icon" disabled={bloqueado || !texto.trim()} aria-label="Enviar">
            <SendHorizontal />
          </Button>
        </div>
      </form>
    </aside>
  )
}
