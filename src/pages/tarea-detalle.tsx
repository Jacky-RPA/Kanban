import { useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowLeft } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FormularioTarea } from "@/components/kanban/formulario-tarea"
import { useTareas } from "@/hooks/use-tareas"
import type { DatosTarea } from "@/types/tarea"

const TAREA_VACIA: DatosTarea = {
  Titulo: "",
  Descripcion: "",
  Categoria: "Desarrollo",
  Prioridad: "Media",
  Estado: "Por hacer",
  FechaVencimiento: null,
}

// Pantalla de detalle: /tarea/nueva crea una tarea, /tarea/:id la muestra y edita
export default function TareaDetallePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { obtenerTarea, crearTarea, actualizarTarea, cargando, guardando } = useTareas()

  const esNueva = id === "nueva"
  const tarea = esNueva ? undefined : obtenerTarea(id ?? "")

  // Vuelve al tablero conservando búsqueda/filtro si venimos de él
  const volver = () => (location.key !== "default" ? navigate(-1) : navigate("/"))

  const guardar = async (datos: DatosTarea) => {
    try {
      if (esNueva) {
        await crearTarea(datos)
        toast.success("Tarea creada")
      } else if (tarea) {
        await actualizarTarea(tarea.Id, datos)
        toast.success("Cambios guardados")
      }
      volver()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  if (!esNueva && cargando) {
    return <p className="p-6 text-muted-foreground">Cargando tarea…</p>
  }

  if (!esNueva && !tarea) {
    return (
      <div className="p-6 flex flex-col items-start gap-4">
        <p className="text-muted-foreground">No se encontró la tarea.</p>
        <Button variant="outline" onClick={() => navigate("/")}>Volver al tablero</Button>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 flex flex-col gap-4 max-w-2xl w-full mx-auto">
      <Button variant="ghost" className="self-start" onClick={volver}>
        <ArrowLeft /> Volver al tablero
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>{esNueva ? "Nueva tarea" : "Detalle de la tarea"}</CardTitle>
          {tarea && (
            <CardDescription>
              Creada el {new Date(tarea.FechaCreacion).toLocaleString("es")}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <FormularioTarea
            key={id}
            valoresIniciales={tarea ?? TAREA_VACIA}
            textoGuardar={guardando ? "Guardando…" : esNueva ? "Crear tarea" : "Guardar cambios"}
            guardando={guardando}
            onGuardar={guardar}
            onCancelar={volver}
          />
        </CardContent>
      </Card>
    </div>
  )
}
