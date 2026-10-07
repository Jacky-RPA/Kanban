# Mi Kanban Board

Tablero Kanban con **Asistente IA** (Google Gemini). Frontend en React + Vite y backend en Express, listo para desplegar en **Vercel** con **PostgreSQL**.

```
Navegador (React, src/)
  → /api/tareas            server/tareas/rutas.ts        CRUD de tareas validado con Zod
      → PostgreSQL (DATABASE_URL)   o   .data/tareas.json en local sin base de datos
  → /api/asistente/chat    server/asistente/             Gemini con function calling (la API key nunca llega al navegador)
```

- En **local**, `server/dev.ts` arranca la API en el puerto 3001 y Vite redirige `/api` a ella.
- En **Vercel**, `api/index.ts` expone la misma app de Express como función serverless (ver `vercel.json`).

## Puesta en marcha (local)

Requisitos: Node.js 20.12 o superior.

```bash
npm install
cp .env.example .env      # y completa GEMINI_API_KEY (gratis en https://aistudio.google.com)
npm run dev               # API + frontend → http://localhost:5173
```

Sin `DATABASE_URL`, las tareas se guardan en `.data/tareas.json` (la primera vez se cargan 8 tareas de ejemplo).
Para usar PostgreSQL también en local, pon la cadena de conexión en `DATABASE_URL`: la tabla `tareas` se crea sola.

| Script | Qué hace |
|---|---|
| `npm run dev` | Backend y frontend a la vez |
| `npm run dev:api` / `npm run dev:web` | Cada uno por separado |
| `npm run build` | Comprueba tipos (frontend y backend) y genera `dist/` |
| `npm run lint` | ESLint |

## Variables de entorno

| Variable | Obligatoria | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | Para el asistente | Clave de Google AI Studio |
| `DATABASE_URL` | En Vercel | PostgreSQL (Neon, Supabase…). También se acepta `POSTGRES_URL` |
| `GEMINI_MODEL`, `GEMINI_MODEL_RESPALDO` | No | Modelos de Gemini (por defecto `gemini-flash-lite-latest` y `gemini-flash-latest`) |
| `PORT` | No | Puerto de la API en local (3001) |

## Despliegue

1. **GitHub**: crea un repositorio vacío y sube el proyecto (`.env` y `.data/` están en `.gitignore`).
2. **Vercel** → *Add New → Project* → importa el repositorio. Detecta Vite y usa `vercel.json`; no hay que cambiar nada.
3. **Base de datos**: en el proyecto de Vercel → *Storage → Create Database → Neon* (plan gratuito) y conéctala al proyecto. Esto añade `DATABASE_URL` automáticamente.
4. **Settings → Environment Variables**: añade `GEMINI_API_KEY`.
5. *Deployments → Redeploy*. Comprueba `https://<tu-app>.vercel.app/api/salud`.

## API de tareas

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/tareas` | | `Tarea[]` |
| POST | `/api/tareas` | `DatosTarea` | `Tarea` |
| PATCH | `/api/tareas/:id` | `Partial<DatosTarea>` | `Tarea` |

Los tipos están en `src/types/tarea.ts` y los comparten frontend y backend.

## Asistente IA

Panel de chat ("✨ Asistente IA") que usa Gemini con *function calling* para consultar y modificar las tareas.

- El LLM **nunca** accede a la base de datos: solo puede pedir herramientas del catálogo, el backend valida sus argumentos y el frontend las ejecuta con la API de tareas.
- `create_task` y `update_task` muestran una tarjeta de confirmación; `change_task_status` se ejecuta directamente. Cada herramienta declara su `modo` en `server/asistente/herramientas.ts`.
- Si varias tareas coinciden, el asistente muestra las candidatas para que elijas (`ask_user_to_select_task`).

Para agregar una herramienta: declárala en `server/asistente/herramientas.ts` (esquema Zod + modo) y registra su ejecutor en `src/asistente/herramientas.ts`.
