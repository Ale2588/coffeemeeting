import { createBrowserRouter, type RouteObject } from "react-router";
import { RequireAuth } from "./auth/RequireAuth";
import { AvailabilityPage } from "./founder/AvailabilityPage";
import { FounderLayout } from "./founder/FounderLayout";
import { MembersPage } from "./founder/MembersPage";
import { RequireFounder } from "./founder/RequireFounder";
import { VenueFormPage } from "./founder/VenueFormPage";
import { VenuesPage } from "./founder/VenuesPage";
import { WaitlistPage } from "./founder/WaitlistPage";
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

const founderRoutes: RouteObject = {
  element: <RequireAuth />,
  children: [
    {
      element: <RequireFounder />,
      children: [
        {
          path: "pannello",
          element: <FounderLayout />,
          children: [
            { index: true, element: <AvailabilityPage /> },
            { path: "lista-attesa", element: <WaitlistPage /> },
            { path: "iscritti", element: <MembersPage /> },
            { path: "locali", element: <VenuesPage /> },
            { path: "locali/nuovo", element: <VenueFormPage /> },
            { path: "locali/:id", element: <VenueFormPage /> },
          ],
        },
      ],
    },
  ],
};

export const router = createBrowserRouter([
  { element: <PublicLayout />, children },
  // Il pannello ha un layout largo proprio, fuori dalla colonna mobile.
  founderRoutes,
]);
