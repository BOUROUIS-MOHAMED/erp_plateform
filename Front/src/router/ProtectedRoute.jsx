// src/router/ProtectedRoute.jsx
import { Navigate } from "react-router-dom"
import { isAuthenticated, getUserRole, getHomePathForRole } from "../utils/auth";

function ProtectedRoute({ children, allowedRole }) {
  const isAuth = isAuthenticated();
  const userRole = getUserRole();

  console.log("🔒 ProtectedRoute - Auth:", isAuth, "Role:", userRole, "Allowed:", allowedRole);

  // Non authentifié → login
  if (!isAuth) {
    console.log("❌ Non authentifié → login");
    return <Navigate to="/login" replace />;
  }

  // Si allowedRole est un tableau (plusieurs rôles autorisés)
  if (Array.isArray(allowedRole)) {
    if (!allowedRole.includes(userRole)) {
      console.log(`❌ Rôle ${userRole} non autorisé. Rôles acceptés:`, allowedRole);
      return <Navigate to={getHomePathForRole(userRole)} replace />;
    }
  } 
  // Si allowedRole est une string (un seul rôle)
  else if (allowedRole && userRole !== allowedRole) {
    console.log(`❌ Rôle ${userRole} non autorisé. Rôle requis: ${allowedRole}`);
    return <Navigate to={getHomePathForRole(userRole)} replace />;
  }

  console.log("✅ Accès autorisé !");
  return children;
}

export default ProtectedRoute;