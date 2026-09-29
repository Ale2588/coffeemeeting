import { createBrowserRouter, type RouteObject } from "react-router";
import { PublicLayout } from "./layouts/PublicLayout";
import { ComponentsPage } from "./pages/ComponentsPage";
import { HomePage } from "./pages/HomePage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { NotYetAvailablePage } from "./pages/NotYetAvailablePage";

const children: RouteObject[] = [
  { index: true, element: <HomePage /> },
  // Fase 2: iscrizione e accesso.
  { path: "iscriviti", element: <NotYetAvailablePage title="Iscriviti" /> },
  { path: "accedi", element: <NotYetAvailablePage title="Accedi" /> },
  { path: "*", element: <NotFoundPage /> },
];

if (import.meta.env.DEV) {
  children.unshift({ path: "componenti", element: <ComponentsPage /> });
}

export const router = createBrowserRouter([{ element: <PublicLayout />, children }]);
