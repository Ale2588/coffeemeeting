import { Navigate, Outlet } from "react-router";
import { LoadingState } from "../components/LoadingState";
import { useMyProfile } from "../features/useMyProfile";

/**
 * Lascia passare solo il fondatore. È una comodità d'interfaccia: la protezione vera
 * è la RLS, che a chiunque altro restituisce solo i propri dati.
 */
export function RequireFounder() {
  const { profile, loading } = useMyProfile();
  if (loading) return <LoadingState />;
  if (profile?.role !== "founder") return <Navigate to="/account" replace />;
  return <Outlet />;
}
