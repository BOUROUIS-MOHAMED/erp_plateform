// src/pages/facturation/pages/SettingsPage.jsx
import { useEffect, useState, useCallback } from 'react'
import userService from '../../../services/userService'
import { getUserEmail, getUserRole } from '../../../utils/auth'
import { extractApiErrorMessage } from '../../../utils/frontendApiAdapters'

export default function SettingsPage() {
  const [userSettings, setUserSettings] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    department: '', role: '', currentPassword: '', newPassword: '', confirmPassword: '',
  })
  const [message, setMessage] = useState({ type: '', text: '' })
  const [updating, setUpdating] = useState(false)

  useEffect(() => {
    let active = true
    const fallbackRole = getUserRole() || 'admin_facture'
    const fallbackEmail = getUserEmail() || ''

    userService.getProfile().then(res => {
      if (!active) return
      const p = res?.data || res
      setUserSettings(u => ({
        ...u,
        firstName:  p?.firstName  || (fallbackRole==='admin_principal' ? 'Admin' : 'Gestionnaire'),
        lastName:   p?.lastName   || (fallbackRole==='admin_principal' ? 'Principal' : 'Facturation'),
        email:      p?.email      || fallbackEmail,
        phone:      p?.phone      || '',
        department: p?.department || 'Comptabilité',
        role:       p?.role       || fallbackRole,
      }))
    }).catch(() => {
      if (!active) return
      setUserSettings(u => ({ ...u, email: fallbackEmail, role: fallbackRole }))
    })
    return () => { active = false }
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setUserSettings(u => ({ ...u, [name]: value }))
  }

  const handleSave = async () => {
    if (!userSettings.firstName || !userSettings.lastName || !userSettings.email) {
      setMessage({ type: 'error', text: 'Prénom, nom et email sont requis' })
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userSettings.email)) {
      setMessage({ type: 'error', text: "Format d'email invalide" })
      return
    }
    if (userSettings.phone && !/^[0-9+\-\s]+$/.test(userSettings.phone)) {
      setMessage({ type: 'error', text: 'Format de téléphone invalide' })
      return
    }
    if (userSettings.newPassword || userSettings.confirmPassword || userSettings.currentPassword) {
      if (!userSettings.currentPassword) {
        setMessage({ type: 'error', text: 'Mot de passe actuel requis' })
        return
      }
      if (userSettings.newPassword !== userSettings.confirmPassword) {
        setMessage({ type: 'error', text: 'Les nouveaux mots de passe ne correspondent pas' })
        return
      }
      if (userSettings.newPassword.length < 6) {
        setMessage({ type: 'error', text: 'Le nouveau mot de passe doit contenir au moins 6 caractères' })
        return
      }
    }

    setUpdating(true)
    setMessage({ type: 'info', text: 'Mise à jour en cours...' })

    try {
      await userService.updateProfile({
        firstName: userSettings.firstName,
        lastName:  userSettings.lastName,
        email:     userSettings.email,
        phone:     userSettings.phone,
        department: userSettings.department,
      })
      if (userSettings.newPassword) {
        await userService.changePassword(userSettings.currentPassword, userSettings.newPassword)
      }
      setMessage({ type: 'success', text: 'Profil mis à jour avec succès !' })
      setUserSettings(u => ({ ...u, currentPassword:'', newPassword:'', confirmPassword:'' }))
    } catch (err) {
      setMessage({ type: 'error', text: extractApiErrorMessage(err, 'Impossible de mettre à jour le profil') })
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="settings-tab">
      <h2>⚙️ Paramètres du profil</h2>

      {message.text && <div className={`settings-message ${message.type}`}>{message.text}</div>}

      <div className="settings-form">
        <div className="settings-section">
          <h3>Informations personnelles</h3>
          <div className="settings-row">
            <div className="settings-group">
              <label>Prénom</label>
              <input type="text" name="firstName" value={userSettings.firstName} onChange={handleChange} placeholder="Votre prénom"/>
            </div>
            <div className="settings-group">
              <label>Nom</label>
              <input type="text" name="lastName" value={userSettings.lastName} onChange={handleChange} placeholder="Votre nom"/>
            </div>
          </div>
          <div className="settings-row">
            <div className="settings-group">
              <label>Email</label>
              <input type="email" name="email" value={userSettings.email} onChange={handleChange} placeholder="votre@email.com"/>
            </div>
            <div className="settings-group">
              <label>Téléphone</label>
              <input type="tel" name="phone" value={userSettings.phone} onChange={handleChange} placeholder=""/>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Informations professionnelles</h3>
          <div className="settings-row">
            <div className="settings-group">
              <label>Département</label>
              <input type="text" name="department" value={userSettings.department} onChange={handleChange} placeholder="Votre département"/>
            </div>
            <div className="settings-group">
              <label>Rôle</label>
              <input type="text" value={userSettings.role} disabled style={{backgroundColor:'#f7fafc',cursor:'not-allowed'}}/>
              <small>Le rôle ne peut pas être modifié</small>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <h3>Changer le mot de passe</h3>
          <p className="settings-hint">Laissez vide si vous ne souhaitez pas changer votre mot de passe</p>
          <div className="settings-group">
            <label>Mot de passe actuel</label>
            <input type="password" name="currentPassword" value={userSettings.currentPassword} onChange={handleChange} placeholder=""/>
          </div>
          <div className="settings-row">
            <div className="settings-group">
              <label>Nouveau mot de passe</label>
              <input type="password" name="newPassword" value={userSettings.newPassword} onChange={handleChange} placeholder=""/>
            </div>
            <div className="settings-group">
              <label>Confirmer</label>
              <input type="password" name="confirmPassword" value={userSettings.confirmPassword} onChange={handleChange} placeholder=""/>
            </div>
          </div>
          <small>Minimum 6 caractères</small>
        </div>

        <div className="settings-actions">
          <button
            className="btn-primary"
            onClick={handleSave}
            disabled={updating}
            style={{width:'100%',background:'#667eea'}}
          >
            {updating ? 'Mise à jour en cours...' : 'Enregistrer les modifications'}
          </button>
        </div>
      </div>
    </div>
  )
}
