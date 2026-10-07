import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CATEGORIAS, ESTADOS, PRIORIDADES, type DatosTarea } from "@/types/tarea"

type FormularioTareaProps = {
  valoresIniciales: DatosTarea
  textoGuardar: string
  guardando?: boolean
  onGuardar: (datos: DatosTarea) => void
  onCancelar: () => void
}

// Formulario reutilizable para crear y editar tareas
export function FormularioTarea({ valoresIniciales, textoGuardar, guardando = false, onGuardar, onCancelar }: FormularioTareaProps) {
  const [datos, setDatos] = useState<DatosTarea>(valoresIniciales)
  const [errorTitulo, setErrorTitulo] = useState(false)

  const cambiar = <K extends keyof DatosTarea>(campo: K, valor: DatosTarea[K]) =>
    setDatos((d) => ({ ...d, [campo]: valor }))

  const enviar = (e: FormEvent) => {
    e.preventDefault()
    const titulo = datos.Titulo.trim()
    if (!titulo) return setErrorTitulo(true)
    onGuardar({ ...datos, Titulo: titulo, Descripcion: datos.Descripcion.trim() })
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Label htmlFor="txtTitulo">Título *</Label>
        <Input
          id="txtTitulo" autoFocus value={datos.Titulo} aria-invalid={errorTitulo}
          onChange={(e) => { cambiar("Titulo", e.target.value); setErrorTitulo(false) }}
        />
        {errorTitulo && <p className="text-sm text-destructive">El título es obligatorio.</p>}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="txtDescripcion">Descripción</Label>
        <Textarea id="txtDescripcion" rows={4} value={datos.Descripcion} onChange={(e) => cambiar("Descripcion", e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="ddCategoria">Categoría</Label>
          <Select value={datos.Categoria} onValueChange={(v) => cambiar("Categoria", v as DatosTarea["Categoria"])}>
            <SelectTrigger id="ddCategoria" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIAS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ddPrioridad">Prioridad</Label>
          <Select value={datos.Prioridad} onValueChange={(v) => cambiar("Prioridad", v as DatosTarea["Prioridad"])}>
            <SelectTrigger id="ddPrioridad" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORIDADES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ddEstado">Estado</Label>
          <Select value={datos.Estado} onValueChange={(v) => cambiar("Estado", v as DatosTarea["Estado"])}>
            <SelectTrigger id="ddEstado" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{ESTADOS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:max-w-[calc((100%-2rem)/3)]">
        <Label htmlFor="txtFechaVencimiento">Fecha de vencimiento</Label>
        <Input
          id="txtFechaVencimiento" type="date" value={datos.FechaVencimiento ?? ""}
          onChange={(e) => cambiar("FechaVencimiento", e.target.value || null)}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancelar}>Cancelar</Button>
        <Button type="submit" disabled={guardando}>{textoGuardar}</Button>
      </div>
    </form>
  )
}
