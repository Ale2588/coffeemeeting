import { createBrowserRouter, type RouteObject } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { PublicLayout } from "./layouts/PublicLayout";
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ComponentsPage } from "./pages/ComponentsPage";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/LoginPage";
import { MemberPage } from "./pages/MemberPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { PreferencesPage } from "./pages/PreferencesPage";
import { SignupPage } from "./pages/SignupPage";

const children: RouteObject[] = [
  { index: true, element: <HomePage /> },
  { path: "iscriviti", element: <SignupPage /> },
  { path: "accedi", element: <LoginPage /> },
  { path: "auth/callback", element: <AuthCallbackPage /> },
  {
    element: <RequireAuth />,
    children: [
      { path: "account", element: <MemberPage /> },
      { path: "account/preferenze", element: <PreferencesPage /> },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
];

if (import.meta.env.DEV) {
  children.unshift({ path: "componenti", element: <ComponentsPage /> });
}

export const router = createBrowserRouter([{ element: <PublicLayout />, children }]);
