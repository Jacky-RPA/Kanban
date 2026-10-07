import type { DatosTarea } from "../../src/types/tarea.js"

// Tareas que se cargan la primera vez, cuando el tablero está vacío
const ejemplo = (Titulo: string, Descripcion: string, Categoria: DatosTarea["Categoria"], Prioridad: DatosTarea["Prioridad"], Estado: DatosTarea["Estado"]): DatosTarea =>
  ({ Titulo, Descripcion, Categoria, Prioridad, Estado, FechaVencimiento: null })

export const TAREAS_EJEMPLO: DatosTarea[] = [
  ejemplo("Definir requisitos del tablero", "Reunir con el equipo los requisitos funcionales del Kanban.", "Reunión", "Alta", "Terminado"),
  ejemplo("Diseñar tarjetas de tareas", "Crear el diseño de la tarjeta con título, insignias y descripción.", "Diseño", "Media", "Terminado"),
  ejemplo("Crear pantalla principal", "Construir encabezado, buscador, filtro y las tres columnas.", "Desarrollo", "Alta", "Haciendo"),
  ejemplo("Formulario de nueva tarea", "Permitir registrar tareas nuevas con validación del título.", "Desarrollo", "Alta", "Haciendo"),
  ejemplo("Probar búsqueda y filtros", "Verificar que la búsqueda y el filtro de prioridad afecten las tres columnas.", "Pruebas", "Media", "Por hacer"),
  ejemplo("Documentar el modelo de datos", "Describir los campos de la tarea y la API del backend.", "Documentación", "Baja", "Por hacer"),
  ejemplo("Desplegar en Vercel", "Subir el repositorio a GitHub y conectarlo con Vercel y la base de datos.", "Desarrollo", "Media", "Por hacer"),
  ejemplo("Revisión con el cliente", "Presentar el tablero y recoger comentarios de mejora.", "Reunión", "Baja", "Por hacer"),
]
