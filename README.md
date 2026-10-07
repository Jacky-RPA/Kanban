# 📋 Mi Kanban Board

Tablero Kanban para organizar tareas en tres columnas — **Por hacer → Haciendo → Terminado** — con un **Asistente IA** integrado que entiende lenguaje natural: puedes pedirle *"¿qué tengo vencido?"*, *"planifica mi día"* o *"crea tres tareas para preparar la demo"* y trabaja directamente sobre tus tareas reales.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-4169E1?logo=postgresql&logoColor=white)
![Gemini](https://img.shields.io/badge/Google_Gemini-IA-8E75B2?logo=googlegemini&logoColor=white)
![Vercel](https://img.shields.io/badge/Deploy-Vercel-000000?logo=vercel&logoColor=white)

---

## ✨ Funcionalidades

- **Tablero Kanban** con arrastrar y soltar (ratón y pantallas táctiles).
- **Tareas** con título, descripción, categoría, prioridad, estado y fecha de vencimiento.
- **Búsqueda** por texto y **filtro** por prioridad.
- **Avisos de vencimiento** en cada tarjeta (vencida, vence hoy, próxima).
- **Tema claro / oscuro**.
- **Asistente IA** (Google Gemini) que consulta, resume, crea y modifica tareas. Los cambios importantes piden **confirmación** antes de aplicarse.

---

## 🏗️ Arquitectura

Frontend y backend viven en el mismo repositorio y se despliegan juntos en Vercel bajo un único dominio.

```mermaid
flowchart LR
    U([👤 Usuario]) --> FE

    subgraph FE["Frontend · React + Vite (src/)"]
        direction TB
        UI["Tablero Kanban<br/>y formularios"]
        CHAT["Panel del<br/>Asistente IA"]
        HOOK["useTareas<br/>(React Query)"]
        UI --> HOOK
        CHAT --> HOOK
    end

    subgraph BE["Backend · Express (server/)"]
        direction TB
        RT["/api/tareas<br/>CRUD validado con Zod"]
        RA["/api/asistente/chat<br/>prompt + herramientas"]
        REPO{"Repositorio"}
        RT --> REPO
    end

    HOOK -- "fetch /api/tareas" --> RT
    CHAT -- "fetch /api/asistente/chat" --> RA
    REPO -- "producción" --> PG[(PostgreSQL<br/>Neon)]
    REPO -. "local sin BD" .-> JSON[(.data/tareas.json)]
    RA -- "function calling" --> GEM[[Google Gemini]]
```

| Capa | Ubicación | Responsabilidad |
|---|---|---|
| **Frontend** | `src/` | Interfaz, estado del tablero (React Query) y ejecución de las acciones del asistente. |
| **API de tareas** | `server/tareas/` | Valida los datos y los guarda en PostgreSQL, o en un archivo JSON en desarrollo. |
| **API del asistente** | `server/asistente/` | Guarda la API key, construye el prompt, define las herramientas y valida lo que pide el modelo. |
| **Entrada en Vercel** | `api/index.ts` | Expone la app de Express como función serverless. |
| **Tipos compartidos** | `src/types/tarea.ts` | Modelo `Tarea`, usado por frontend y backend. |

### 🤖 Cómo funciona el Asistente IA

El modelo **nunca toca la base de datos**. Solo puede *pedir* herramientas de un catálogo cerrado; el backend valida los argumentos y el frontend las ejecuta con la misma API que usa el tablero.

```mermaid
sequenceDiagram
    actor U as Usuario
    participant F as Frontend
    participant B as Backend
    participant G as Gemini
    participant API as /api/tareas

    U->>F: "Mueve la tarea del login a Terminado"
    F->>B: historial del chat
    B->>G: prompt + catálogo de herramientas
    G-->>B: search_tasks("login")
    B-->>F: llamada validada (Zod)
    F->>API: lee las tareas
    F->>B: resultado de la herramienta
    B->>G: continúa la conversación
    G-->>B: change_task_status(id, "Terminado")
    B-->>F: llamada validada
    F->>API: PATCH /api/tareas/:id
    F-->>U: ✅ Tarea movida y respuesta del asistente
```

| Herramienta | Modo | Qué hace |
|---|---|---|
| `get_tasks`, `get_task`, `search_tasks`, `get_task_summary` | lectura | Consultar y resumir tareas |
| `create_task`, `create_tasks`, `update_task`, `update_tasks` | confirmación | Crear o modificar (el usuario confirma) |
| `change_task_status` | directa | Mover una tarea de columna |
| `ask_user_to_select_task` | interacción | Elegir entre varias tareas parecidas |

---

## 📁 Estructura

```
my-kanban-board/
├── api/index.ts            # Función serverless de Vercel (reutiliza server/app.ts)
├── server/
│   ├── app.ts              # App de Express: rutas y manejo de errores
│   ├── dev.ts              # Servidor de desarrollo (puerto 3001)
│   ├── asistente/          # Prompt, herramientas y conexión con Gemini
│   └── tareas/             # Rutas REST + repositorio PostgreSQL / archivo JSON
├── src/
│   ├── pages/              # Tablero, detalle de tarea, 404
│   ├── components/         # kanban/, asistente/ y ui/ (shadcn)
│   ├── asistente/          # Estado del chat y ejecutores de herramientas
│   ├── hooks/use-tareas.ts # Acceso a datos del tablero
│   ├── services/           # Cliente de la API de tareas
│   └── types/tarea.ts      # Modelo compartido
├── scripts/dev.mjs         # Arranca backend y frontend a la vez
└── vercel.json             # Build, función y rutas para Vercel
```

---

## 🚀 Ejecutar en local

**Requisitos:** Node.js 20.12 o superior.

```bash
git clone https://github.com/<tu-usuario>/my-kanban-board.git
cd my-kanban-board
npm install
cp .env.example .env      # completa GEMINI_API_KEY
npm run dev               # → http://localhost:5173
```

Sin `DATABASE_URL`, las tareas se guardan en `.data/tareas.json` y la primera vez se cargan 8 tareas de ejemplo. Así puedes probar el proyecto sin instalar ninguna base de datos.

| Script | Descripción |
|---|---|
| `npm run dev` | Backend y frontend a la vez |
| `npm run dev:api` / `npm run dev:web` | Cada parte por separado |
| `npm run build` | Comprueba tipos y genera `dist/` |
| `npm run lint` | Revisa el código con ESLint |

### Variables de entorno

| Variable | ¿Obligatoria? | Descripción |
|---|---|---|
| `GEMINI_API_KEY` | Para el asistente | Clave gratuita en [Google AI Studio](https://aistudio.google.com) |
| `DATABASE_URL` | En producción | Cadena de conexión de PostgreSQL (Neon, Supabase…) |
| `GEMINI_MODEL` / `GEMINI_MODEL_RESPALDO` | No | Modelo principal y de respaldo |
| `PORT` | No | Puerto del backend en local (3001) |

> 🔒 La API key solo existe en el backend: nunca se envía al navegador. `.env` está excluido del repositorio.

---

## ☁️ Despliegue en Vercel

1. Importa el repositorio en [vercel.com/new](https://vercel.com/new). Vite y `vercel.json` se detectan solos.
2. En **Storage → Create Database → Neon** crea una base de datos gratuita y conéctala; añade `DATABASE_URL` automáticamente.
3. En **Settings → Environment Variables** añade `GEMINI_API_KEY`.
4. Vuelve a desplegar y comprueba `https://<tu-app>.vercel.app/api/salud`.

La tabla `tareas` se crea sola en la primera petición.

---

## 🔌 API REST

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| `GET` | `/api/tareas` | — | Lista de tareas |
| `POST` | `/api/tareas` | Datos de la tarea | Tarea creada |
| `PATCH` | `/api/tareas/:id` | Campos a cambiar | Tarea actualizada |
| `POST` | `/api/asistente/chat` | Historial del chat | Respuesta del modelo y herramientas pedidas |
| `GET` | `/api/salud` | — | Estado del backend |

---

## 🛠️ Tecnologías

**Frontend:** React 19 · TypeScript · Vite · Tailwind CSS 4 · shadcn/ui · React Router · TanStack Query · Zustand · dnd-kit
**Backend:** Node.js · Express 5 · Zod · postgres.js
**IA:** Google Gemini (function calling)
**Infraestructura:** Vercel · Neon (PostgreSQL)
