import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Admin from './pages/admin/Admin';
import StockAdmin from './pages/stock/StockAdmin';
import FinanceAdmin from './pages/finance/FinanceAdmin';
import FacturationAdmin from './pages/facturation/FacturationAdmin';

// IMPORT DES NOUVEAUX DASHBOARDS
import DashboardFinancier from './pages/finance/DashboardFinancier';
import DashboardFacturation from './pages/facturation/DashboardFacturation';
import DashboardStock from './pages/stock/DashboardStock';
import DashboardAdmin from './pages/admin/DashboardAdmin';

import { isAuthenticated, getUserRole, getHomePathForRole } from './utils/auth';

/* =========================
   PROTECTED ROUTE
========================= */
const ProtectedRoute = ({ children, allowedRole }) => {
  const isAuth = isAuthenticated();
  const userRole = getUserRole();

  if (!isAuth) {
    return <Navigate to="/login" replace />;
  }

  //  Gestion des tableaux de rôles
  if (Array.isArray(allowedRole)) {
    if (!allowedRole.includes(userRole)) {
      return <Navigate to={getHomePathForRole(userRole)} replace />;
    }
  }
  //  Gestion des rôles uniques
  else if (allowedRole && userRole !== allowedRole) {
    return <Navigate to={getHomePathForRole(userRole)} replace />;
  }

  return children;
};

/* =========================
   REDIRECT TO HOME
========================= */
const RedirectToHome = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getHomePathForRole(getUserRole())} replace />;
};

/* =========================
   FALLBACK ROUTE
========================= */
const FallbackRoute = () => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={getHomePathForRole(getUserRole())} replace />;
};

/* =========================
   APP
========================= */
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login */}
        <Route path="/login" element={<Login />} />

        {/* Admin principal */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin_principal">
              <Admin />
            </ProtectedRoute>
          }
        />

        {/* Route /finance avec DOUBLE ACCÈS */}
        <Route
          path="/finance"
          element={
            <ProtectedRoute allowedRole={["admin_finance", "admin_principal"]}>
              <FinanceAdmin />
            </ProtectedRoute>
          }
        />

        {/* ROUTE /finance/dashboard avec DOUBLE ACCÈS */}
        <Route
          path="/finance/dashboard"
          element={
            <ProtectedRoute allowedRole={["admin_finance", "admin_principal"]}>
              <DashboardFinancier />
            </ProtectedRoute>
          }
        />

        {/* Route /facturation avec DOUBLE ACCÈS */}
        <Route
          path="/facturation"
          element={
            <ProtectedRoute allowedRole={["admin_facture", "admin_principal"]}>
              <FacturationAdmin />
            </ProtectedRoute>
          }
        />

        {/*  ROUTE /facturation/dashboard avec DOUBLE ACCÈS */}
        <Route
          path="/facturation/dashboard"
          element={
            <ProtectedRoute allowedRole={["admin_facture", "admin_principal"]}>
              <DashboardFacturation />
            </ProtectedRoute>
          }
        />

        {/* Route /stock avec DOUBLE ACCÈS */}
        <Route
          path="/stock"
          element={
            <ProtectedRoute allowedRole={["admin_stock", "admin_principal"]}>
              <StockAdmin />
            </ProtectedRoute>
          }
        />

        {/*  ROUTE /stock/dashboard avec DOUBLE ACCÈS (UNE SEULE FOIS) */}
        <Route
          path="/stock/dashboard"
          element={
            <ProtectedRoute allowedRole={["admin_stock", "admin_principal"]}>
              <DashboardStock />
            </ProtectedRoute>
          }
        />

        {/* Route /admin/dashboard */}
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRole="admin_principal">
              <DashboardAdmin />
            </ProtectedRoute>
          }
        />

        {/* Redirect old role paths */}
        <Route path="/admin_principal" element={<Navigate to="/admin" replace />} />
        <Route path="/admin_stock" element={<Navigate to="/stock" replace />} />
        <Route path="/admin_finance" element={<Navigate to="/finance" replace />} />
        <Route path="/admin_facture" element={<Navigate to="/facturation" replace />} />

        {/* Home */}
        <Route path="/" element={<RedirectToHome />} />

        {/* Fallback */}
        <Route path="*" element={<FallbackRoute />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;