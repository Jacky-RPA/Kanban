import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Puerto del backend local: el mismo PORT del .env que usa server/dev.ts
  const { PORT = "3001" } = loadEnv(mode, process.cwd(), "")

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      // En desarrollo, las llamadas a /api van al backend local (npm run dev:api)
      proxy: { "/api": `http://localhost:${PORT}` },
    },
  }
})
