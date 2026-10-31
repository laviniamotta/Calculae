import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";

/** Guarda de rota (experiência do usuário). A proteção real dos dados é o RLS no banco. */
export function RequireAuth({ admin = false }: { admin?: boolean }) {
  const { loading, session, isAdmin } = useAuth();
  const location = useLocation();
  if (loading || (session && admin && isAdmin === null)) return <p role="status">Carregando…</p>;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (admin && !isAdmin) return <Navigate to="/painel" replace />;
  return <Outlet />;
}
