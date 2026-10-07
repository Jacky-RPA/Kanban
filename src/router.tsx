import { createBrowserRouter } from "react-router-dom"
import Layout from "@/pages/_layout"
import HomePage from "@/pages/home"
import NotFoundPage from "@/pages/not-found"
import TareaDetallePage from "@/pages/tarea-detalle"

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout showHeader={false} />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "tarea/:id", element: <TareaDetallePage /> }, // "nueva" o el Id de la tarea
    ],
  },
])
