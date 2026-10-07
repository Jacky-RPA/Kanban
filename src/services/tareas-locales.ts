import type { DatosTarea, Tarea } from "@/types/tarea"

// Respaldo cuando el servidor no tiene base de datos (ver tareas-api.ts): las tareas se guardan
// en el navegador (localStorage) y cada navegador tiene su propio tablero.

const CLAVE = "kanban:tareas"

const ejemplo = (Titulo: string, Descripcion: string, Categoria: DatosTarea["Categoria"], Prioridad: DatosTarea["Prioridad"], Estado: DatosTarea["Estado"]): DatosTarea =>
  ({ Titulo, Descripcion, Categoria, Prioridad, Estado, FechaVencimiento: null })

// Se cargan la primera vez que se abre la app en un navegador
const TAREAS_EJEMPLO: DatosTarea[] = [
  ejemplo("Definir requisitos del tablero", "Reunir con el equipo los requisitos funcionales del Kanban.", "Reunión", "Alta", "Terminado"),
  ejemplo("Diseñar tarjetas de tareas", "Crear el diseño de la tarjeta con título, insignias y descripción.", "Diseño", "Media", "Terminado"),
  ejemplo("Crear pantalla principal", "Construir encabezado, buscador, filtro y las tres columnas.", "Desarrollo", "Alta", "Haciendo"),
  ejemplo("Formulario de nueva tarea", "Permitir registrar tareas nuevas con validación del título.", "Desarrollo", "Alta", "Haciendo"),
  ejemplo("Probar búsqueda y filtros", "Verificar que la búsqueda y el filtro de prioridad afecten las tres columnas.", "Pruebas", "Media", "Por hacer"),
  ejemplo("Documentar el modelo de datos", "Describir los campos de la tarea y cómo se guardan.", "Documentación", "Baja", "Por hacer"),
  ejemplo("Desplegar en Vercel", "Subir el repositorio a GitHub y conectarlo con Vercel.", "Desarrollo", "Media", "Por hacer"),
  ejemplo("Revisión con el cliente", "Presentar el tablero y recoger comentarios de mejora.", "Reunión", "Baja", "Por hacer"),
]

const nueva = (datos: DatosTarea, creada = new Date()): Tarea =>
  ({ ...datos, Id: crypto.randomUUID(), FechaCreacion: creada.toISOString() })

function leer(): Tarea[] {
  let guardadas: string | null = null
  try {
    guardadas = localStorage.getItem(CLAVE)
  } catch {
    throw new Error("El navegador no permite guardar datos (¿modo incógnito o cookies bloqueadas?).")
  }
  if (guardadas) {
    try {
      return JSON.parse(guardadas) as Tarea[]
    } catch {
      // Datos dañados: se vuelve a empezar con los ejemplos
    }
  }
  const ahora = Date.now()
  const iniciales = TAREAS_EJEMPLO.map((d, i) => nueva(d, new Date(ahora + i)))
  guardar(iniciales)
  return iniciales
}

function guardar(tareas: Tarea[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(tareas))
  } catch {
    throw new Error("No se pudieron guardar las tareas en el navegador.")
  }
}

export async function listarTareas(): Promise<Tarea[]> {
  return leer()
}

export async function crearTarea(datos: DatosTarea): Promise<Tarea> {
  const tarea = nueva(datos)
  guardar([...leer(), tarea])
  return tarea
}

export async function actualizarTarea(id: string, cambios: Partial<DatosTarea>): Promise<void> {
  const tareas = leer()
  if (!tareas.some((t) => t.Id === id)) throw new Error("La tarea no existe.")
  guardar(tareas.map((t) => (t.Id === id ? { ...t, ...cambios } : t)))
}
