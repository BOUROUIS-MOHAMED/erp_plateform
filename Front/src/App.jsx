import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Admin from './pages/admin/Admin';
import FinanceAdmin from './pages/finance/FinanceAdmin';
import FacturationAdmin from './pages/facturation/FacturationAdmin';

// IMPORT DES NOUVEAUX DASHBOARDS
import DashboardFinancier from './pages/finance/DashboardFinancier';
import DashboardFacturation from './pages/facturation/DashboardFacturation';
import DashboardStock from './pages/stock/DashboardStock';
import DashboardAdmin from './pages/admin/DashboardAdmin';

import { isAuthenticated, getUserRole, getHomePathForRole } from './utils/auth';
import ProtectedRoute from './router/ProtectedRoute';

import StockLayout from './pages/stock/layout/StockLayout';
import StockProductsPage    from './pages/stock/pages/ProductsPage';
import StockCategoriesPage  from './pages/stock/pages/CategoriesPage';
import StockMovementsPage   from './pages/stock/pages/MovementsPage';
import StockAlertsPage      from './pages/stock/pages/AlertsPage';
import StockReportsPage     from './pages/stock/pages/ReportsPage';
import StockSuppliersPage   from './pages/stock/pages/SuppliersPage';
import StockSettingsPage    from './pages/stock/pages/SettingsPage';

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

        {/* Route /stock avec DOUBLE ACCÈS — nested */}
        <Route
          path="/stock"
          element={<ProtectedRoute allowedRole={["admin_stock", "admin_principal"]}><StockLayout /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="products" replace />} />
          <Route path="products"   element={<StockProductsPage />} />
          <Route path="categories" element={<StockCategoriesPage />} />
          <Route path="movements"  element={<StockMovementsPage />} />
          <Route path="alerts"     element={<StockAlertsPage />} />
          <Route path="reports"    element={<StockReportsPage />} />
          <Route path="suppliers"  element={<StockSuppliersPage />} />
          <Route path="settings"   element={<StockSettingsPage />} />
          <Route path="dashboard"  element={<DashboardStock />} />
        </Route>

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