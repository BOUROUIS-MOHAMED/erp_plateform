# Frontend Page Split — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split four monolithic ERP page files (1000–1800 lines each) into nested-route pages sharing a per-module layout, using React Router v6 `<Outlet />`.

**Architecture:** Each module gets a `Layout` component (sidebar + header + module-availability gate) that wraps sub-pages via `<Outlet />`. Each sub-page fetches its own data from the existing service layer. Cross-page filter navigation uses URL search params (`useSearchParams`).

**Tech Stack:** React 18, React Router v6, existing service layer (`productService`, `categoryService`, etc.), `useModuleAvailability` hook, `NavLink` for active-state sidebar links.

---

## File Map

### New files to create
```
src/components/common/
  Modal.jsx
  StatusBadge.jsx
  FormField.jsx

src/pages/stock/
  layout/StockLayout.jsx
  layout/StockLayout.css
  pages/ProductsPage.jsx
  pages/CategoriesPage.jsx
  pages/MovementsPage.jsx
  pages/AlertsPage.jsx
  pages/ReportsPage.jsx
  pages/SuppliersPage.jsx
  pages/SettingsPage.jsx

src/pages/finance/
  layout/FinanceLayout.jsx
  layout/FinanceLayout.css
  pages/TransactionsPage.jsx
  pages/AccountsPage.jsx
  pages/BudgetsPage.jsx
  pages/TargetsPage.jsx
  pages/MoneyFlowPage.jsx
  pages/ReportsPage.jsx
  pages/SettingsPage.jsx

src/pages/facturation/
  layout/FacturationLayout.jsx
  layout/FacturationLayout.css
  pages/OrdersPage.jsx
  pages/ClientsPage.jsx
  pages/InvoicesPage.jsx
  pages/ReportsPage.jsx
  pages/ArchivePage.jsx
  pages/SettingsPage.jsx

src/pages/admin/
  layout/AdminLayout.jsx
  layout/AdminLayout.css
  pages/AccueilPage.jsx
  pages/ModulesPage.jsx
  pages/AccountsPage.jsx
  pages/CreateAccountPage.jsx
  pages/SettingsPage.jsx
```

### Files modified
```
src/App.jsx                              — replace with nested routes
src/pages/stock/DashboardStock.jsx       — remove useModuleAvailability call
src/pages/finance/DashboardFinancier.jsx — remove useModuleAvailability call
src/pages/facturation/DashboardFacturation.jsx — remove useModuleAvailability call
```

### Files deleted (in same commit as App.jsx update, per module)
```
src/pages/stock/StockAdmin.jsx + StockAdmin.css
src/pages/finance/FinanceAdmin.jsx + FinanceAdmin.css
src/pages/facturation/FacturationAdmin.jsx + FacturationAdmin.css
src/pages/admin/Admin.jsx + Admin.css
```

---

## How page file extraction works

Each sub-page file follows this skeleton. You extract the relevant state, handlers, and JSX from the monolithic file:

```jsx
// src/pages/<module>/pages/<Tab>Page.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
// import only the services this page needs
// import shared components from src/components/common/

function TabPage() {
  // 1. State variables that belong only to this tab
  // 2. useEffect to load data from service
  // 3. Handlers (CRUD, modals, filters) for this tab only
  // 4. JSX from the corresponding {tab===TABS.XXX && <div>...} block
  //    plus its modals
}

export default TabPage
```

To identify which state/handlers belong to each tab: search for the variable/function names inside the `{tab===TABS.XXX && ...}` JSX block in the monolithic file. Everything referenced only inside that block moves to that page file.

---

## Task 0: Extract shared components to `src/components/common/`

These components are defined inline in `StockAdmin.jsx` (lines 67–96) and equivalents exist in other monolithic files. Extract them once here so all pages can import them.

**Files:**
- Create: `src/components/common/Modal.jsx`
- Create: `src/components/common/StatusBadge.jsx`
- Create: `src/components/common/FormField.jsx`

- [ ] **Step 0.1: Create Modal.jsx**

```jsx
// src/components/common/Modal.jsx
function Modal({ isOpen, onClose, title, children, onConfirm, confirmText = "Confirmer", showConfirm = true }) {
  if (!isOpen) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} role="dialog">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          {showConfirm && <button className="btn-primary" onClick={onConfirm}>{confirmText}</button>}
        </div>
      </div>
    </div>
  )
}
export default Modal
```

- [ ] **Step 0.2: Create StatusBadge.jsx**

```jsx
// src/components/common/StatusBadge.jsx
function StatusBadge({ status }) {
  const s = {
    "en stock":  { bg: "#c6f6d5", color: "#48bb78" },
    "stock faible": { bg: "#feebc8", color: "#ed8936" },
    "rupture":   { bg: "#fed7d7", color: "#f56565" },
  }[status] || { bg: "#e2e8f0", color: "#a0aec0" }
  return <span className="status-badge" style={{ background: s.bg, color: s.color }}>{status}</span>
}
export default StatusBadge
```

- [ ] **Step 0.3: Create FormField.jsx**

```jsx
// src/components/common/FormField.jsx
function FormField({ label, id, error, children }) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      {children}
      {error && <span className="error-message">{error}</span>}
    </div>
  )
}
export default FormField
```

- [ ] **Step 0.4: Commit**

```bash
git add src/components/common/
git commit -m "feat: extract Modal, StatusBadge, FormField to components/common"
```

---

## Task 1: Stock Module — Layout

**Files:**
- Create: `src/pages/stock/layout/StockLayout.jsx`
- Create: `src/pages/stock/layout/StockLayout.css`
- Modify: `src/pages/stock/DashboardStock.jsx` (remove useModuleAvailability)

- [ ] **Step 1.1: Create StockLayout.jsx**

The layout holds: sidebar HTML (copy from `StockAdmin.jsx` lines 659–695), user profile state (`ue`, `un`, `ur`, `us`), initial data load, sidebar-collapsed state, and the module-availability gate.

```jsx
// src/pages/stock/layout/StockLayout.jsx
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useModuleAvailability } from '../../../hooks/useModuleAvailability'
import ModuleDisabledView from '../../../components/ModuleDisabledView'
import { clearAuth, getUserEmail, getUserRole } from '../../../utils/auth'
import userService from '../../../services/userService'
import { extractApiErrorMessage } from '../../../utils/frontendApiAdapters'
import './StockLayout.css'

function StockLayout() {
  const navigate = useNavigate()
  const { blocked, checking } = useModuleAvailability('stock')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', email: '', department: '', role: '' })

  useEffect(() => {
    let active = true
    userService.getProfile().then(res => {
      if (!active) return
      const p = res?.data || res
      setUserInfo({
        firstName: p?.firstName || 'Gestionnaire',
        lastName:  p?.lastName  || 'Stock',
        email:     p?.email     || getUserEmail() || '',
        department: p?.department || 'Gestion des stocks',
        role:      p?.role      || getUserRole() || 'admin_stock',
      })
    }).catch(() => {
      if (!active) return
      setUserInfo(u => ({ ...u, email: getUserEmail() || '', role: getUserRole() || '' }))
    })
    return () => { active = false }
  }, [])

  const handleLogout = () => { clearAuth(); navigate('/login') }

  if (checking) return <div className="stock-loading"><div className="spinner" /><p>Chargement...</p></div>
  if (blocked)  return <ModuleDisabledView accentColor="#48bb78" moduleLabel="Stock" />

  const isAdmin = userInfo.role === 'admin_principal'

  return (
    <div className="stock-container">
      {/* ===== SIDEBAR ===== */}
      <aside className={`stock-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#48bb78"/>
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round"/>
            </svg>
            {!sidebarCollapsed && <div><h1>ERP</h1><p>Gestion Stock</p></div>}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(c => !c)}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="user-profile">
            <div className="avatar" style={{ background: 'linear-gradient(135deg,#48bb78,#2f855a)' }}>
              {userInfo.firstName?.charAt(0).toUpperCase() || 'S'}
            </div>
            <div className="user-info">
              <div className="user-name">{userInfo.firstName} {userInfo.lastName}</div>
              <div className="user-email">{userInfo.email}</div>
              {userInfo.department && <div className="user-department">{userInfo.department}</div>}
            </div>
          </div>
        )}

        <nav className="sidebar-menu">
          {!sidebarCollapsed && (
            <div className="menu-header">
              <p>MENU STOCK</p>
              {isAdmin && (
                <button className="router-button" onClick={() => navigate('/admin')}>
                  👑 Admin
                </button>
              )}
            </div>
          )}
          <div className="menu-items">
            <NavLink to="/stock/dashboard" className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">📊</span>{!sidebarCollapsed && <span>Dashboard Stock</span>}
            </NavLink>
            <NavLink to="/stock/products"   className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">📦</span>{!sidebarCollapsed && <span>Produits</span>}
            </NavLink>
            <NavLink to="/stock/categories" className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">📑</span>{!sidebarCollapsed && <span>Catégories</span>}
            </NavLink>
            <NavLink to="/stock/suppliers"  className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">🤝</span>{!sidebarCollapsed && <span>Fournisseurs</span>}
            </NavLink>
            <NavLink to="/stock/movements"  className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">🔄</span>{!sidebarCollapsed && <span>Mouvements</span>}
            </NavLink>
            <NavLink to="/stock/alerts"     className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">⚠️</span>{!sidebarCollapsed && <span>Alertes</span>}
            </NavLink>
            <NavLink to="/stock/reports"    className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">📊</span>{!sidebarCollapsed && <span>Rapports</span>}
            </NavLink>
            <NavLink to="/stock/settings"   className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">⚙️</span>{!sidebarCollapsed && <span>Paramètres</span>}
            </NavLink>
          </div>
        </nav>

        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-button">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M3 3C2.46957 3 1.96086 3.21071 1.58579 3.58579C1.21071 3.96086 1 4.46957 1 5V15C1 15.5304 1.21071 16.0391 1.58579 16.4142C1.96086 16.7893 2.46957 17 3 17H8V15H3V5H8V3H3Z"/>
              <path d="M16 5L20 10L16 15L14.59 13.59L17.17 11H8V9H17.17L14.59 6.41L16 5Z"/>
            </svg>
            {!sidebarCollapsed && <span>Déconnexion</span>}
          </button>
        </div>
      </aside>

      {/* ===== MAIN — sub-page renders here ===== */}
      <main className="stock-main">
        <header className="main-header">
          <div>
            <h1 className="page-title">Gestion des stocks</h1>
            <p className="page-subtitle">Bienvenue sur votre espace de gestion</p>
          </div>
          <div className="header-actions">
            <time dateTime={new Date().toISOString()}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </time>
          </div>
        </header>
        <section className="tab-content">
          <Outlet />
        </section>
      </main>
    </div>
  )
}

export default StockLayout
```

- [ ] **Step 1.2: Create StockLayout.css**

Copy `StockAdmin.css` in full to `src/pages/stock/layout/StockLayout.css`. No changes needed — the class names stay the same.

```bash
cp "src/pages/stock/StockAdmin.css" "src/pages/stock/layout/StockLayout.css"
```

- [ ] **Step 1.3: Remove useModuleAvailability from DashboardStock.jsx**

In `src/pages/stock/DashboardStock.jsx`, remove:
- The `import { useModuleAvailability }` line
- The `import ModuleDisabledView` line
- The `const { blocked, checking } = useModuleAvailability('stock')` line
- Any `if (checking) return ...` or `if (blocked) return <ModuleDisabledView />` guards

The Layout now handles this. DashboardStock renders directly inside the Layout's `<Outlet />` which is already gated.

- [ ] **Step 1.4: Commit layout**

```bash
git add src/pages/stock/layout/ src/pages/stock/DashboardStock.jsx
git commit -m "feat(stock): add StockLayout with sidebar, NavLinks, module-availability gate"
```

---

## Task 2: Stock Module — Page Files

For each page file: open `StockAdmin.jsx`, find the `{tab===TABS.XXX && <div className="xxx-tab">...</div>}` block, and extract its contents along with the state variables and handlers it references.

**Files:** `src/pages/stock/pages/` — one file per tab.

- [ ] **Step 2.1: Create ProductsPage.jsx**

Extract from `StockAdmin.jsx`: state `prod`, `cat`, `supp`, `f` (productName/productCategory/productStatus filters), `spf`, `ep`, modals `mod.product`, handlers `hdlAddProdRemote`, `hdlUpdProdRemote`, `hdlDelProdRemote`, `hdlEditProd`. JSX from the `tab===TABS.PRODUCTS` block (approx lines 706–750) plus the product `<Modal>` (approx lines 1001–1006).

Add `useSearchParams` to initialize filters from URL (for cross-page navigation from CategoriesPage):

```jsx
// at the top of useEffect
const [searchParams] = useSearchParams()
const initialCategory = searchParams.get('category') || ''
const initialSupplier  = searchParams.get('supplier')  || ''
// set these as initial filter values
```

- [ ] **Step 2.2: Create CategoriesPage.jsx**

Extract: state `cat`, `prod` (for productCount display), `fc` (filtered categories), `f.categorySearch`, `ec`, `cf`, `mod.category`, `mod.categoryProducts`, `sc`. Handlers: `hdlAddCatRemote`, `hdlUpdCatRemote`, `hdlDelCatRemote`, `hdlEditCat`. JSX from `tab===TABS.CATEGORIES` block (approx lines 753–796).

Cross-page navigation: the "Voir dans Produits" button currently calls `setTab(PRODUCTS)` + `updateFilter('productCategory', name)`. Replace with:
```jsx
navigate(`/stock/products?category=${encodeURIComponent(sc.name)}`)
```

- [ ] **Step 2.3: Create MovementsPage.jsx**

Extract: state `mov`, `prod` (for product dropdown), `supp` (for supplier display), `f` (movement/date filters), `sdp`, `mf`, `mod.movement`. Handlers: `hdlAddMvRemote`, `hdlProdChange`. JSX from `tab===TABS.MOVEMENTS` block.

- [ ] **Step 2.4: Create AlertsPage.jsx**

Extract: state `prod`, `readAlerts` (with localStorage logic, `ALERTS_LS_KEY`). Handler: `toggleAlertRead`. JSX from `tab===TABS.ALERTS` block.

- [ ] **Step 2.5: Create SuppliersPage.jsx**

Extract: state `supp`, `prod` (for product count per supplier), `f` (supplierName/supplierStatus/supplierRating filters), `es`, `sf`, `mod.supplier`, `mod.supplierProducts`. Handlers: `hdlAddSuppRemote`, `hdlUpdSuppRemote`, `hdlDelSuppRemote`, `hdlEditSupp`. JSX from `tab===TABS.SUPPLIERS` block.

Cross-page navigation: "Voir produits" button. Replace with:
```jsx
navigate(`/stock/products?supplier=${encodeURIComponent(es.id)}`)
```

- [ ] **Step 2.6: Create ReportsPage.jsx**

Extract: state `reports`, `f.reportSearch`, `er`, `vr`, `rf`, `mod.report`, `mod.reportView`. Handlers: `hdlAddReportRemote`, `hdlUpdReportRemote`, `hdlDelReportRemote`, `hdlDownloadReportRemote`, `getReportIcon`. JSX from `tab===TABS.REPORTS` block plus report modals.

- [ ] **Step 2.7: Create SettingsPage.jsx**

Extract: state `us`, `sm`, `upd`, `fe`. Handlers: `hdlSave`, `hdlSetChange`. JSX from `tab===TABS.SETTINGS` block.

The settings page needs the current user profile — fetch it in a `useEffect` on mount using `userService.getProfile()`, same pattern as the Layout does. The Layout and SettingsPage both fetch independently; that's fine.

- [ ] **Step 2.8: Commit page files**

```bash
git add src/pages/stock/pages/
git commit -m "feat(stock): add 7 sub-page components (products, categories, movements, alerts, suppliers, reports, settings)"
```

---

## Task 3: Stock Module — Wire Routes (Atomic)

This task deletes the monolithic file and updates App.jsx in one commit. Do not split this step.

**Files:**
- Modify: `src/App.jsx`
- Delete: `src/pages/stock/StockAdmin.jsx`, `src/pages/stock/StockAdmin.css`

- [ ] **Step 3.1: Update App.jsx — remove inline ProtectedRoute, add stock nested routes**

Replace the inline `ProtectedRoute` definition at the top of `App.jsx` (lines 19–39) with an import:
```jsx
import ProtectedRoute from './router/ProtectedRoute'
```

Replace the flat stock routes:
```jsx
// REMOVE these two flat routes:
<Route path="/stock" element={<ProtectedRoute allowedRole={["admin_stock","admin_principal"]}><StockAdmin /></ProtectedRoute>} />
<Route path="/stock/dashboard" element={<ProtectedRoute allowedRole={["admin_stock","admin_principal"]}><DashboardStock /></ProtectedRoute>} />
```

With the nested block:
```jsx
import StockLayout from './pages/stock/layout/StockLayout'
import StockProductsPage    from './pages/stock/pages/ProductsPage'
import StockCategoriesPage  from './pages/stock/pages/CategoriesPage'
import StockMovementsPage   from './pages/stock/pages/MovementsPage'
import StockAlertsPage      from './pages/stock/pages/AlertsPage'
import StockReportsPage     from './pages/stock/pages/ReportsPage'
import StockSuppliersPage   from './pages/stock/pages/SuppliersPage'
import StockSettingsPage    from './pages/stock/pages/SettingsPage'

// In the <Routes> block:
<Route
  path="/stock"
  element={<ProtectedRoute allowedRole={["admin_stock","admin_principal"]}><StockLayout /></ProtectedRoute>}
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
```

Also remove the old `import StockAdmin` line.

- [ ] **Step 3.2: Delete monolithic files**

```bash
rm src/pages/stock/StockAdmin.jsx src/pages/stock/StockAdmin.css
```

- [ ] **Step 3.3: Verify the app builds and stock routes work**

```bash
cd Front && npm run build
```

Expected: no build errors. Navigate to `/stock` — should redirect to `/stock/products`. Sidebar links should highlight based on current URL.

- [ ] **Step 3.4: Atomic commit**

```bash
git add src/App.jsx
git rm src/pages/stock/StockAdmin.jsx src/pages/stock/StockAdmin.css
git commit -m "feat(stock): wire nested routes, remove StockAdmin monolith"
```

---

## Task 4: Finance Module — Layout

Same pattern as Task 1. Key differences from Stock:
- Module id: `'finance'`
- Accent color: `#ed8936`
- NavLinks: `/finance/transactions`, `/finance/accounts`, `/finance/budgets`, `/finance/targets`, `/finance/moneyflow`, `/finance/reports`, `/finance/settings`, `/finance/dashboard`
- CSS: copy `FinanceAdmin.css` → `src/pages/finance/layout/FinanceLayout.css`

**Files:**
- Create: `src/pages/finance/layout/FinanceLayout.jsx`
- Create: `src/pages/finance/layout/FinanceLayout.css`
- Modify: `src/pages/finance/DashboardFinancier.jsx` (remove useModuleAvailability call)

- [ ] **Step 4.1: Create FinanceLayout.jsx**

Follow the exact same structure as `StockLayout.jsx`. Copy the sidebar HTML from `FinanceAdmin.jsx` (find the `<aside>` / sidebar section). Replace `setActiveTab(id)` click handlers with `NavLink to="/finance/..."`. Replace the module-availability call: `useModuleAvailability('finance')`.

- [ ] **Step 4.2: Create FinanceLayout.css**

```bash
cp src/pages/finance/FinanceAdmin.css src/pages/finance/layout/FinanceLayout.css
```

- [ ] **Step 4.3: Remove useModuleAvailability from DashboardFinancier.jsx**

Same as Step 1.3 — remove the hook call and its guards from `DashboardFinancier.jsx`.

- [ ] **Step 4.4: Commit**

```bash
git add src/pages/finance/layout/ src/pages/finance/DashboardFinancier.jsx
git commit -m "feat(finance): add FinanceLayout with sidebar and module-availability gate"
```

---

## Task 5: Finance Module — Page Files

Finance tabs: `transactions`, `accounts`, `budgets`, `targets`, `moneyFlow`, `reports`, `settings`.

Refer to `FinanceAdmin.jsx`. The `activeTab` state drives the tab switching. Find each `{activeTab === TABS.XXX && ...}` block and extract it.

**Files:** `src/pages/finance/pages/` — one file per tab.

- [ ] **Step 5.1: Create TransactionsPage.jsx**

Extract state `transactions`, filters, modal state for transactions. Cross-page filter from Finance Accounts: read `?account` from `useSearchParams` on mount and pre-set the account filter.

- [ ] **Step 5.2: Create AccountsPage.jsx**

Extract state `accounts` (finance accounts, not users). Cross-page nav: "Voir transactions" button navigates to `/finance/transactions?account=<id>`. Replace the current `setActiveTab` call:
```jsx
navigate(`/finance/transactions?account=${encodeURIComponent(account.id)}`)
```

- [ ] **Step 5.3: Create BudgetsPage.jsx**

Extract state `budgets`, budget-specific filters and modals.

- [ ] **Step 5.4: Create TargetsPage.jsx**

Extract state `targets`, target-specific filters and modals.

- [ ] **Step 5.5: Create MoneyFlowPage.jsx**

Extract state `moneyFlows`, money-flow-specific filters and modals.

- [ ] **Step 5.6: Create ReportsPage.jsx**

Extract state `reports` (finance reports), report modals and handlers.

- [ ] **Step 5.7: Create SettingsPage.jsx**

Extract settings state and handlers. Fetch user profile on mount with `userService.getProfile()`.

- [ ] **Step 5.8: Commit page files**

```bash
git add src/pages/finance/pages/
git commit -m "feat(finance): add 7 sub-page components"
```

---

## Task 6: Finance Module — Wire Routes (Atomic)

- [ ] **Step 6.1: Update App.jsx — add finance nested routes**

Remove flat finance routes. Add nested block:

```jsx
import FinanceLayout from './pages/finance/layout/FinanceLayout'
import FinanceTransactionsPage from './pages/finance/pages/TransactionsPage'
import FinanceAccountsPage     from './pages/finance/pages/AccountsPage'
import FinanceBudgetsPage      from './pages/finance/pages/BudgetsPage'
import FinanceTargetsPage      from './pages/finance/pages/TargetsPage'
import FinanceMoneyFlowPage    from './pages/finance/pages/MoneyFlowPage'
import FinanceReportsPage      from './pages/finance/pages/ReportsPage'
import FinanceSettingsPage     from './pages/finance/pages/SettingsPage'

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
```

- [ ] **Step 6.2: Delete monolithic files + verify + commit**

```bash
# Build first — if it fails, nothing is deleted yet
cd Front && npm run build
# Only delete after a successful build
git add src/App.jsx
git rm src/pages/finance/FinanceAdmin.jsx src/pages/finance/FinanceAdmin.css
git commit -m "feat(finance): wire nested routes, remove FinanceAdmin monolith"
```

---

## Task 7: Facturation Module — Layout

Facturation tabs: `orders`, `clients`, `invoices`, `reports`, `archive`, `settings`.

Key differences from Stock:
- Module id: `'facturation'`
- Accent color: `#667eea`
- NavLinks: `/facturation/orders`, `/facturation/clients`, `/facturation/invoices`, `/facturation/reports`, `/facturation/archive`, `/facturation/settings`, `/facturation/dashboard`

**Files:**
- Create: `src/pages/facturation/layout/FacturationLayout.jsx`
- Create: `src/pages/facturation/layout/FacturationLayout.css`
- Modify: `src/pages/facturation/DashboardFacturation.jsx` (remove useModuleAvailability)

- [ ] **Step 7.1: Create FacturationLayout.jsx**

Follow the StockLayout pattern. Copy sidebar HTML from `FacturationAdmin.jsx`. Replace tab-click handlers with `NavLink`. Use `useModuleAvailability('facturation')`.

- [ ] **Step 7.2: Copy CSS, remove hook from Dashboard, commit**

```bash
cp src/pages/facturation/FacturationAdmin.css src/pages/facturation/layout/FacturationLayout.css
# Edit DashboardFacturation.jsx — remove useModuleAvailability call and guards
git add src/pages/facturation/layout/ src/pages/facturation/DashboardFacturation.jsx
git commit -m "feat(facturation): add FacturationLayout"
```

---

## Task 8: Facturation Module — Page Files

- [ ] **Step 8.1: Create OrdersPage.jsx**

Extract orders state, filters, modal. Reads `useSearchParams` — no cross-page filter needed for Orders receiving navigation, but ClientsPage will navigate here with `?search=clientName`:
```jsx
const [searchParams] = useSearchParams()
const initialSearch = searchParams.get('search') || ''
```

- [ ] **Step 8.2: Create ClientsPage.jsx**

Extract clients state and modals. Cross-page nav: "Voir commandes" button. Replace `setTab + setFilters`:
```jsx
navigate(`/facturation/orders?search=${encodeURIComponent(client.name)}`)
```

- [ ] **Step 8.3: Create InvoicesPage.jsx**

Extract invoices state, filters, modals.

- [ ] **Step 8.4: Create ReportsPage.jsx**

Extract reports state (facturation reports).

- [ ] **Step 8.5: Create ArchivePage.jsx**

Extract archive state and filters.

- [ ] **Step 8.6: Create SettingsPage.jsx**

Extract settings state. Fetch profile on mount.

- [ ] **Step 8.7: Commit page files**

```bash
git add src/pages/facturation/pages/
git commit -m "feat(facturation): add 6 sub-page components"
```

---

## Task 9: Facturation Module — Wire Routes (Atomic)

- [ ] **Step 9.1: Update App.jsx + delete monolith + verify + commit**

```jsx
import FacturationLayout  from './pages/facturation/layout/FacturationLayout'
import FacturationOrdersPage   from './pages/facturation/pages/OrdersPage'
import FacturationClientsPage  from './pages/facturation/pages/ClientsPage'
import FacturationInvoicesPage from './pages/facturation/pages/InvoicesPage'
import FacturationReportsPage  from './pages/facturation/pages/ReportsPage'
import FacturationArchivePage  from './pages/facturation/pages/ArchivePage'
import FacturationSettingsPage from './pages/facturation/pages/SettingsPage'

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
```

```bash
cd Front && npm run build
git add src/App.jsx
git rm src/pages/facturation/FacturationAdmin.jsx src/pages/facturation/FacturationAdmin.css
git commit -m "feat(facturation): wire nested routes, remove FacturationAdmin monolith"
```

---

## Task 10: Admin Module — Layout

The Admin module has **no** `useModuleAvailability` hook — it is only accessible to `admin_principal`. No Dashboard file needs editing. `allowedRole` is a plain string, not an array.

Admin pages: `accueil`, `modules`, `accounts`, `create-account`, `settings`.

**Files:**
- Create: `src/pages/admin/layout/AdminLayout.jsx`
- Create: `src/pages/admin/layout/AdminLayout.css`

- [ ] **Step 10.1: Create AdminLayout.jsx**

Follow the StockLayout pattern but:
- No `useModuleAvailability` call
- Copy sidebar HTML from `Admin.jsx` (the `<div style={styles.sidebar}>` block, approx lines 505–665)
- NavLinks: `/admin/accueil`, `/admin/modules`, `/admin/accounts`, `/admin/create-account`, `/admin/settings`, `/admin/dashboard`
- No "Retour Admin" button (this IS the admin module)

```jsx
// src/pages/admin/layout/AdminLayout.jsx
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { clearAuth, getUserEmail } from '../../../utils/auth'
import userService from '../../../services/userService'
import { extractApiErrorMessage } from '../../../utils/frontendApiAdapters'
import './AdminLayout.css'

function AdminLayout() {
  const navigate = useNavigate()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userSettings, setUserSettings] = useState({ firstName: '', lastName: '', email: '', department: '' })

  useEffect(() => {
    let active = true
    userService.getProfile().then(res => {
      if (!active) return
      const p = res?.data || res
      setUserSettings({
        firstName:  p?.firstName  || '',
        lastName:   p?.lastName   || '',
        email:      p?.email      || getUserEmail() || '',
        department: p?.department || '',
      })
    }).catch(() => {})
    return () => { active = false }
  }, [])

  const handleLogout = () => { clearAuth(); navigate('/login') }

  return (
    <div style={styles.container}>
      {/* Copy the sidebar JSX from Admin.jsx, replacing setCurrentPage('xxx') onClick
          with NavLink to="/admin/xxx" */}
      {/* Copy the main content area from Admin.jsx, replacing
          {currentPage === 'xxx' && <Component />} with <Outlet /> */}
      <Outlet />
    </div>
  )
}
// Copy the `styles` object from Admin.jsx verbatim
export default AdminLayout
```

> **Note:** Admin.jsx uses inline `style={{}}` objects (not a CSS file). Copy the entire `styles` object from `Admin.jsx` into `AdminLayout.jsx`. Replace each sidebar nav button's `onClick={() => setCurrentPage('xxx')}` with a `<NavLink to="/admin/xxx">` element styled the same way.

- [ ] **Step 10.2: Create AdminLayout.css**

Admin.jsx uses inline styles, so `AdminLayout.css` may be empty or hold only minor shared classes. Create the file:
```bash
touch src/pages/admin/layout/AdminLayout.css
```

- [ ] **Step 10.3: Commit**

```bash
git add src/pages/admin/layout/
git commit -m "feat(admin): add AdminLayout with sidebar"
```

---

## Task 11: Admin Module — Page Files

Admin pages: `accueil`, `modules`, `accounts`, `create-account`, `settings`.

In `Admin.jsx`, the content is rendered via `{currentPage === 'xxx' && (...)}` blocks.

- [ ] **Step 11.1: Create AccueilPage.jsx**

Extract JSX from `{currentPage === 'accueil' && ...}` block (approx lines 672–796). No API calls — it's a welcome/stats view using derived data from the modules list. Fetch modules and accounts data from `moduleService` and `userService` on mount.

- [ ] **Step 11.2: Create ModulesPage.jsx**

Extract: state `baseModules`, `customModules`, `moduleSearchTerm`, modal state for adding/editing/deleting modules. All module CRUD handlers. JSX from `{currentPage === 'modules' && ...}` block.

- [ ] **Step 11.3: Create AccountsPage.jsx**

Extract: state `accounts`, `accountSearchTerm`. Handlers for loading and managing accounts. JSX from `{currentPage === 'accounts' && ...}` block.

- [ ] **Step 11.4: Create CreateAccountPage.jsx**

Extract: renders the `<CreateAccount>` form component. JSX from `{currentPage === 'createAccount' && ...}` block (approx line 1109).

- [ ] **Step 11.5: Create SettingsPage.jsx**

Extract: settings state for the admin user. Renders the `<AccountSettings>` component. JSX from `{currentPage === 'settings' && ...}` block.

- [ ] **Step 11.6: Commit page files**

```bash
git add src/pages/admin/pages/
git commit -m "feat(admin): add 5 sub-page components"
```

---

## Task 12: Admin Module — Wire Routes (Atomic)

- [ ] **Step 12.1: Update App.jsx + delete Admin.jsx + verify + commit**

Admin uses `allowedRole="admin_principal"` as a **plain string**, not an array:

```jsx
import AdminLayout from './pages/admin/layout/AdminLayout'
import AdminAccueilPage       from './pages/admin/pages/AccueilPage'
import AdminModulesPage       from './pages/admin/pages/ModulesPage'
import AdminAccountsPage      from './pages/admin/pages/AccountsPage'
import AdminCreateAccountPage from './pages/admin/pages/CreateAccountPage'
import AdminSettingsPage      from './pages/admin/pages/SettingsPage'

<Route
  path="/admin"
  element={<ProtectedRoute allowedRole="admin_principal"><AdminLayout /></ProtectedRoute>}
>
  <Route index element={<Navigate to="accueil" replace />} />
  <Route path="accueil"        element={<AdminAccueilPage />} />
  <Route path="modules"        element={<AdminModulesPage />} />
  <Route path="accounts"       element={<AdminAccountsPage />} />
  <Route path="create-account" element={<AdminCreateAccountPage />} />
  <Route path="settings"       element={<AdminSettingsPage />} />
  <Route path="dashboard"      element={<DashboardAdmin />} />
</Route>
```

Also remove the old redirect shortcuts that pointed to flat routes — they are no longer needed:
```jsx
// REMOVE:
<Route path="/admin_principal" element={<Navigate to="/admin" replace />} />
<Route path="/admin_stock"     element={<Navigate to="/stock" replace />} />
<Route path="/admin_finance"   element={<Navigate to="/finance" replace />} />
<Route path="/admin_facture"   element={<Navigate to="/facturation" replace />} />
```
> Keep them only if any existing links in the codebase still use these paths. If they do, update those links and remove the redirects.

```bash
cd Front && npm run build
git add src/App.jsx
git rm src/pages/admin/Admin.jsx src/pages/admin/Admin.css
git commit -m "feat(admin): wire nested routes, remove Admin monolith"
```

---

## Task 13: Smoke Test All Modules

- [ ] **Step 13.1: Start dev server and verify each module**

```bash
cd Front && npm run dev
```

Check each module:

| URL | Expected |
|---|---|
| `/stock` | redirects to `/stock/products`, sidebar shows Products highlighted |
| `/stock/categories` | Categories page, sidebar shows Catégories highlighted |
| `/stock/categories` → "Voir dans Produits" | navigates to `/stock/products?category=X`, filter pre-set |
| `/stock/dashboard` | DashboardStock renders inside StockLayout sidebar |
| `/finance` | redirects to `/finance/transactions` |
| `/finance/accounts` → "Voir transactions" | navigates to `/finance/transactions?account=X` |
| `/facturation` | redirects to `/facturation/orders` |
| `/facturation/clients` → "Voir commandes" | navigates to `/facturation/orders?search=X` |
| `/admin` | redirects to `/admin/accueil` |
| `/login` → admin_stock user | lands on `/stock/products` |
| `/login` → admin_finance user | lands on `/finance/transactions` |
| Disabled module | shows `<ModuleDisabledView />` when navigating to any sub-page |

- [ ] **Step 13.2: Final commit if any fixes needed**

```bash
git add -p   # stage only the fix
git commit -m "fix: <describe what was wrong>"
```
