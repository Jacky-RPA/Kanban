import type { ContextoUsuario, MensajeApi, RespuestaChat } from "./tipos"

// El backend (server/) se sirve en el mismo dominio. La API key vive solo allí, nunca en el frontend.

export async function enviarConversacion(mensajes: MensajeApi[], contexto: ContextoUsuario): Promise<RespuestaChat> {
  let respuesta: Response
  try {
    respuesta = await fetch("/api/asistente/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensajes, contexto }),
    })
  } catch {
    throw new Error("No se pudo conectar con el asistente. Comprueba que el servidor esté en marcha (npm run dev).")
  }

  const cuerpo = await respuesta.json().catch(() => null)
  if (!respuesta.ok) {
    throw new Error((cuerpo as { error?: string } | null)?.error ?? `El asistente respondió con un error (${respuesta.status}).`)
  }
  return cuerpo as RespuestaChat
}
