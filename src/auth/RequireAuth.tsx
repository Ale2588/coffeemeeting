import { Navigate, Outlet } from "react-router";
import { LoadingState } from "../components/LoadingState";
import { useAuth } from "./AuthProvider";

/** Protegge le pagine dell'iscritto: senza sessione si va all'accesso. */
export function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (!session) return <Navigate to="/accedi" replace />;
  return <Outlet />;
}
