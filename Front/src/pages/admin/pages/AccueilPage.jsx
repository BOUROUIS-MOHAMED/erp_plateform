// src/pages/admin/pages/AccueilPage.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import userService from "../../../services/userService"
import { extractApiErrorMessage } from "../../../utils/frontendApiAdapters"

function AccueilPage() {
  const navigate = useNavigate()

  const [userName, setUserName] = useState("Admin")
  const [searchTerm, setSearchTerm] = useState("")

  const [baseModules, setBaseModules] = useState([
    { id: 'facturation', name: 'Facturation', icon: '\uD83D\uDCB0', color: '#667eea', count: 12, active: true, type: 'base', category: 'Gestion', createdAt: '2024-01-15' },
    { id: 'stock', name: 'Stock', icon: '\uD83D\uDCE6', color: '#9f7aea', count: 8, active: true, type: 'base', category: 'Inventaire', createdAt: '2024-01-15' },
    { id: 'finance', name: 'Finance', icon: '\uD83D\uDCB5', color: '#ed8936', count: 5, active: true, type: 'base', category: 'Comptabilit\u00E9', createdAt: '2024-01-15' },
  ])
  const [customModules, setCustomModules] = useState([])

  const allModules = [...baseModules, ...customModules]
  const activeModulesCount = allModules.filter(m => m.active).length

  const pages = [
    { id: 1, name: 'Dashboard Facturation', path: '/facturation/dashboard', icon: '\uD83D\uDCB0', color: '#667eea', module: 'facturation' },
    { id: 2, name: 'Dashboard Stock', path: '/stock/dashboard', icon: '\uD83D\uDCE6', color: '#9f7aea', module: 'stock' },
    { id: 3, name: 'Dashboard Finance', path: '/finance/dashboard', icon: '\uD83D\uDCB5', color: '#ed8936', module: 'finance' },
    { id: 4, name: 'Gestion Stock', path: '/stock', icon: '\uD83D\uDCE6', color: '#9f7aea', module: 'stock' },
    { id: 5, name: 'Gestion Facturation', path: '/facturation', icon: '\uD83D\uDCCB', color: '#38a169', module: 'facturation' },
    { id: 6, name: 'Gestion Finance', path: '/finance', icon: '\uD83D\uDCC4', color: '#ed8936', module: 'finance' },
  ]

  const getCustomPages = () => {
    return customModules.flatMap((module, index) => [
      {
        id: 100 + (index * 2),
        name: `Dashboard ${module.name}`,
        path: `/${module.id}/dashboard`,
        icon: module.icon,
        color: module.color,
        module: module.id
      },
      {
        id: 101 + (index * 2),
        name: `Gestion ${module.name}`,
        path: `/${module.id}`,
        icon: '\uD83D\uDCCB',
        color: module.color,
        module: module.id
      }
    ])
  }

  const allPages = [...pages, ...getCustomPages()]

  const getFilteredPages = () => {
    return allPages.filter(page => {
      if (!page.module) return true
      const module = allModules.find(m => m.id === page.module)
      return module ? module.active : true
    })
  }

  const displayedPages = getFilteredPages()

  const filteredPages = displayedPages.filter(page =>
    page.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const [profileResponse, usersResponse] = await Promise.all([
          userService.getProfile(),
          userService.getUsers({ limit: 200 })
        ])
        if (!active) return
        const profile = profileResponse?.data || profileResponse
        setUserName(profile?.firstName || "Admin")
      } catch {
        // silently ignore
      }
    })()
    return () => { active = false }
  }, [])

  const styles = {
    mainHeader: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "32px",
      flexWrap: "wrap",
      gap: "20px"
    },
    welcomeTitle: {
      fontSize: "2rem",
      margin: "0 0 5px 0",
      color: "#1a202c"
    },
    filterIndicator: {
      margin: 0,
      fontSize: "0.9rem",
      color: "#718096",
      display: "flex",
      alignItems: "center"
    },
    filterDot: {
      color: "#f56565",
      fontSize: "1.2rem",
      marginRight: "5px"
    },
    searchContainer: {
      background: "white",
      borderRadius: "50px",
      padding: "4px 20px",
      display: "flex",
      alignItems: "center",
      border: "1px solid #e2e8f0",
      width: "350px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
    },
    searchIcon: {
      color: "#a0aec0",
      marginRight: "10px"
    },
    searchInput: {
      width: "100%",
      padding: "12px 0",
      border: "none",
      background: "transparent",
      fontSize: "0.95rem",
      outline: "none"
    },
    clearButton: {
      background: "none",
      border: "none",
      color: "#a0aec0",
      cursor: "pointer",
      fontSize: "1.2rem"
    },
    searchResults: {
      background: "white",
      borderRadius: "16px",
      padding: "24px",
      marginBottom: "32px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
    },
    resultsCount: {
      color: "#718096",
      fontSize: "0.9rem",
      marginBottom: "16px"
    },
    resultsList: {
      display: "flex",
      flexWrap: "wrap",
      gap: "10px"
    },
    resultItem: {
      color: "white",
      padding: "10px 20px",
      borderRadius: "30px",
      cursor: "pointer",
      display: "inline-flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "0.95rem",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
      transition: "all 0.3s",
      position: "relative"
    },
    hiddenBadge: {
      background: "rgba(0,0,0,0.2)",
      padding: "2px 6px",
      borderRadius: "10px",
      fontSize: "0.7rem",
      marginLeft: "5px"
    },
    modulesGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: "24px"
    },
    moduleCard: {
      background: "white",
      borderRadius: "16px",
      padding: "24px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
      transition: "all 0.3s",
      cursor: "pointer"
    },
    moduleIcon: {
      width: "60px",
      height: "60px",
      borderRadius: "12px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      marginBottom: "16px"
    },
    moduleTitle: {
      fontSize: "1.3rem",
      margin: "0 0 8px 0",
      color: "#1a202c"
    },
    moduleStats: {
      color: "#718096",
      fontSize: "0.9rem",
      marginBottom: "16px",
      minHeight: "20px"
    },
    moduleActions: {
      display: "flex",
      gap: "12px"
    },
    moduleButton: {
      padding: "8px 16px",
      background: "#667eea",
      color: "white",
      border: "none",
      borderRadius: "8px",
      fontSize: "0.9rem",
      cursor: "pointer",
      flex: 1
    },
    moduleButtonSecondary: {
      padding: "8px 16px",
      background: "white",
      color: "#4a5568",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "0.9rem",
      cursor: "pointer",
      flex: 1
    },
    noActiveModules: {
      background: "white",
      borderRadius: "16px",
      padding: "40px",
      textAlign: "center",
      color: "#718096",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
    }
  }

  return (
    <>
      <div style={styles.mainHeader}>
        <div>
          <h1 style={styles.welcomeTitle}>
            Bonjour, <span style={{ color: '#667eea' }}>{userName}</span> {"\uD83D\uDC4B"}
          </h1>
          {activeModulesCount < allModules.length && (
            <p style={styles.filterIndicator}>
              <span style={styles.filterDot}>{"\u2022"}</span>
              {allModules.length - activeModulesCount} {"module(s) masqu\u00E9(s)"}
            </p>
          )}
        </div>

        <div style={styles.searchContainer}>
          <span style={styles.searchIcon}>{"\uD83D\uDD0D"}</span>
          <input
            type="text"
            placeholder="Rechercher une page..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={styles.searchInput}
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm("")} style={styles.clearButton}>
              {"\u2715"}
            </button>
          )}
        </div>
      </div>

      {searchTerm && (
        <div style={styles.searchResults}>
          <p style={styles.resultsCount}>
            {filteredPages.length} {"r\u00E9sultat"}{filteredPages.length > 1 ? 's' : ''}
          </p>
          <div style={styles.resultsList}>
            {filteredPages.map(page => (
              <div
                key={page.id}
                onClick={() => navigate(page.path)}
                style={{
                  ...styles.resultItem,
                  backgroundColor: page.color,
                  opacity: page.module && !allModules.find(m => m.id === page.module)?.active ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <span>{page.icon}</span>
                {page.name}
                {page.module && !allModules.find(m => m.id === page.module)?.active && (
                  <span style={styles.hiddenBadge}>{"Masqu\u00E9"}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={styles.modulesGrid}>
        {baseModules.filter(m => m.active).map(module => (
          <div key={module.id} style={styles.moduleCard}>
            <div style={{ ...styles.moduleIcon, backgroundColor: module.color }}>
              <span style={{ fontSize: '2rem' }}>{module.icon}</span>
            </div>
            <h3 style={styles.moduleTitle}>{module.name}</h3>
            <p style={styles.moduleStats}>{module.count} {"actions r\u00E9centes"}</p>
            <div style={styles.moduleActions}>
              <button
                onClick={() => navigate(`/${module.id}/dashboard`)}
                style={styles.moduleButton}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate(`/${module.id}`)}
                style={styles.moduleButtonSecondary}
              >
                Gestion
              </button>
            </div>
          </div>
        ))}

        {customModules.filter(m => m.active).map(module => (
          <div key={module.id} style={styles.moduleCard}>
            <div style={{ ...styles.moduleIcon, backgroundColor: module.color }}>
              <span style={{ fontSize: '2rem' }}>{module.icon}</span>
            </div>
            <h3 style={styles.moduleTitle}>{module.name}</h3>
            <p style={styles.moduleStats}> </p>
            <div style={styles.moduleActions}>
              <button
                onClick={() => navigate(`/${module.id}/dashboard`)}
                style={styles.moduleButton}
              >
                Dashboard
              </button>
              <button
                onClick={() => navigate(`/${module.id}`)}
                style={styles.moduleButtonSecondary}
              >
                Gestion
              </button>
            </div>
          </div>
        ))}
      </div>

      {allModules.filter(m => m.active).length === 0 && (
        <div style={styles.noActiveModules}>
          <p>Aucun module actif. Allez dans <strong>Gestion des modules</strong> pour activer des modules.</p>
        </div>
      )}
    </>
  )
}

export default AccueilPage
