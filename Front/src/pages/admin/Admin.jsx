// src/pages/admin/Admin.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getUserEmail, getUserRole, isAuthenticated } from "../../utils/auth"
import authService from "../../services/authService"
import userService from "../../services/userService"
import CreateAccount from "../../components/forms/CreateAccount"
import AccountSettings from "../../components/forms/AccountSettings"
import { extractApiErrorMessage, mapUserToAdminAccount, pickList } from "../../utils/frontendApiAdapters"
import "./Admin.css"

function Admin() {
  const navigate = useNavigate()
  
  // ===== ?TATS UTILISATEUR =====
  const [userEmail, setUserEmail] = useState("")
  const [userName, setUserName] = useState("")
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState(false)
  
  // ===== ?TATS DE L'INTERFACE =====
  const [currentPage, setCurrentPage] = useState('accueil')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [moduleSearchTerm, setModuleSearchTerm] = useState("")
  
  // ===== ?TATS DES PARAM?TRES =====
  const [userSettings, setUserSettings] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    department: '',
    role: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [settingsMessage, setSettingsMessage] = useState({ type: "", text: "" })
  const [settingsErrors, setSettingsErrors] = useState({})
  
  // ===== ?TATS DES MODULES =====
  const [baseModules, setBaseModules] = useState([
    { id: 'facturation', name: 'Facturation', icon: '\uD83D\uDCB0', color: '#667eea', count: 12, active: true, type: 'base', category: 'Gestion', createdAt: '2024-01-15' },
    { id: 'stock', name: 'Stock', icon: '\uD83D\uDCE6', color: '#9f7aea', count: 8, active: true, type: 'base', category: 'Inventaire', createdAt: '2024-01-15' },
    { id: 'finance', name: 'Finance', icon: '\uD83D\uDCB5', color: '#ed8936', count: 5, active: true, type: 'base', category: 'Comptabilit\u00E9', createdAt: '2024-01-15' },
  ])
  const [customModules, setCustomModules] = useState([])

  // ===== ?TATS DES COMPTES =====
  const [accounts, setAccounts] = useState([])
  // ===== ?TAT RECHERCHE COMPTES (simplifi?) =====
  const [accountSearchTerm, setAccountSearchTerm] = useState("")

  // ===== CONSTANTES =====
  const moduleColors = [
    '#48bb78', '#f56565', '#ed64a6', '#9f7aea', '#4299e1', '#ed8936', '#667eea', '#38a169'
  ]

  const pages = [
    { id: 1, name: 'Dashboard Facturation', path: '/facturation/dashboard', icon: '\uD83D\uDCB0', color: '#667eea', module: 'facturation' },
    { id: 2, name: 'Dashboard Stock', path: '/stock/dashboard', icon: '\uD83D\uDCE6', color: '#9f7aea', module: 'stock' },
    { id: 3, name: 'Dashboard Finance', path: '/finance/dashboard', icon: '\uD83D\uDCB5', color: '#ed8936', module: 'finance' },
    { id: 4, name: 'Gestion Stock', path: '/stock', icon: '\uD83D\uDCE6', color: '#9f7aea', module: 'stock' },
    { id: 5, name: 'Gestion Facturation', path: '/facturation', icon: '\uD83D\uDCCB', color: '#38a169', module: 'facturation' },
    { id: 6, name: 'Gestion Finance', path: '/finance', icon: '\uD83D\uDCC4', color: '#ed8936', module: 'finance' },
  ]

  // ===== DONN?ES D?RIV?ES =====
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
    bases: baseModules.length,
    personnalises: customModules.length
  }

  const activeModulesCount = allModules.filter(m => m.active).length

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

  // ===== DONN?ES D?RIV?ES COMPTES (recherche par nom uniquement) =====
  const filteredAccounts = accounts.filter(account =>
    account.firstName.toLowerCase().includes(accountSearchTerm.toLowerCase()) ||
    account.lastName.toLowerCase().includes(accountSearchTerm.toLowerCase())
  )

  const accountStats = {
    total: accounts.length,
    actifs: accounts.filter(a => a.active).length,
    inactifs: accounts.filter(a => !a.active).length,
  }

  // ===== FONCTIONS UTILITAIRES =====
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

  const applyProfileState = (profile, fallbackRole, fallbackEmail) => {
    const resolvedEmail = profile?.email || fallbackEmail || ""
    const resolvedRole = profile?.role || fallbackRole || "admin_principal"
    const firstName = profile?.firstName || "Admin"
    const lastName = profile?.lastName || "Principal"

    setUserEmail(resolvedEmail)
    setUserName(firstName || resolvedEmail.split('@')[0] || "Admin")
    setUserSettings(prev => ({
      ...prev,
      firstName,
      lastName,
      email: resolvedEmail,
      phone: profile?.phone || "",
      department: profile?.department || "Direction",
      role: resolvedRole,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }))
  }

  const applyModulePreferences = (preferences = {}) => {
    const preferenceEntries = Array.isArray(preferences?.modules)
      ? preferences.modules
      : Object.entries(preferences?.moduleStates || {}).map(([id, active]) => ({ id, active }))

    if (!preferenceEntries.length) {
      return
    }

    const activeById = new Map(preferenceEntries.map((entry) => [entry.id, entry.active !== false]))
    setBaseModules(prev => prev.map(module => activeById.has(module.id) ? { ...module, active: activeById.get(module.id) } : module))
    setCustomModules(prev => prev.map(module => activeById.has(module.id) ? { ...module, active: activeById.get(module.id) } : module))
  }

  const saveModulePreferences = async (nextBaseModules, nextCustomModules = customModules) => {
    await userService.updatePreferences('admin', {
      modules: [...nextBaseModules, ...nextCustomModules].map(module => ({
        id: module.id,
        active: module.active
      }))
    })
  }

  const loadAdminData = async (fallbackRole = "admin_principal", fallbackEmail = "") => {
    const [profileResponse, usersResponse, preferencesResponse] = await Promise.all([
      userService.getProfile(),
      userService.getUsers({ limit: 200 }),
      userService.getPreferences('admin').catch(() => ({ data: {} }))
    ])

    const profile = profileResponse?.data || profileResponse
    applyProfileState(profile, fallbackRole, fallbackEmail)
    setAccounts(pickList(usersResponse, ['data']).map(mapUserToAdminAccount))
    applyModulePreferences(preferencesResponse?.data || preferencesResponse)
  }

  // ===== FONCTIONS DE GESTION DES MODULES =====
  const toggleModule = async (moduleId) => {
    const nextBaseModules = baseModules.map(module =>
      module.id === moduleId
        ? { ...module, active: !module.active }
        : module
    )
    const nextCustomModules = customModules.map(module =>
      module.id === moduleId
        ? { ...module, active: !module.active }
        : module
    )

    setBaseModules(nextBaseModules)
    setCustomModules(nextCustomModules)

    try {
      await saveModulePreferences(nextBaseModules, nextCustomModules)
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Impossible d'enregistrer les modules")
      })
      await loadAdminData(getUserRole(), getUserEmail())
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
      setSettingsMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Impossible d'enregistrer les modules")
      })
      await loadAdminData(getUserRole(), getUserEmail())
    }
  }

  // ===== FONCTIONS DE GESTION DES COMPTES (MODIFI?ES) =====
  // Activation/D?sactivation d'un compte individuel
  const toggleAccountStatus = async (accountId) => {
    try {
      await userService.toggleUserStatus(accountId)
      await loadAdminData(getUserRole(), getUserEmail())
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Impossible de modifier le statut du compte")
      })
    }
  }

  // Activation/D?sactivation de tous les comptes
  const toggleAllAccounts = async (activate) => {
    const accountsToUpdate = accounts.filter(account => account.active !== activate)

    if (!accountsToUpdate.length) {
      return
    }

    try {
      await Promise.all(accountsToUpdate.map(account => userService.toggleUserStatus(account.id)))
      await loadAdminData(getUserRole(), getUserEmail())
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Impossible de mettre \u00E0 jour les comptes")
      })
    }
  }

  // ===== FONCTIONS DE NAVIGATION =====
  const handleNavigation = (path) => navigate(path)
  
  const handleLogout = () => {
    authService.logout()
    navigate("/login")
  }

  const handleSettingsClick = () => {
    setCurrentPage('settings')
    setSettingsMessage({ type: "", text: "" })
    setSettingsErrors({})
  }

  const handleModulesClick = () => {
    setCurrentPage('modules')
    setModuleSearchTerm("")
  }

  const handleAccountsClick = () => {
    setCurrentPage('accounts')
    setAccountSearchTerm("")
  }

  const handleBackToAccueil = () => {
    setCurrentPage('accueil')
    setSettingsMessage({ type: "", text: "" })
    setSettingsErrors({})
    setUpdating(false)
    setModuleSearchTerm("")
  }

  // ===== FONCTIONS DE GESTION DES PARAM?TRES =====
  const handleSettingsChange = (e) => {
    const { name, value } = e.target
    setUserSettings(prev => ({ ...prev, [name]: value }))

    setSettingsErrors(prev => {
      if (!prev[name] && !['currentPassword', 'newPassword', 'confirmPassword'].includes(name)) {
        return prev
      }

      const next = { ...prev }
      delete next[name]

      if (['currentPassword', 'newPassword', 'confirmPassword'].includes(name)) {
        delete next.currentPassword
        delete next.newPassword
        delete next.confirmPassword
      }

      return next
    })

    if (settingsMessage.type === "error") {
      setSettingsMessage({ type: "", text: "" })
    }
  }

  const handleSaveSettings = async () => {
    const nextErrors = {}
    const trimmedFirstName = userSettings.firstName.trim()
    const trimmedLastName = userSettings.lastName.trim()
    const trimmedEmail = userSettings.email.trim()

    if (!trimmedFirstName) {
      nextErrors.firstName = "Le pr\u00E9nom est requis"
    }

    if (!trimmedLastName) {
      nextErrors.lastName = "Le nom est requis"
    }

    if (!trimmedEmail) {
      nextErrors.email = "L'email est requis"
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
      nextErrors.email = "Format d'email invalide"
    }

    const changingPassword = userSettings.newPassword || userSettings.confirmPassword || userSettings.currentPassword

    if (changingPassword) {
      if (!userSettings.currentPassword) {
        nextErrors.currentPassword = "Veuillez entrer votre mot de passe actuel"
      }

      if (!userSettings.newPassword) {
        nextErrors.newPassword = "Veuillez entrer un nouveau mot de passe"
      } else if (userSettings.newPassword.length < 6) {
        nextErrors.newPassword = "Le nouveau mot de passe doit contenir au moins 6 caract\u00E8res"
      }

      if (!userSettings.confirmPassword) {
        nextErrors.confirmPassword = "Veuillez confirmer le nouveau mot de passe"
      } else if (userSettings.newPassword !== userSettings.confirmPassword) {
        nextErrors.confirmPassword = "Les nouveaux mots de passe ne correspondent pas"
      }
    }

    setSettingsErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      setSettingsMessage({ type: "error", text: "Veuillez corriger les champs indiqu\u00E9s." })
      return
    }

    setUpdating(true)
    setSettingsMessage({ type: "info", text: "Mise \u00E0 jour en cours..." })
    setSettingsErrors({})

    try {
      await userService.updateProfile({
        firstName: trimmedFirstName,
        lastName: trimmedLastName,
        email: trimmedEmail,
        phone: userSettings.phone,
        department: userSettings.department
      })

      if (userSettings.newPassword) {
        await userService.changePassword(userSettings.currentPassword, userSettings.newPassword)
      }

      await loadAdminData(getUserRole(), userSettings.email)
      setSettingsErrors({})
      setSettingsMessage({ type: "success", text: "Profil mis \u00E0 jour avec succ\u00E8s !" })
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Impossible de mettre \u00E0 jour le profil")
      })
    } finally {
      setUpdating(false)
    }
  }

  // ===== FONCTION DE CR?ATION DE COMPTE =====
  const handleAccountCreated = async (newUser) => {
    try {
      await userService.createUser(newUser)
      await loadAdminData(getUserRole(), getUserEmail())
      handleBackToAccueil()
    } catch (error) {
      throw new Error(extractApiErrorMessage(error, "Impossible de cr\u00E9er le compte"))
    }
  }

  // ===== EFFET D'INITIALISATION =====
  useEffect(() => {
    const role = getUserRole()
    const email = getUserEmail()

    if (!isAuthenticated() || role !== "admin_principal") {
      navigate("/login")
      return
    }

    let active = true

    ;(async () => {
      try {
        await loadAdminData(role, email)
      } catch (error) {
        if (!active) return
        setAccounts([])
        setSettingsMessage({
          type: "error",
          text: extractApiErrorMessage(error, "Impossible de charger l'administration")
        })
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [navigate])

  // ===== RENDU =====
  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={{...styles.sidebar, width: sidebarCollapsed ? '80px' : '280px'}}>
        <div style={styles.sidebarHeader}>
          {!sidebarCollapsed && (
            <div style={styles.logoContainer} onClick={() => setCurrentPage('accueil')}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="#667eea"/>
                <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
              <div>
                <h1 style={styles.logoTitle}>ERP</h1>
                <p style={styles.logoSubtitle}>Administration</p>
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div style={styles.logoCollapsed} onClick={() => setCurrentPage('accueil')}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <rect width="40" height="40" rx="10" fill="#667eea"/>
                <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              </svg>
            </div>
          )}
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
          
          <button
            onClick={() => setCurrentPage('accueil')}
            style={{
              ...styles.navButton,
              background: currentPage === 'accueil' ? '#667eea' : 'transparent',
              color: currentPage === 'accueil' ? 'white' : '#4a5568',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '12px' : '12px 20px',
              marginBottom: '8px'
            }}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83C\uDFE0"}</span>
            {!sidebarCollapsed && "Page d'accueil"}
          </button>
          
          <button
            onClick={handleModulesClick}
            style={{
              ...styles.navButton,
              background: currentPage === 'modules' ? '#805ad5' : '#9f7aea',
              color: 'white',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '12px' : '12px 20px',
              marginBottom: '10px'
            }}
            onMouseEnter={(e) => currentPage !== 'modules' && (e.target.style.background = '#805ad5')}
            onMouseLeave={(e) => currentPage !== 'modules' && (e.target.style.background = '#9f7aea')}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83D\uDCCA"}</span>
            {!sidebarCollapsed && (
              <>
                <span style={{ flex: 1, textAlign: 'left' }}>Gestion des modules</span>
                <span style={styles.filterBadge}>
                  {activeModulesCount}/{allModules.length}
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleAccountsClick}
            style={{
              ...styles.navButton,
              background: currentPage === 'accounts' ? '#2b6cb0' : '#4299e1',
              color: 'white',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '12px' : '12px 20px',
              marginBottom: '10px'
            }}
            onMouseEnter={(e) => currentPage !== 'accounts' && (e.currentTarget.style.background = '#2b6cb0')}
            onMouseLeave={(e) => currentPage !== 'accounts' && (e.currentTarget.style.background = '#4299e1')}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83D\uDC65"}</span>
            {!sidebarCollapsed && (
              <>
                <span style={{ flex: 1, textAlign: 'left' }}>Consulter les comptes</span>
                <span style={styles.filterBadge}>
                  {accountStats.actifs}/{accountStats.total}
                </span>
              </>
            )}
          </button>

          <button
            onClick={() => setCurrentPage('createAccount')}
            style={{
              ...styles.navButton,
              background: currentPage === 'createAccount' ? '#38a169' : '#48bb78',
              color: 'white',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '12px' : '12px 20px',
              marginBottom: '10px'
            }}
            onMouseEnter={(e) => currentPage !== 'createAccount' && (e.currentTarget.style.background = '#38a169')}
            onMouseLeave={(e) => currentPage !== 'createAccount' && (e.currentTarget.style.background = '#48bb78')}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\u2795"}</span>
            {!sidebarCollapsed && "Cr\u00E9er un compte"}
          </button>

          <button
            onClick={handleSettingsClick}
            style={{
              ...styles.navButton,
              background: currentPage === 'settings' ? '#2d3748' : '#4a5568',
              color: 'white',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '12px' : '12px 20px'
            }}
            onMouseEnter={(e) => currentPage !== 'settings' && (e.currentTarget.style.background = '#2d3748')}
            onMouseLeave={(e) => currentPage !== 'settings' && (e.currentTarget.style.background = '#4a5568')}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\u2699\uFE0F"}</span>
            {!sidebarCollapsed && "Param\u00E8tres"}
          </button>
        </div>

        <div style={styles.logoutSection}>
          <button
            onClick={handleLogout}
            style={{
              ...styles.logoutButton,
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              padding: sidebarCollapsed ? '12px' : '12px 20px'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#c53030'}
            onMouseLeave={(e) => e.currentTarget.style.background = '#f56565'}
          >
            <span style={{ fontSize: "1.2rem" }}>{"\uD83D\uDEAA"}</span>
            {!sidebarCollapsed && "D\u00E9connexion"}
          </button>
        </div>
      </div>

      <div style={{...styles.mainContent, marginLeft: sidebarCollapsed ? '80px' : '280px'}}>
        {currentPage === 'accueil' && (
          <>
            <div style={styles.mainHeader}>
              <div>
                <h1 style={styles.welcomeTitle}>
                  Bonjour, <span style={{ color: '#667eea' }}>{userSettings.firstName || userName}</span> {"\uD83D\uDC4B"}
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
                      onClick={() => handleNavigation(page.path)}
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
                  <div style={{...styles.moduleIcon, backgroundColor: module.color}}>
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
                  <div style={{...styles.moduleIcon, backgroundColor: module.color}}>
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
        )}

        {currentPage === 'modules' && (
          <div style={styles.pageContainer}>
            <h1 style={styles.pageTitle}>Gestion des modules</h1>
            
            <div style={styles.modulesStatsContainer}>
              <div style={styles.statCard}>
                <span style={styles.statCardValue}>{moduleStats.total}</span>
                <span style={styles.statCardLabel}>Total</span>
              </div>
              <div style={{...styles.statCard, background: '#48bb78'}}>
                <span style={styles.statCardValue}>{moduleStats.actifs}</span>
                <span style={styles.statCardLabel}>Actifs</span>
              </div>
              <div style={{...styles.statCard, background: '#f56565'}}>
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
        )}

        {/* ===== PAGE CONSULTER LES COMPTES (MODIFI?E AVEC ACTIVATION/D?SACTIVATION) ===== */}
        {currentPage === 'accounts' && (
          <div style={styles.pageContainer}>
            <h1 style={styles.pageTitle}>Consulter les comptes</h1>

            {/* Stats comptes */}
            <div style={styles.modulesStatsContainer}>
              <div style={styles.statCard}>
                <span style={styles.statCardValue}>{accountStats.total}</span>
                <span style={styles.statCardLabel}>Total</span>
              </div>
              <div style={{...styles.statCard, background: '#48bb78'}}>
                <span style={styles.statCardValue}>{accountStats.actifs}</span>
                <span style={styles.statCardLabel}>Actifs</span>
              </div>
              <div style={{...styles.statCard, background: '#f56565'}}>
                <span style={styles.statCardValue}>{accountStats.inactifs}</span>
                <span style={styles.statCardLabel}>Inactifs</span>
              </div>
            </div>

            {/* Barre de recherche et actions group?es */}
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
                  style={{...styles.modulesBulkButton, backgroundColor: '#48bb78', color: 'white'}}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#38a169'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#48bb78'}
                >
                  {"\u2705 Tout activer"}
                </button>
                <button 
                  onClick={() => toggleAllAccounts(false)} 
                  style={{...styles.modulesBulkButton, backgroundColor: '#f56565', color: 'white'}}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c53030'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f56565'}
                >
                  {"\u274C Tout d\u00E9sactiver"}
                </button>
              </div>
            </div>

            {/* Tableau des comptes avec boutons Activer/D?sactiver */}
            <div style={styles.modulesTableWrapper}>
              <table style={styles.modulesTable}>
                <thead>
                  <tr>
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
                      <td colSpan="8" style={styles.modulesNoResults}>
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
        )}

        {currentPage === 'createAccount' && (
          <div style={styles.pageContainer}>
            <h1 style={styles.pageTitle}>{"Cr\u00E9ation de compte"}</h1>
            <CreateAccount 
              onClose={handleBackToAccueil}
              onAccountCreated={handleAccountCreated}
              standalone={true}
              onCancel={handleBackToAccueil}
            />
          </div>
        )}

        {currentPage === 'settings' && (
          <div style={styles.pageContainer}>
            <h1 style={styles.pageTitle}>{"Param\u00E8tres du profil"}</h1>
            <AccountSettings
              userSettings={userSettings}
              handleSettingsChange={handleSettingsChange}
              handleSaveSettings={handleSaveSettings}
              settingsMessage={settingsMessage}
              fieldErrors={settingsErrors}
              updating={updating}
              onClose={handleBackToAccueil}
              standalone={true}
              onCancel={handleBackToAccueil}
            />
          </div>
        )}
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
  },
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
  },
  loadingContainer: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #667eea, #764ba2)"
  },
  spinner: {
    width: "60px",
    height: "60px",
    border: "4px solid rgba(255,255,255,0.2)",
    borderRadius: "50%",
    borderTopColor: "white",
    animation: "spin 0.8s linear infinite"
  },
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
  },
  accountFilterSelect: {
    padding: "10px 14px",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "0.9rem",
    color: "#4a5568",
    background: "white",
    cursor: "pointer",
    outline: "none"
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    backdropFilter: "blur(5px)"
  },
  modalContent: {
    background: "white",
    borderRadius: "16px",
    padding: "32px",
    width: "400px",
    maxWidth: "90%",
    maxHeight: "90vh",
    overflowY: "auto",
    boxShadow: "0 20px 40px rgba(0,0,0,0.2)"
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "24px"
  },
  modalTitle: {
    fontSize: "1.5rem",
    color: "#1a202c",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    margin: 0
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "1.5rem",
    cursor: "pointer",
    color: "#a0aec0"
  },
  messageBox: {
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "20px",
    border: "1px solid"
  },
  settingsForm: {
    display: "flex",
    flexDirection: "column",
    gap: "24px"
  },
  formSection: {
    borderBottom: "1px solid #e2e8f0",
    paddingBottom: "20px"
  },
  sectionSubtitle: {
    fontSize: "1.1rem",
    color: "#2d3748",
    margin: "0 0 12px 0"
  },
  sectionHint: {
    fontSize: "0.85rem",
    color: "#a0aec0",
    margin: "-8px 0 16px 0"
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
    marginBottom: "12px"
  },
  formGroup: {
    marginBottom: "12px",
    flex: 1
  },
  label: {
    display: "block",
    marginBottom: "6px",
    fontWeight: 600,
    color: "#4a5568",
    fontSize: "0.9rem"
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "0.95rem",
    outline: "none",
    transition: "border-color 0.3s",
    boxSizing: "border-box"
  },
  inputHelp: {
    display: "block",
    fontSize: "0.75rem",
    color: "#a0aec0",
    marginTop: "4px"
  },
  modalActions: {
    display: "flex",
    gap: "12px",
    justifyContent: "flex-end",
    marginTop: "24px",
    borderTop: "1px solid #e2e8f0",
    paddingTop: "20px"
  },
  cancelButton: {
    padding: "10px 20px",
    background: "white",
    color: "#4a5568",
    border: "2px solid #e2e8f0",
    borderRadius: "8px",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    transition: "all 0.3s"
  },
  saveButton: {
    padding: "10px 20px",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "0.95rem",
    fontWeight: 600,
    transition: "all 0.3s"
  }
}

const styleSheet = document.createElement("style")
styleSheet.textContent = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .modulesTableRow:hover {
    background-color: #f7fafc;
  }
`
document.head.appendChild(styleSheet)

export default Admin
