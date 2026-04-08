// src/pages/finance/layout/FinanceLayout.jsx
import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useModuleAvailability } from '../../../hooks/useModuleAvailability'
import ModuleDisabledView from '../../../components/ModuleDisabledView'
import { clearAuth, getUserEmail, getUserRole } from '../../../utils/auth'
import userService from '../../../services/userService'
import './FinanceLayout.css'

function FinanceLayout() {
  const navigate = useNavigate()
  const { blocked, checking } = useModuleAvailability('finance')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userInfo, setUserInfo] = useState({ firstName: '', lastName: '', email: '', department: '', role: '' })

  useEffect(() => {
    let active = true
    userService.getProfile().then(res => {
      if (!active) return
      const p = res?.data || res
      setUserInfo({
        firstName:  p?.firstName  || 'Gestionnaire',
        lastName:   p?.lastName   || 'Finance',
        email:      p?.email      || getUserEmail() || '',
        department: p?.department || 'Gestion Finance',
        role:       p?.role       || getUserRole() || 'admin_finance',
      })
    }).catch(() => {
      if (!active) return
      setUserInfo(u => ({ ...u, email: getUserEmail() || '', role: getUserRole() || '' }))
    })
    return () => { active = false }
  }, [])

  const handleLogout = () => { clearAuth(); navigate('/login') }

  if (checking) return <div className="finance-loading"><div className="spinner" /><p>Chargement...</p></div>
  if (blocked)  return <ModuleDisabledView accentColor="#ed8936" moduleLabel="Finance" />

  const isAdmin = userInfo.role === 'admin_principal'

  return (
    <div className="finance-container">
      {/* ===== SIDEBAR ===== */}
      <aside className={`finance-sidebar${sidebarCollapsed ? ' collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo-container">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="10" fill="#ed8936"/>
              <path d="M20 10V30M14 16h9a3 3 0 010 6h-9" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!sidebarCollapsed && <div><h1>ERP</h1><p>Gestion Finance</p></div>}
          </div>
          <button className="sidebar-toggle" onClick={() => setSidebarCollapsed(c => !c)}>
            {sidebarCollapsed ? '→' : '←'}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div className="user-profile">
            <div className="avatar" style={{ background: 'linear-gradient(135deg,#ed8936,#c05621)' }}>
              {userInfo.firstName?.charAt(0).toUpperCase() || 'F'}
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
              <p>MENU FINANCE</p>
              {isAdmin && (
                <button className="router-button" onClick={() => navigate('/admin')}>
                  👑 Admin
                </button>
              )}
            </div>
          )}
          <div className="menu-items">
            <NavLink to="/finance/dashboard"    className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">📊</span>{!sidebarCollapsed && <span>Dashboard Finance</span>}
            </NavLink>
            <NavLink to="/finance/transactions" className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">💰</span>{!sidebarCollapsed && <span>Transactions</span>}
            </NavLink>
            <NavLink to="/finance/accounts"     className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">🏦</span>{!sidebarCollapsed && <span>Comptes</span>}
            </NavLink>
            <NavLink to="/finance/moneyflow"    className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">💸</span>{!sidebarCollapsed && <span>Money Flow</span>}
            </NavLink>
            <NavLink to="/finance/reports"      className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
              <span className="menu-icon">📑</span>{!sidebarCollapsed && <span>Rapports</span>}
            </NavLink>
            <NavLink to="/finance/settings"     className={({ isActive }) => `menu-item${isActive ? ' active' : ''}`}>
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
      <main className="finance-main">
        <header className="main-header">
          <div>
            <h1 className="page-title">Gestion Finance</h1>
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

export default FinanceLayout
