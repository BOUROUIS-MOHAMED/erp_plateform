import { useState, useEffect, useCallback } from 'react'
import userService from '../../../services/userService'
import { extractApiErrorMessage } from '../../../utils/frontendApiAdapters'
import { getUserRole } from '../../../utils/auth'

function SettingsPage() {
  const [ur] = useState(() => getUserRole())
  const [us, setUs] = useState({ firstName: "", lastName: "", email: "", phone: "", department: "", role: "", currentPassword: "", newPassword: "", confirmPassword: "" })
  const [sm, setSm] = useState({ type: "", text: "" })
  const [upd, setUpd] = useState(false)

  // Load profile
  const loadProfile = useCallback(async () => {
    try {
      const profileResponse = await userService.getProfile()
      const profile = profileResponse?.data || profileResponse
      setUs({
        firstName: profile?.firstName || "Gestionnaire",
        lastName: profile?.lastName || "Stock",
        email: profile?.email || "",
        phone: profile?.phone || "",
        department: profile?.department || "Gestion des stocks",
        role: profile?.role || ur || "admin_stock",
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      })
    } catch (error) {
      setSm({ type: "error", text: extractApiErrorMessage(error, "Impossible de charger le profil") })
    }
  }, [ur])

  useEffect(() => { loadProfile() }, [loadProfile])

  // Handlers
  const hdlSetChange = e => {
    const { name, value } = e.target
    setUs(prev => ({ ...prev, [name]: value }))
  }

  const hdlSave = async () => {
    if (!us.firstName) return setSm({ type: "error", text: "Prénom requis" })
    if (!us.lastName) return setSm({ type: "error", text: "Nom requis" })
    if (!us.email) return setSm({ type: "error", text: "Email requis" })
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(us.email)) return setSm({ type: "error", text: "Email invalide" })
    if (us.phone && !/^[0-9+\-\s]+$/.test(us.phone)) return setSm({ type: "error", text: "Téléphone invalide" })

    const cp = us.newPassword || us.confirmPassword || us.currentPassword
    if (cp) {
      if (!us.currentPassword) return setSm({ type: "error", text: "Mot de passe actuel requis" })
      if (us.newPassword !== us.confirmPassword) return setSm({ type: "error", text: "Mots de passe différents" })
      if (us.newPassword.length < 6) return setSm({ type: "error", text: "Minimum 6 caractères" })
    }

    setUpd(true); setSm({ type: "info", text: "Mise à jour..." })
    try {
      await userService.updateProfile({
        firstName: us.firstName,
        lastName: us.lastName,
        email: us.email,
        phone: us.phone,
        department: us.department
      })

      if (cp) {
        await userService.changePassword(us.currentPassword, us.newPassword)
      }

      await loadProfile()
      setSm({ type: "success", text: "Profil mis à jour !" })
      setTimeout(() => setSm({ type: "", text: "" }), 2000)
    } catch (error) {
      setSm({ type: "error", text: extractApiErrorMessage(error, "Impossible de mettre a jour le profil") })
    } finally {
      setUpd(false)
    }
  }

  return (
    <div className="settings-tab">
      <h2>⚙️ Paramètres du profil</h2>
      {sm.text && <div className={`settings-message ${sm.type}`}>{sm.text}</div>}
      <div className="settings-form">
        <div className="settings-section">
          <h3>Informations personnelles</h3>
          <div className="settings-row">
            <div className="settings-group"><label>Prénom</label><input type="text" name="firstName" value={us.firstName} onChange={hdlSetChange} placeholder="Prénom" /></div>
            <div className="settings-group"><label>Nom</label><input type="text" name="lastName" value={us.lastName} onChange={hdlSetChange} placeholder="Nom" /></div>
          </div>
          <div className="settings-row">
            <div className="settings-group"><label>Email</label><input type="email" name="email" value={us.email} onChange={hdlSetChange} placeholder="email" /></div>
            <div className="settings-group"><label>Téléphone</label><input type="tel" name="phone" value={us.phone} onChange={hdlSetChange} placeholder="" /></div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Informations professionnelles</h3>
          <div className="settings-row">
            <div className="settings-group"><label>Département</label><input type="text" name="department" value={us.department} onChange={hdlSetChange} placeholder="Département" /></div>
            <div className="settings-group"><label>Rôle</label><input type="text" value={us.role} disabled style={{ backgroundColor: '#f7fafc', cursor: 'not-allowed' }} /><small>Rôle non modifiable</small></div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Changer le mot de passe</h3>
          <p className="settings-hint">Laissez vide pour ne pas changer</p>
          <div className="settings-group"><label>Mot de passe actuel</label><input type="password" name="currentPassword" value={us.currentPassword} onChange={hdlSetChange} placeholder="" /></div>
          <div className="settings-row">
            <div className="settings-group"><label>Nouveau</label><input type="password" name="newPassword" value={us.newPassword} onChange={hdlSetChange} placeholder="" /></div>
            <div className="settings-group"><label>Confirmer</label><input type="password" name="confirmPassword" value={us.confirmPassword} onChange={hdlSetChange} placeholder="" /></div>
          </div>
          <small>Minimum 6 caractères</small>
        </div>
        <div className="settings-actions"><button className="btn-primary" onClick={hdlSave} disabled={upd}>{upd ? "Mise à jour..." : "Enregistrer"}</button></div>
      </div>
    </div>
  )
}

export default SettingsPage
