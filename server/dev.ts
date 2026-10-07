import "./env.js"
import { app } from "./app.js"

// Servidor de desarrollo. Vite (npm run dev) redirige /api a este puerto.
const PUERTO = Number(process.env.PORT) || 3001

app.listen(PUERTO, () => {
  console.log(`API escuchando en http://localhost:${PUERTO}`)
  if (!process.env.GEMINI_API_KEY) console.warn("⚠ Falta GEMINI_API_KEY en .env: el Asistente IA no funcionará")
})
