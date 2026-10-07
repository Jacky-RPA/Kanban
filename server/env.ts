import { existsSync } from "node:fs"

// Solo en local: carga el .env de la raíz en process.env (debe importarse antes que cualquier otro módulo).
// En Vercel las variables se configuran en el panel del proyecto.
if (existsSync(".env")) process.loadEnvFile(".env")
