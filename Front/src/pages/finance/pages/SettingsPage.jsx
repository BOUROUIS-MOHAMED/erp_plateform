import { useState, useEffect } from 'react'
import userService from '../../../services/userService'
import { extractApiErrorMessage } from '../../../utils/frontendApiAdapters'

const INITIAL_SETTINGS = {
  firstName: '', lastName: '', email: '', phone: '', department: '', role: '',
  currentPassword: '', newPassword: '', confirmPassword: ''
}

function SettingsPage({ showNotif }) {
  const [userSettings, setUserSettings] = useState({ ...INITIAL_SETTINGS })
  const [settingsMessage, setSettingsMessage] = useState({ type: '', text: '' })
  const [updating, setUpdating] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadProfile = async () => {
    try {
      const profileResponse = await userService.getProfile()
      const profile = profileResponse?.data || profileResponse
      setUserSettings(prev => ({
        ...prev,
        firstName: profile?.firstName || 'Gestionnaire',
        lastName: profile?.lastName || 'Finance',
        email: profile?.email || '',
        phone: profile?.phone || '',
        department: profile?.department || 'Finance',
        role: profile?.role || 'admin_finance',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }))
    } catch (error) {
      setSettingsMessage({ type: 'error', text: extractApiErrorMessage(error, 'Impossible de charger le profil') })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadProfile() }, [])

  const handleSettingsChange = (e) => setUserSettings({ ...userSettings, [e.target.name]: e.target.value })

  const handleSaveSettings = async () => {
    if (!userSettings.firstName || !userSettings.lastName || !userSettings.email) {
      setSettingsMessage({ type: 'error', text: 'Champs obligatoires manquants' }); return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userSettings.email)) {
      setSettingsMessage({ type: 'error', text: "Format d'email invalide" }); return
    }
    const changingPassword = userSettings.newPassword || userSettings.confirmPassword || userSettings.currentPassword
    if (changingPassword) {
      if (!userSettings.currentPassword) { setSettingsMessage({ type: 'error', text: 'Veuillez entrer votre mot de passe actuel' }); return }
      if (userSettings.newPassword !== userSettings.confirmPassword) { setSettingsMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas' }); return }
      if (userSettings.newPassword.length < 6) { setSettingsMessage({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 6 caractères' }); return }
    }
    setUpdating(true)
    setSettingsMessage({ type: 'info', text: 'Mise à jour en cours...' })
    try {
      await userService.updateProfile({
        firstName: userSettings.firstName,
        lastName: userSettings.lastName,
        email: userSettings.email,
        phone: userSettings.phone,
        department: userSettings.department
      })
      if (changingPassword) await userService.changePassword(userSettings.currentPassword, userSettings.newPassword)
      await loadProfile()
      setSettingsMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
      setTimeout(() => setSettingsMessage({ type: '', text: '' }), 2000)
    } catch (error) {
      setSettingsMessage({ type: 'error', text: extractApiErrorMessage(error, 'Impossible de mettre a jour le profil') })
    } finally {
      setUpdating(false)
    }
  }

  if (loading) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>

  return (
    <div className="settings-tab">
      <h2>⚙️ Paramètres du profil</h2>
      {settingsMessage.text && <div className={`settings-message ${settingsMessage.type}`}>{settingsMessage.text}</div>}
      <div className="settings-form">
        <div className="settings-section">
          <h3>Informations personnelles</h3>
          <div className="settings-row">
            <div className="settings-group"><label>Prénom</label><input type="text" name="firstName" value={userSettings.firstName} onChange={handleSettingsChange} /></div>
            <div className="settings-group"><label>Nom</label><input type="text" name="lastName" value={userSettings.lastName} onChange={handleSettingsChange} /></div>
          </div>
          <div className="settings-row">
            <div className="settings-group"><label>Email</label><input type="email" name="email" value={userSettings.email} onChange={handleSettingsChange} /></div>
            <div className="settings-group"><label>Téléphone</label><input type="tel" name="phone" value={userSettings.phone} onChange={handleSettingsChange} /></div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Informations professionnelles</h3>
          <div className="settings-row">
            <div className="settings-group"><label>Département</label><input type="text" name="department" value={userSettings.department} onChange={handleSettingsChange} /></div>
            <div className="settings-group"><label>Rôle</label><input type="text" value={userSettings.role} disabled style={{ backgroundColor: '#f7fafc', cursor: 'not-allowed' }} /><small>Le rôle ne peut pas être modifié</small></div>
          </div>
        </div>
        <div className="settings-section">
          <h3>Changer le mot de passe</h3>
          <p className="settings-hint">Laissez vide si vous ne souhaitez pas changer votre mot de passe</p>
          <div className="settings-group"><label>Mot de passe actuel</label><input type="password" name="currentPassword" value={userSettings.currentPassword} onChange={handleSettingsChange} /></div>
          <div className="settings-row">
            <div className="settings-group"><label>Nouveau mot de passe</label><input type="password" name="newPassword" value={userSettings.newPassword} onChange={handleSettingsChange} /></div>
            <div className="settings-group"><label>Confirmer</label><input type="password" name="confirmPassword" value={userSettings.confirmPassword} onChange={handleSettingsChange} /></div>
          </div>
          <small>Minimum 6 caractères</small>
        </div>
        <div className="settings-actions">
          <button className="btn-primary" onClick={handleSaveSettings} disabled={updating} style={{ width: '100%', background: '#4299e1' }}>
            {updating ? 'Mise à jour en cours...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPage
