// src/pages/admin/pages/ModulesPage.jsx
import { useEffect, useState } from "react"
import userService from "../../../services/userService"
import { extractApiErrorMessage } from "../../../utils/frontendApiAdapters"

function ModulesPage() {
  const [baseModules, setBaseModules] = useState([
    { id: 'facturation', name: 'Facturation', icon: '\uD83D\uDCB0', color: '#667eea', count: 12, active: true, type: 'base', category: 'Gestion', createdAt: '2024-01-15' },
    { id: 'stock', name: 'Stock', icon: '\uD83D\uDCE6', color: '#9f7aea', count: 8, active: true, type: 'base', category: 'Inventaire', createdAt: '2024-01-15' },
    { id: 'finance', name: 'Finance', icon: '\uD83D\uDCB5', color: '#ed8936', count: 5, active: true, type: 'base', category: 'Comptabilit\u00E9', createdAt: '2024-01-15' },
  ])
  const [customModules, setCustomModules] = useState([])
  const [moduleSearchTerm, setModuleSearchTerm] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const allModules = [...baseModules, ...customModules]

  const filteredModules = allModules.filter(module =>
    module.name.toLowerCase().includes(moduleSearchTerm.toLowerCase()) ||
    module.category?.toLowerCase().includes(moduleSearchTerm.toLowerCase()) ||
    module.type.toLowerCase().includes(moduleSearchTerm.toLowerCase())
  )

  const moduleStats = {
    total: allModules.length,
    actifs: allModules.filter(m => m.active).length,
    inactifs: allModules.filter(m => !m.active).length,
  }

  const saveModulePreferences = async (nextBaseModules, nextCustomModules) => {
    await userService.updatePreferences('admin', {
      modules: [...nextBaseModules, ...nextCustomModules].map(module => ({
        id: module.id,
        active: module.active
      }))
    })
  }

  const loadModulePreferences = async () => {
    try {
      const preferencesResponse = await userService.getPreferences('admin').catch(() => ({ data: {} }))
      const preferences = preferencesResponse?.data || preferencesResponse
      const preferenceEntries = Array.isArray(preferences?.modules)
        ? preferences.modules
        : Object.entries(preferences?.moduleStates || {}).map(([id, active]) => ({ id, active }))

      if (!preferenceEntries.length) return

      const activeById = new Map(preferenceEntries.map((entry) => [entry.id, entry.active !== false]))
      setBaseModules(prev => prev.map(module => activeById.has(module.id) ? { ...module, active: activeById.get(module.id) } : module))
      setCustomModules(prev => prev.map(module => activeById.has(module.id) ? { ...module, active: activeById.get(module.id) } : module))
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    loadModulePreferences()
  }, [])

  const toggleModule = async (moduleId) => {
    const nextBaseModules = baseModules.map(module =>
      module.id === moduleId ? { ...module, active: !module.active } : module
    )
    const nextCustomModules = customModules.map(module =>
      module.id === moduleId ? { ...module, active: !module.active } : module
    )

    setBaseModules(nextBaseModules)
    setCustomModules(nextCustomModules)

    try {
      await saveModulePreferences(nextBaseModules, nextCustomModules)
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible d'enregistrer les modules"))
      await loadModulePreferences()
    }
  }

  const toggleAllModules = async (activate) => {
    const nextBaseModules = baseModules.map(module => ({ ...module, active: activate }))
    const nextCustomModules = customModules.map(module => ({ ...module, active: activate }))

    setBaseModules(nextBaseModules)
    setCustomModules(nextCustomModules)

    try {
      await saveModulePreferences(nextBaseModules, nextCustomModules)
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible d'enregistrer les modules"))
      await loadModulePreferences()
    }
  }

  const styles = {
    pageContainer: {
      background: "white",
      borderRadius: "16px",
      padding: "32px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
    },
    pageTitle: {
      fontSize: "1.8rem",
      color: "#1a202c",
      margin: "0 0 32px 0",
      textAlign: "center"
    },
    modulesStatsContainer: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "16px",
      marginBottom: "32px"
    },
    statCard: {
      background: "#4a5568",
      borderRadius: "12px",
      padding: "20px",
      textAlign: "center",
      color: "white",
      boxShadow: "0 4px 6px rgba(0,0,0,0.1)"
    },
    statCardValue: {
      display: "block",
      fontSize: "2rem",
      fontWeight: 700,
      marginBottom: "4px"
    },
    statCardLabel: {
      fontSize: "0.9rem",
      opacity: 0.9
    },
    modulesToolbar: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: "24px",
      gap: "16px",
      flexWrap: "wrap"
    },
    modulesSearch: {
      position: "relative",
      flex: 2,
      minWidth: "300px"
    },
    modulesSearchInput: {
      width: "100%",
      padding: "12px 16px",
      border: "2px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "0.95rem",
      outline: "none",
      boxSizing: "border-box"
    },
    modulesClearButton: {
      position: "absolute",
      right: "12px",
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      color: "#a0aec0",
      cursor: "pointer",
      fontSize: "1rem"
    },
    modulesBulkActions: {
      display: "flex",
      gap: "8px",
      flexWrap: "wrap"
    },
    modulesBulkButton: {
      padding: "10px 16px",
      background: "#edf2f7",
      border: "1px solid #e2e8f0",
      borderRadius: "8px",
      fontSize: "0.9rem",
      fontWeight: 500,
      color: "#4a5568",
      cursor: "pointer",
      transition: "all 0.3s"
    },
    modulesTableWrapper: {
      overflowX: "auto",
      borderRadius: "8px",
      border: "1px solid #e2e8f0",
      background: "white"
    },
    modulesTable: {
      width: "100%",
      borderCollapse: "collapse",
      minWidth: "800px"
    },
    modulesTableHeader: {
      padding: "16px",
      textAlign: "left",
      fontSize: "0.85rem",
      fontWeight: 600,
      color: "#4a5568",
      textTransform: "uppercase",
      letterSpacing: "0.5px",
      borderBottom: "2px solid #e2e8f0",
      background: "#f8fafc"
    },
    modulesTableRow: {
      transition: "background 0.3s",
      cursor: "pointer"
    },
    modulesTableCell: {
      padding: "16px",
      borderBottom: "1px solid #edf2f7",
      fontSize: "0.95rem"
    },
    modulesStatusBadge: {
      padding: "6px 12px",
      borderRadius: "20px",
      color: "white",
      fontSize: "0.8rem",
      fontWeight: 600,
      display: "inline-block"
    },
    modulesNameCell: {
      display: "flex",
      alignItems: "center",
      gap: "8px"
    },
    modulesNameText: {
      fontWeight: 500,
      color: "#2d3748"
    },
    modulesCountBadge: {
      background: "#e2e8f0",
      padding: "2px 8px",
      borderRadius: "12px",
      fontSize: "0.75rem",
      color: "#4a5568"
    },
    modulesCategoryBadge: {
      background: "#e9d8fd",
      padding: "4px 10px",
      borderRadius: "16px",
      fontSize: "0.8rem",
      color: "#553c9a"
    },
    modulesTypeBadge: {
      padding: "4px 10px",
      borderRadius: "16px",
      fontSize: "0.8rem",
      color: "white",
      display: "inline-block"
    },
    modulesDateText: {
      color: "#718096",
      fontSize: "0.85rem"
    },
    modulesActionButton: {
      padding: "8px 16px",
      color: "white",
      border: "none",
      borderRadius: "6px",
      fontSize: "0.85rem",
      fontWeight: 500,
      cursor: "pointer",
      transition: "all 0.3s"
    },
    modulesNoResults: {
      padding: "40px",
      textAlign: "center",
      color: "#a0aec0",
      fontSize: "0.95rem"
    },
    modulesTableFooter: {
      padding: "16px",
      borderTop: "1px solid #e2e8f0",
      textAlign: "right",
      background: "#f8fafc",
      borderRadius: "0 0 8px 8px"
    },
    modulesFooterText: {
      fontSize: "0.85rem",
      color: "#718096"
    }
  }

  return (
    <div style={styles.pageContainer}>
      <h1 style={styles.pageTitle}>Gestion des modules</h1>

      {errorMessage && (
        <div style={{ padding: "12px", borderRadius: "8px", marginBottom: "20px", background: "#fff5f5", border: "1px solid #feb2b2", color: "#c53030" }}>
          {errorMessage}
        </div>
      )}

      <div style={styles.modulesStatsContainer}>
        <div style={styles.statCard}>
          <span style={styles.statCardValue}>{moduleStats.total}</span>
          <span style={styles.statCardLabel}>Total</span>
        </div>
        <div style={{ ...styles.statCard, background: '#48bb78' }}>
          <span style={styles.statCardValue}>{moduleStats.actifs}</span>
          <span style={styles.statCardLabel}>Actifs</span>
        </div>
        <div style={{ ...styles.statCard, background: '#f56565' }}>
          <span style={styles.statCardValue}>{moduleStats.inactifs}</span>
          <span style={styles.statCardLabel}>Inactifs</span>
        </div>
      </div>

      <div style={styles.modulesToolbar}>
        <div style={styles.modulesSearch}>
          <input
            type="text"
            placeholder="Rechercher module"
            value={moduleSearchTerm}
            onChange={(e) => setModuleSearchTerm(e.target.value)}
            style={styles.modulesSearchInput}
          />
          {moduleSearchTerm && (
            <button onClick={() => setModuleSearchTerm("")} style={styles.modulesClearButton}>
              {"\u2715"}
            </button>
          )}
        </div>

        <div style={styles.modulesBulkActions}>
          <button onClick={() => toggleAllModules(true)} style={styles.modulesBulkButton}>
            {"\u2705 Tout activer"}
          </button>
          <button onClick={() => toggleAllModules(false)} style={styles.modulesBulkButton}>
            {"\u274C Tout d\u00E9sactiver"}
          </button>
        </div>
      </div>

      <div style={styles.modulesTableWrapper}>
        <table style={styles.modulesTable}>
          <thead>
            <tr>
              <th style={styles.modulesTableHeader}>{"\u00C9tat"}</th>
              <th style={styles.modulesTableHeader}>{"Ic\u00F4ne"}</th>
              <th style={styles.modulesTableHeader}>Nom</th>
              <th style={styles.modulesTableHeader}>{"Cat\u00E9gorie"}</th>
              <th style={styles.modulesTableHeader}>Type</th>
              <th style={styles.modulesTableHeader}>{"Cr\u00E9ation"}</th>
              <th style={styles.modulesTableHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredModules.length > 0 ? (
              filteredModules.map(module => (
                <tr key={module.id} style={styles.modulesTableRow}>
                  <td style={styles.modulesTableCell}>
                    <span style={{
                      ...styles.modulesStatusBadge,
                      backgroundColor: module.active ? '#48bb78' : '#f56565'
                    }}>
                      {module.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={{ fontSize: '1.5rem' }}>{module.icon}</span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <div style={styles.modulesNameCell}>
                      <span style={styles.modulesNameText}>{module.name}</span>
                      {module.count > 0 && (
                        <span style={styles.modulesCountBadge}>{module.count}</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={styles.modulesCategoryBadge}>
                      {module.category || "G\u00E9n\u00E9ral"}
                    </span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={{
                      ...styles.modulesTypeBadge,
                      backgroundColor: module.type === 'base' ? '#667eea' : '#9f7aea'
                    }}>
                      {module.type === 'base' ? 'Base' : 'Personnalis\u00E9'}
                    </span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={styles.modulesDateText}>{module.createdAt || 'N/A'}</span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <button
                      onClick={() => toggleModule(module.id)}
                      style={{
                        ...styles.modulesActionButton,
                        backgroundColor: module.active ? '#f56565' : '#48bb78'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.backgroundColor = module.active ? '#c53030' : '#38a169'
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.backgroundColor = module.active ? '#f56565' : '#48bb78'
                      }}
                    >
                      {module.active ? 'D\u00E9sactiver' : 'Activer'}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={styles.modulesNoResults}>
                  {"Aucun module trouv\u00E9"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.modulesTableFooter}>
        <span style={styles.modulesFooterText}>
          Affichage de {filteredModules.length} module(s) sur {allModules.length}
        </span>
      </div>
    </div>
  )
}

export default ModulesPage
