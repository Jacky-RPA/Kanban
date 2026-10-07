// Arranca a la vez el backend (puerto 3001) y el frontend de Vite. Ctrl+C detiene ambos.
import { spawn } from "node:child_process"

const procesos = ["dev:api", "dev:web"].map((script) =>
  spawn(`npm run ${script}`, { stdio: "inherit", shell: true })
)

const detener = (codigo = 0) => {
  for (const p of procesos) if (p.exitCode === null) p.kill()
  process.exit(codigo)
}
for (const p of procesos) p.on("exit", (codigo) => detener(codigo ?? 0))
process.on("SIGINT", () => detener())
process.on("SIGTERM", () => detener())
