import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/auth/Login';
import Admin from './pages/admin/Admin';

// IMPORT DES NOUVEAUX DASHBOARDS
import DashboardFinancier from './pages/finance/DashboardFinancier';
import DashboardFacturation from './pages/facturation/DashboardFacturation';
import DashboardStock from './pages/stock/DashboardStock';
import DashboardAdmin from './pages/admin/DashboardAdmin';

import { isAuthenticated, getUserRole, getHomePathForRole } from './utils/auth';
import ProtectedRoute from './router/ProtectedRoute';

import FacturationLayout       from './pages/facturation/layout/FacturationLayout'
import FacturationOrdersPage   from './pages/facturation/pages/OrdersPage'
import FacturationClientsPage  from './pages/facturation/pages/ClientsPage'
import FacturationInvoicesPage from './pages/facturation/pages/InvoicesPage'
import FacturationReportsPage  from './pages/facturation/pages/ReportsPage'
import FacturationArchivePage  from './pages/facturation/pages/ArchivePage'
import FacturationSettingsPage from './pages/facturation/pages/SettingsPage'

import StockLayout from './pages/stock/layout/StockLayout';
import StockProductsPage    from './pages/stock/pages/ProductsPage';
import StockCategoriesPage  from './pages/stock/pages/CategoriesPage';
import StockMovementsPage   from './pages/stock/pages/MovementsPage';
import StockAlertsPage      from './pages/stock/pages/AlertsPage';
import StockReportsPage     from './pages/stock/pages/ReportsPage';
import StockSuppliersPage   from './pages/stock/pages/SuppliersPage';
import StockSettingsPage    from './pages/stock/pages/SettingsPage';

import FinanceLayout            from './pages/finance/layout/FinanceLayout';
import FinanceTransactionsPage  from './pages/finance/pages/TransactionsPage';
import FinanceAccountsPage      from './pages/finance/pages/AccountsPage';
import FinanceBudgetsPage       from './pages/finance/pages/BudgetsPage';
import FinanceTargetsPage       from './pages/finance/pages/TargetsPage';
import FinanceMoneyFlowPage     from './pages/finance/pages/MoneyFlowPage';
import FinanceReportsPage       from './pages/finance/pages/ReportsPage';
import FinanceSettingsPage      from './pages/finance/pages/SettingsPage';

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

        {/* Route /finance avec DOUBLE ACCÈS — nested */}
        <Route
          path="/finance"
          element={<ProtectedRoute allowedRole={["admin_finance","admin_principal"]}><FinanceLayout /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="transactions" replace />} />
          <Route path="transactions" element={<FinanceTransactionsPage />} />
          <Route path="accounts"     element={<FinanceAccountsPage />} />
          <Route path="budgets"      element={<FinanceBudgetsPage />} />
          <Route path="targets"      element={<FinanceTargetsPage />} />
          <Route path="moneyflow"    element={<FinanceMoneyFlowPage />} />
          <Route path="reports"      element={<FinanceReportsPage />} />
          <Route path="settings"     element={<FinanceSettingsPage />} />
          <Route path="dashboard"    element={<DashboardFinancier />} />
        </Route>

        {/* Route /facturation avec DOUBLE ACCÈS — nested */}
        <Route
          path="/facturation"
          element={<ProtectedRoute allowedRole={["admin_facture","admin_principal"]}><FacturationLayout /></ProtectedRoute>}
        >
          <Route index element={<Navigate to="orders" replace />} />
          <Route path="orders"    element={<FacturationOrdersPage />} />
          <Route path="clients"   element={<FacturationClientsPage />} />
          <Route path="invoices"  element={<FacturationInvoicesPage />} />
          <Route path="reports"   element={<FacturationReportsPage />} />
          <Route path="archive"   element={<FacturationArchivePage />} />
          <Route path="settings"  element={<FacturationSettingsPage />} />
          <Route path="dashboard" element={<DashboardFacturation />} />
        </Route>

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