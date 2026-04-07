// src/pages/admin/layout/AdminLayout.jsx
import { useEffect, useState } from "react"
import { Outlet, NavLink, useNavigate } from "react-router-dom"
import { clearAuth } from "../../../utils/auth"
import userService from "../../../services/userService"
import "./AdminLayout.css"

function AdminLayout() {
  const navigate = useNavigate()

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [userSettings, setUserSettings] = useState({
    firstName: "Admin",
    lastName: "Principal",
    email: "",
    department: ""
  })

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const response = await userService.getProfile()
        const profile = response?.data || response
        if (!active) return
        setUserSettings(prev => ({
          ...prev,
          firstName: profile?.firstName || "Admin",
          lastName: profile?.lastName || "Principal",
          email: profile?.email || "",
          department: profile?.department || "Direction"
        }))
      } catch {
        // silently ignore profile load errors
      }
    })()
    return () => { active = false }
  }, [])

  const handleLogout = () => {
    clearAuth()
    navigate("/login")
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={{ ...styles.sidebar, width: sidebarCollapsed ? "80px" : "280px" }}>
        <div style={styles.sidebarHeader}>
          {!sidebarCollapsed && (
            <NavLink to="/admin/accueil" style={{ textDecoration: "none" }}>
              <div style={styles.logoContainer}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="10" fill="#667eea" />
                  <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <div>
                  <h1 style={styles.logoTitle}>ERP</h1>
                  <p style={styles.logoSubtitle}>Administration</p>
                </div>
              </div>
            </NavLink>
          )}
          {sidebarCollapsed && (
            <NavLink to="/admin/accueil" style={{ textDecoration: "none" }}>
              <div style={styles.logoCollapsed}>
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                  <rect width="40" height="40" rx="10" fill="#667eea" />
                  <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
            </NavLink>
          )}
          <button
            onClick={() => setSidebarCollapsed(c => !c)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "#a0aec0",
              fontSize: "1.2rem",
              marginLeft: "auto"
            }}
          >
            {sidebarCollapsed ? "›" : "‹"}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div style={styles.profileSection}>
            <div style={styles.avatar}>
              {userSettings.firstName?.charAt(0).toUpperCase() || "A"}
            </div>
            <div style={styles.userInfo}>
              <div style={styles.userName}>
                {userSettings.firstName} {userSettings.lastName}
              </div>
              <div style={styles.userEmail}>{userSettings.email}</div>
              {userSettings.department && (
                <div style={styles.userDepartment}>{userSettings.department}</div>
              )}
            </div>
          </div>
        )}

        {sidebarCollapsed && (
          <div style={styles.avatarCollapsed}>
            {userSettings.firstName?.charAt(0).toUpperCase() || "A"}
          </div>
        )}

        <div style={styles.navContainer}>
          <p style={!sidebarCollapsed ? styles.navTitle : styles.navTitleCollapsed}>
            {!sidebarCollapsed ? "MENU" : "M"}
          </p>

          <NavLink
            to="/admin/accueil"
            style={({ isActive }) => ({
              ...styles.navButton,
              background: isActive ? "#667eea" : "transparent",
              color: isActive ? "white" : "#4a5568",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              padding: sidebarCollapsed ? "12px" : "12px 20px",
              marginBottom: "8px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            })}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83C\uDFE0"}</span>
            {!sidebarCollapsed && "Page d'accueil"}
          </NavLink>

          <NavLink
            to="/admin/modules"
            style={({ isActive }) => ({
              ...styles.navButton,
              background: isActive ? "#805ad5" : "#9f7aea",
              color: "white",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              padding: sidebarCollapsed ? "12px" : "12px 20px",
              marginBottom: "10px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            })}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83D\uDCCA"}</span>
            {!sidebarCollapsed && (
              <span style={{ flex: 1, textAlign: "left" }}>Gestion des modules</span>
            )}
          </NavLink>

          <NavLink
            to="/admin/accounts"
            style={({ isActive }) => ({
              ...styles.navButton,
              background: isActive ? "#2b6cb0" : "#4299e1",
              color: "white",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              padding: sidebarCollapsed ? "12px" : "12px 20px",
              marginBottom: "10px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            })}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83D\uDC65"}</span>
            {!sidebarCollapsed && (
              <span style={{ flex: 1, textAlign: "left" }}>Consulter les comptes</span>
            )}
          </NavLink>

          <NavLink
            to="/admin/create-account"
            style={({ isActive }) => ({
              ...styles.navButton,
              background: isActive ? "#38a169" : "#48bb78",
              color: "white",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              padding: sidebarCollapsed ? "12px" : "12px 20px",
              marginBottom: "10px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            })}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\u2795"}</span>
            {!sidebarCollapsed && "Cr\u00E9er un compte"}
          </NavLink>

          <NavLink
            to="/admin/settings"
            style={({ isActive }) => ({
              ...styles.navButton,
              background: isActive ? "#2d3748" : "#4a5568",
              color: "white",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              padding: sidebarCollapsed ? "12px" : "12px 20px",
              marginBottom: "8px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            })}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\u2699\uFE0F"}</span>
            {!sidebarCollapsed && "Param\u00E8tres"}
          </NavLink>

          <NavLink
            to="/admin/dashboard"
            style={({ isActive }) => ({
              ...styles.navButton,
              background: isActive ? "#553c9a" : "#805ad5",
              color: "white",
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              padding: sidebarCollapsed ? "12px" : "12px 20px",
              marginBottom: "8px",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "12px"
            })}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83D\uDCCA"}</span>
            {!sidebarCollapsed && "Dashboard"}
          </NavLink>
        </div>

        <div style={styles.logoutSection}>
          <button
            onClick={handleLogout}
            style={{
              ...styles.logoutButton,
              justifyContent: sidebarCollapsed ? "center" : "flex-start",
              padding: sidebarCollapsed ? "12px" : "12px 20px"
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#c53030")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f56565")}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83D\uDEAA"}</span>
            {!sidebarCollapsed && "D\u00E9connexion"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{ ...styles.mainContent, marginLeft: sidebarCollapsed ? "80px" : "280px" }}>
        <Outlet />
      </div>
    </div>
  )
}

// ===== STYLES =====
const styles = {
  container: {
    display: "flex",
    minHeight: "100vh",
    background: "#f7fafc"
  },
  sidebar: {
    background: "white",
    boxShadow: "4px 0 20px rgba(0,0,0,0.05)",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 100,
    transition: "width 0.3s ease"
  },
  sidebarHeader: {
    padding: "24px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    cursor: "pointer"
  },
  logoTitle: {
    fontSize: "1.4rem",
    fontWeight: 700,
    color: "#1a202c",
    margin: 0
  },
  logoSubtitle: {
    fontSize: "0.8rem",
    color: "#718096",
    margin: 0
  },
  logoCollapsed: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    cursor: "pointer"
  },
  profileSection: {
    padding: "24px",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: "16px"
  },
  avatar: {
    width: "50px",
    height: "50px",
    borderRadius: "12px",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.4rem",
    fontWeight: 700
  },
  avatarCollapsed: {
    width: "40px",
    height: "40px",
    borderRadius: "10px",
    background: "linear-gradient(135deg, #667eea, #764ba2)",
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.2rem",
    fontWeight: 700,
    margin: "20px auto"
  },
  userInfo: {
    flex: 1
  },
  userName: {
    fontWeight: 700,
    color: "#1a202c"
  },
  userEmail: {
    color: "#718096",
    fontSize: "0.85rem"
  },
  userDepartment: {
    color: "#a0aec0",
    fontSize: "0.75rem",
    marginTop: "2px"
  },
  navContainer: {
    padding: "24px",
    flex: 1,
    overflowY: "auto"
  },
  navTitle: {
    fontSize: "0.7rem",
    textTransform: "uppercase",
    color: "#a0aec0",
    marginBottom: "16px",
    fontWeight: 600,
    letterSpacing: "0.5px"
  },
  navTitleCollapsed: {
    fontSize: "0.7rem",
    textTransform: "uppercase",
    color: "#a0aec0",
    marginBottom: "16px",
    fontWeight: 600,
    textAlign: "center"
  },
  navButton: {
    padding: "12px 20px",
    border: "none",
    borderRadius: "10px",
    fontSize: "0.95rem",
    fontWeight: 500,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    width: "100%",
    marginBottom: "8px",
    transition: "all 0.3s",
    background: "transparent"
  },
  filterBadge: {
    background: "rgba(255,255,255,0.2)",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "0.8rem",
    fontWeight: 600
  },
  logoutSection: {
    padding: "24px",
    borderTop: "1px solid #e2e8f0"
  },
  logoutButton: {
    padding: "12px 20px",
    background: "#f56565",
    color: "white",
    border: "none",
    borderRadius: "10px",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    transition: "all 0.3s"
  },
  mainContent: {
    flex: 1,
    padding: "32px",
    background: "#f7fafc",
    transition: "margin-left 0.3s ease"
  }
}

export default AdminLayout
