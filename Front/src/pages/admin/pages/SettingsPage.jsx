// src/pages/admin/pages/SettingsPage.jsx
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import AccountSettings from "../../../components/forms/AccountSettings"
import userService from "../../../services/userService"
import { getUserRole, getUserEmail } from "../../../utils/auth"
import { extractApiErrorMessage } from "../../../utils/frontendApiAdapters"

function SettingsPage() {
  const navigate = useNavigate()

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
  const [updating, setUpdating] = useState(false)

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
          phone: profile?.phone || "",
          department: profile?.department || "Direction",
          role: profile?.role || getUserRole() || "admin_principal",
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        }))
      } catch {
        // silently ignore
      }
    })()
    return () => { active = false }
  }, [])

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

    if (!trimmedFirstName) nextErrors.firstName = "Le pr\u00E9nom est requis"
    if (!trimmedLastName) nextErrors.lastName = "Le nom est requis"
    if (!trimmedEmail) nextErrors.email = "L'email est requis"

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
      nextErrors.email = "Format d'email invalide"
    }

    const changingPassword = userSettings.newPassword || userSettings.confirmPassword || userSettings.currentPassword

    if (changingPassword) {
      if (!userSettings.currentPassword) nextErrors.currentPassword = "Veuillez entrer votre mot de passe actuel"
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

  const handleBackToAccueil = () => {
    navigate("/admin/accueil")
  }

  return (
    <div style={{
      background: "white",
      borderRadius: "16px",
      padding: "32px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
    }}>
      <h1 style={{
        fontSize: "1.8rem",
        color: "#1a202c",
        margin: "0 0 32px 0",
        textAlign: "center"
      }}>
        {"Param\u00E8tres du profil"}
      </h1>
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
  )
}

export default SettingsPage
