// src/pages/admin/pages/AccountsPage.jsx
import { useEffect, useState } from "react"
import userService from "../../../services/userService"
import { extractApiErrorMessage, mapUserToAdminAccount, pickList } from "../../../utils/frontendApiAdapters"

function AccountsPage() {
  const [accounts, setAccounts] = useState([])
  const [accountSearchTerm, setAccountSearchTerm] = useState("")
  const [errorMessage, setErrorMessage] = useState("")

  const filteredAccounts = accounts.filter(account =>
    account.firstName.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    account.lastName.toLowerCase().includes(accountSearchTerm.toLowerCase())
  )

  const accountStats = {
    total: accounts.length,
    actifs: accounts.filter(a => a.active).length,
    inactifs: accounts.filter(a => !a.active).length,
  }

  const loadAccounts = async () => {
    try {
      const usersResponse = await userService.getUsers({ limit: 200 })
      setAccounts(pickList(usersResponse, ['data']).map(mapUserToAdminAccount))
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible de charger les comptes"))
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  const getModuleIcon = (role) => {
    const icons = {
      'admin': '\uD83D\uDC51',
      'manager': '\uD83D\uDC54',
      'user': '\uD83D\uDC64',
      'comptable': '\uD83D\uDCCA',
      'commercial': '\uD83D\uDCC8',
      'default': '\uD83D\uDCC1'
    }
    return icons[role] || icons.default
  }

  const getRoleBadgeColor = (role) => {
    const colors = {
      'admin': '#667eea',
      'manager': '#ed8936',
      'comptable': '#48bb78',
      'commercial': '#4299e1',
      'user': '#9f7aea',
    }
    return colors[role] || '#a0aec0'
  }

  const getRoleLabel = (role) => {
    const labels = {
      'admin': 'Admin',
      'manager': 'Manager',
      'comptable': 'Comptable',
      'commercial': 'Commercial',
      'user': 'Utilisateur',
    }
    return labels[role] || role
  }

  const toggleAccountStatus = async (accountId) => {
    try {
      await userService.toggleUserStatus(accountId)
      await loadAccounts()
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible de modifier le statut du compte"))
    }
  }

  const toggleAllAccounts = async (activate) => {
    const accountsToUpdate = accounts.filter(account => account.active !== activate)
    if (!accountsToUpdate.length) return
    try {
      await Promise.all(accountsToUpdate.map(account => userService.toggleUserStatus(account.id)))
      await loadAccounts()
    } catch (error) {
      setErrorMessage(extractApiErrorMessage(error, "Impossible de mettre \u00E0 jour les comptes"))
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
    modulesNameText: {
      fontWeight: 500,
      color: "#2d3748"
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
      <h1 style={styles.pageTitle}>Consulter les comptes</h1>

      {errorMessage && (
        <div style={{ padding: "12px", borderRadius: "8px", marginBottom: "20px", background: "#fff5f5", border: "1px solid #feb2b2", color: "#c53030" }}>
          {errorMessage}
        </div>
      )}

      <div style={styles.modulesStatsContainer}>
        <div style={styles.statCard}>
          <span style={styles.statCardValue}>{accountStats.total}</span>
          <span style={styles.statCardLabel}>Total</span>
        </div>
        <div style={{ ...styles.statCard, background: '#48bb78' }}>
          <span style={styles.statCardValue}>{accountStats.actifs}</span>
          <span style={styles.statCardLabel}>Actifs</span>
        </div>
        <div style={{ ...styles.statCard, background: '#f56565' }}>
          <span style={styles.statCardValue}>{accountStats.inactifs}</span>
          <span style={styles.statCardLabel}>Inactifs</span>
        </div>
      </div>

      <div style={styles.modulesToolbar}>
        <div style={styles.modulesSearch}>
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={accountSearchTerm}
            onChange={(e) => setAccountSearchTerm(e.target.value)}
            style={styles.modulesSearchInput}
          />
          {accountSearchTerm && (
            <button onClick={() => setAccountSearchTerm("")} style={styles.modulesClearButton}>
              {"\u2715"}
            </button>
          )}
        </div>

        <div style={styles.modulesBulkActions}>
          <button
            onClick={() => toggleAllAccounts(true)}
            style={{ ...styles.modulesBulkButton, backgroundColor: '#48bb78', color: 'white' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#38a169'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#48bb78'}
          >
            {"\u2705 Tout activer"}
          </button>
          <button
            onClick={() => toggleAllAccounts(false)}
            style={{ ...styles.modulesBulkButton, backgroundColor: '#f56565', color: 'white' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c53030'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f56565'}
          >
            {"\u274C Tout d\u00E9sactiver"}
          </button>
        </div>
      </div>

      <div style={styles.modulesTableWrapper}>
        <table style={styles.modulesTable}>
          <thead>
            <tr>
              <th style={styles.modulesTableHeader}>ID</th>
              <th style={styles.modulesTableHeader}>{"\u00C9tat"}</th>
              <th style={styles.modulesTableHeader}>Utilisateur</th>
              <th style={styles.modulesTableHeader}>Email</th>
              <th style={styles.modulesTableHeader}>{"R\u00F4le"}</th>
              <th style={styles.modulesTableHeader}>{"D\u00E9partement"}</th>
              <th style={styles.modulesTableHeader}>{"Cr\u00E9\u00E9 le"}</th>
              <th style={styles.modulesTableHeader}>{"Derni\u00E8re connexion"}</th>
              <th style={styles.modulesTableHeader}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAccounts.length > 0 ? (
              filteredAccounts.map(account => (
                <tr
                  key={account.id}
                  style={{
                    ...styles.modulesTableRow,
                    opacity: account.active ? 1 : 0.65
                  }}
                >
                  <td style={{ ...styles.modulesTableCell, fontSize: '0.7rem', color: '#a0aec0', fontFamily: 'monospace' }}>
                    {account.id}
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={{
                      ...styles.modulesStatusBadge,
                      backgroundColor: account.active ? '#48bb78' : '#f56565'
                    }}>
                      {account.active ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: `linear-gradient(135deg, ${getRoleBadgeColor(account.role)}, #764ba2)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '0.9rem',
                        flexShrink: 0
                      }}>
                        {account.firstName.charAt(0).toUpperCase()}
                      </div>
                      <span style={styles.modulesNameText}>
                        {account.firstName} {account.lastName}
                      </span>
                    </div>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={{ color: '#718096', fontSize: '0.9rem' }}>{account.email}</span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={{
                      ...styles.modulesTypeBadge,
                      backgroundColor: getRoleBadgeColor(account.role)
                    }}>
                      {getModuleIcon(account.role)} {getRoleLabel(account.role)}
                    </span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={styles.modulesCategoryBadge}>
                      {account.department}
                    </span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={styles.modulesDateText}>{account.createdAt}</span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    <span style={styles.modulesDateText}>{account.lastLogin}</span>
                  </td>
                  <td style={styles.modulesTableCell}>
                    {account.active ? (
                      <button
                        onClick={() => toggleAccountStatus(account.id)}
                        style={{ ...styles.modulesActionButton, backgroundColor: '#f56565' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#c53030' }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#f56565' }}
                      >
                        {"D\u00E9sactiver"}
                      </button>
                    ) : (
                      <button
                        onClick={() => toggleAccountStatus(account.id)}
                        style={{ ...styles.modulesActionButton, backgroundColor: '#48bb78' }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#38a169' }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#48bb78' }}
                      >
                        Activer
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="9" style={styles.modulesNoResults}>
                  {"Aucun compte trouv\u00E9"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={styles.modulesTableFooter}>
        <span style={styles.modulesFooterText}>
          Affichage de {filteredAccounts.length} compte(s) sur {accounts.length}
        </span>
      </div>
    </div>
  )
}

export default AccountsPage
