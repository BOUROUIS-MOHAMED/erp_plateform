# Frontend Page Split — Design Spec
**Date:** 2026-04-04
**Status:** Approved

## Problem

All four ERP modules (Stock, Finance, Facturation, Admin) are implemented as monolithic page files with internal tab state. The largest files exceed 1800 lines. This makes them hard to maintain, prevents deep linking, blocks lazy loading, and causes unrelated code to share the same render cycle.

| File | Lines |
|---|---|
| `Admin.jsx` | 1817 |
| `FinanceAdmin.jsx` | 1263 |
| `FacturationAdmin.jsx` | 1217 |
| `StockAdmin.jsx` | 1094 |

## Goal

Split every module into separate route-based pages while sharing a single layout (sidebar + header) per module. Each page file handles only its own data and UI.

## Approach: Nested Routes with `<Outlet />`

React Router v6 nested routing. Each module gets a Layout component that wraps its sub-pages via `<Outlet />`. No state is shared across sub-pages unless strictly necessary.

## Folder Structure

```
src/pages/
  stock/
    layout/
      StockLayout.jsx
      StockLayout.css
    pages/
      ProductsPage.jsx
      CategoriesPage.jsx
      MovementsPage.jsx
      AlertsPage.jsx
      ReportsPage.jsx
      SuppliersPage.jsx
      SettingsPage.jsx
    DashboardStock.jsx       (edit: remove useModuleAvailability call — see step 1)

  finance/
    layout/
      FinanceLayout.jsx
      FinanceLayout.css
    pages/
      TransactionsPage.jsx
      AccountsPage.jsx
      BudgetsPage.jsx
      TargetsPage.jsx
      MoneyFlowPage.jsx
      ReportsPage.jsx
      SettingsPage.jsx
    DashboardFinancier.jsx   (edit: remove useModuleAvailability call — see step 1)

  facturation/
    layout/
      FacturationLayout.jsx
      FacturationLayout.css
    pages/
      OrdersPage.jsx
      ClientsPage.jsx
      InvoicesPage.jsx
      ReportsPage.jsx
      ArchivePage.jsx
      SettingsPage.jsx
    DashboardFacturation.jsx (edit: remove useModuleAvailability call — see step 1)

  admin/
    layout/
      AdminLayout.jsx
      AdminLayout.css
    pages/
      AccueilPage.jsx
      ModulesPage.jsx
      AccountsPage.jsx
      CreateAccountPage.jsx
      SettingsPage.jsx
    DashboardAdmin.jsx       (no module-availability hook — no edits needed)
```

## Route Map

### App.jsx nested routes

```jsx
// Stock — allowedRole is an array (two roles can access)
<Route
  path="/stock"
  element={
    <ProtectedRoute allowedRole={["admin_stock", "admin_principal"]}>
      <StockLayout />
    </ProtectedRoute>
  }
>
  <Route index element={<Navigate to="products" replace />} />
  <Route path="products"   element={<ProductsPage />} />
  <Route path="categories" element={<CategoriesPage />} />
  <Route path="movements"  element={<MovementsPage />} />
  <Route path="alerts"     element={<AlertsPage />} />
  <Route path="reports"    element={<ReportsPage />} />
  <Route path="suppliers"  element={<SuppliersPage />} />
  <Route path="settings"   element={<SettingsPage />} />
  <Route path="dashboard"  element={<DashboardStock />} />
</Route>

// Finance — allowedRole is an array
<Route path="/finance" element={<ProtectedRoute allowedRole={["admin_finance","admin_principal"]}><FinanceLayout /></ProtectedRoute>}>
  <Route index element={<Navigate to="transactions" replace />} />
  <Route path="transactions" element={<TransactionsPage />} />
  <Route path="accounts"     element={<AccountsPage />} />
  <Route path="budgets"      element={<BudgetsPage />} />
  <Route path="targets"      element={<TargetsPage />} />
  <Route path="moneyflow"    element={<MoneyFlowPage />} />
  <Route path="reports"      element={<ReportsPage />} />
  <Route path="settings"     element={<SettingsPage />} />
  <Route path="dashboard"    element={<DashboardFinancier />} />
</Route>

// Facturation — allowedRole is an array
<Route path="/facturation" element={<ProtectedRoute allowedRole={["admin_facture","admin_principal"]}><FacturationLayout /></ProtectedRoute>}>
  <Route index element={<Navigate to="orders" replace />} />
  <Route path="orders"    element={<OrdersPage />} />
  <Route path="clients"   element={<ClientsPage />} />
  <Route path="invoices"  element={<InvoicesPage />} />
  <Route path="reports"   element={<ReportsPage />} />
  <Route path="archive"   element={<ArchivePage />} />
  <Route path="settings"  element={<SettingsPage />} />
  <Route path="dashboard" element={<DashboardFacturation />} />
</Route>

// Admin — allowedRole is a plain string (only admin_principal has access)
<Route path="/admin" element={<ProtectedRoute allowedRole="admin_principal"><AdminLayout /></ProtectedRoute>}>
  <Route index element={<Navigate to="accueil" replace />} />
  <Route path="accueil"        element={<AccueilPage />} />
  <Route path="modules"        element={<ModulesPage />} />
  <Route path="accounts"       element={<AccountsPage />} />
  <Route path="create-account" element={<CreateAccountPage />} />
  <Route path="settings"       element={<SettingsPage />} />
  <Route path="dashboard"      element={<DashboardAdmin />} />
</Route>
```

**Dashboard routes** (`/stock/dashboard`, `/finance/dashboard`, etc.) become named child routes inside each module's nested block. The existing Dashboard components are mounted inside the module's Layout, giving them the same sidebar. This replaces the old flat routes that existed outside the module blocks.

**Note on `/admin` role:** The Admin module uses `allowedRole="admin_principal"` as a plain string, not an array. Only one role accesses admin — do not change this to an array.

## Layout Component Pattern

```jsx
// StockLayout.jsx
import { Outlet, NavLink } from 'react-router-dom'
import { useModuleAvailability } from '../../hooks/useModuleAvailability'
import ModuleDisabledView from '../../components/ModuleDisabledView'

function StockLayout() {
  // Module availability check — must live here, not in sub-pages,
  // so switching between tabs within a disabled module stays blocked.
  // The hook returns { blocked, checking, role } — NOT { isAvailable }.
  const { blocked, checking } = useModuleAvailability('stock')
  if (checking) return null   // wait for async fetch; prevents false-positive block flash
  if (blocked) return <ModuleDisabledView />

  // Auth is handled by ProtectedRoute in App.jsx — no redundant check here.
  // Sidebar collapsed state lives here.

  return (
    <div className="stock-admin">
      <aside className="sidebar">
        <NavLink to="/stock/products">Produits</NavLink>
        <NavLink to="/stock/categories">Catégories</NavLink>
        <NavLink to="/stock/movements">Mouvements</NavLink>
        <NavLink to="/stock/alerts">Alertes</NavLink>
        <NavLink to="/stock/reports">Rapports</NavLink>
        <NavLink to="/stock/suppliers">Fournisseurs</NavLink>
        <NavLink to="/stock/settings">Paramètres</NavLink>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  )
}
```

`NavLink` applies the `active` CSS class automatically based on the current URL, replacing all manual `currentPage === 'tab'` style comparisons.

Auth is handled exclusively by `ProtectedRoute` in `App.jsx`. The Layout does not repeat the `isAuthenticated()` check.

## Data Flow

Each page fetches its own data independently using the existing service layer:

```jsx
// ProductsPage.jsx
function ProductsPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    productService.getAll().then(data => {
      setProducts(pickList(data).map(mapProductToUi))
      setLoading(false)
    })
  }, [])

  return <ProductsTable products={products} />
}
```

**Rule:** if two pages within the same module need the same data, fetch it in the Layout component and pass it down via React Context. If only one page needs it, fetch it in that page. No global state manager needed.

## Cross-Page Navigation with Pre-set Filters

Several current tabs navigate to another tab and pre-populate a filter. These cases are migrated using **URL search params** (`useSearchParams`). The navigating page appends the filter to the URL; the target page reads it on mount.

| Location | Current behavior | Migration |
|---|---|---|
| `StockAdmin` — Categories modal "Voir dans Produits" | `setTab(PRODUCTS)` + `setFilter('productCategory', name)` | `navigate('/stock/products?category='+name)` → ProductsPage reads `?category` on mount |
| `StockAdmin` — Suppliers modal "Voir produits" | `setTab(PRODUCTS)` + `setFilter('supplierId', id)` | `navigate('/stock/products?supplier='+id)` → ProductsPage reads `?supplier` on mount |
| `FacturationAdmin` — Clients grid "Voir commandes" | `setFilters({search: c.name})` + `setTab(ORDERS)` | `navigate('/facturation/orders?search='+name)` → OrdersPage reads `?search` on mount |
| `FinanceAdmin` — Accounts "Voir transactions" | `setFilter(accountId)` + `setActiveTab(TRANSACTIONS)` | `navigate('/finance/transactions?account='+id)` → TransactionsPage reads `?account` on mount |

Each target page initializes its filter state from `useSearchParams()` in a `useEffect` that runs once on mount.

## Reusable Components

Components currently defined inline inside monolithic files (`Modal`, `StatusBadge`, `FormField`, `RatingStars`, etc.) are moved to `src/components/common/` so all sub-pages can import them without duplication.

## Migration Steps (per module)

Do steps 4 and 5 as a single atomic commit per module to avoid a state where routes point to files that do not exist yet.

1. Extract sidebar + header + `useModuleAvailability` check (`{ blocked, checking }`) into `<ModuleLayout>` with `<Outlet />`. Remove the `useModuleAvailability` call from the corresponding Dashboard component (e.g. `DashboardStock.jsx`) — the Layout now gates the whole module including the dashboard sub-page.
2. Create one page file per tab, copying only that tab's state + handlers + JSX
3. Move shared inline components to `src/components/common/`
4. Update `App.jsx`: add nested routes, remove the old flat routes in the same commit, **and** remove the inline `ProtectedRoute` definition from `App.jsx` — replace it with `import ProtectedRoute from './router/ProtectedRoute'` (the canonical version already exists at `src/router/ProtectedRoute.jsx`). Several page component names repeat across modules — use module-prefixed aliases for **all** of them in `App.jsx` imports. Full collision list: `ReportsPage` (stock, finance, facturation), `SettingsPage` (stock, finance, facturation, admin), `AccountsPage` (finance, admin). Example aliases: `StockReportsPage`, `FinanceReportsPage`, `FacturationReportsPage`, `StockSettingsPage`, `FinanceSettingsPage`, `FacturationSettingsPage`, `AdminSettingsPage`, `FinanceAccountsPage`, `AdminAccountsPage`.
5. Delete the old monolithic file in the same commit as step 4

## Files Deleted After Migration

- `src/pages/stock/StockAdmin.jsx` + `StockAdmin.css`
- `src/pages/finance/FinanceAdmin.jsx` + `FinanceAdmin.css`
- `src/pages/facturation/FacturationAdmin.jsx` + `FacturationAdmin.css`
- `src/pages/admin/Admin.jsx` + `Admin.css`
