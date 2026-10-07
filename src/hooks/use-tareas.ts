import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import * as tareasApi from "@/services/tareas-locales"
import { ESTADOS, type DatosTarea, type Estado, type Tarea } from "@/types/tarea"

const CLAVE = ["tareas"] as const

// Capa de acceso a datos de las tareas (fuente: localStorage del navegador).
// Toda la interfaz usa SOLO este hook, así que cambiar la fuente de datos
// no obliga a tocar pantallas ni componentes.
export function useTareas() {
  const queryClient = useQueryClient()

  const consulta = useQuery({ queryKey: CLAVE, queryFn: tareasApi.listarTareas })
  const tareas = consulta.data ?? []

  const crear = useMutation({
    mutationFn: tareasApi.crearTarea,
    onSuccess: (nueva) => queryClient.setQueryData<Tarea[]>(CLAVE, (prev = []) => [...prev, nueva]),
  })

  // Actualización optimista: la tarjeta se mueve al instante y, si falla el guardado, vuelve a su lugar
  const actualizar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: Partial<DatosTarea> }) =>
      tareasApi.actualizarTarea(id, cambios),
    onMutate: async ({ id, cambios }) => {
      await queryClient.cancelQueries({ queryKey: CLAVE })
      const anterior = queryClient.getQueryData<Tarea[]>(CLAVE)
      queryClient.setQueryData<Tarea[]>(CLAVE, (prev = []) =>
        prev.map((t) => (t.Id === id ? { ...t, ...cambios } : t))
      )
      return { anterior }
    },
    onError: (_error, _vars, contexto) => queryClient.setQueryData(CLAVE, contexto?.anterior),
  })

  return {
    tareas,
    cargando: consulta.isPending,
    error: consulta.error,
    recargar: consulta.refetch,
    obtenerTarea: (id: string) => tareas.find((t) => t.Id === id),
    // Lee las tareas directamente del almacenamiento (sin caché) y actualiza el tablero con ellas
    consultarTareasActuales: () =>
      queryClient.fetchQuery({ queryKey: CLAVE, queryFn: tareasApi.listarTareas, staleTime: 0 }),
    crearTarea: (datos: DatosTarea) => crear.mutateAsync(datos),
    actualizarTarea: (id: string, cambios: Partial<DatosTarea>) => actualizar.mutateAsync({ id, cambios }),
    cambiarEstado: (id: string, estado: Estado) => actualizar.mutateAsync({ id, cambios: { Estado: estado } }),
    guardando: crear.isPending || actualizar.isPending,
  }
}

// Devuelve el estado anterior o siguiente en el flujo Por hacer → Haciendo → Terminado
export function estadoVecino(estado: Estado, direccion: -1 | 1): Estado | undefined {
  return ESTADOS[ESTADOS.indexOf(estado) + direccion]
}
