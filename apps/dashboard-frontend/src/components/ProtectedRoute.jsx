import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { canUseRoute } from "../lib/permissions.js";

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="screen-state">Memuat session...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!canUseRoute(user.role, roles)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
