// src/pages/facturation/pages/ClientsPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { clientService } from '../../../services/clientService'
import {
  buildCustomerPayload,
  extractApiErrorMessage,
  mapCustomerToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

// ===== CONSTANTS =====
const C = {
  CLIENT_STATUSES: ['actif','inactif'],
  STATUS: { actif:'#10b981', inactif:'#6b7280' },
  STATUS_BG: { actif:'#d1fae5', inactif:'#f3f4f6' },
}

const utils = {
  formatCurrency: a => (a || 0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}),
  formatDate: d => d ? new Date(d).toLocaleDateString('fr-FR') : '',
}

const StatusBadge = ({status}) => (
  <span className="status-badge" style={{background:C.STATUS_BG[status]||'#f3f4f6',color:C.STATUS[status]||'#6b7280'}}>{status}</span>
)

const useNotification = () => {
  const [n,setN] = useState({show:false,message:'',type:''})
  const show = useCallback((m,t)=>{setN({show:true,message:m,type:t});setTimeout(()=>setN({show:false,message:'',type:''}),3000)},[])
  return {notification:n, showNotification:show}
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState({ type: null, data: null })
  const [cForm, setCForm] = useState({ name:'', email:'', phone:'', address:'', siret:'', status:'actif' })
  const { notification, showNotification } = useNotification()

  const loadData = useCallback(async () => {
    try {
      const res = await clientService.getAll({ limit: 200 })
      setClients(pickList(res, ['data']).map(mapCustomerToUi))
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de charger les clients'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  useEffect(() => { loadData() }, [loadData])

  const filteredClients = useMemo(() =>
    clients.filter(c =>
      !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.siret || '').includes(search)
    ), [clients, search])

  const openModal = (item = null) => {
    if (item) {
      setEdit({ type: 'client', data: item })
      setCForm(item)
    }
    setModal(true)
  }

  const closeModal = () => {
    setModal(false)
    setEdit({ type: null, data: null })
    setCForm({ name:'', email:'', phone:'', address:'', siret:'', status:'actif' })
  }

  const handleAdd = async () => {
    if (!cForm.name.trim()) return
    if (cForm.siret && !/^\d{14}$/.test(cForm.siret)) {
      showNotification('Le SIRET doit contenir exactement 14 chiffres', 'error')
      return
    }
    try {
      await clientService.create(buildCustomerPayload(cForm))
      await loadData()
      closeModal()
      showNotification('Client ajouté', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, "Impossible d'ajouter le client"), 'error')
    }
  }

  const handleUpdate = async () => {
    if (!cForm.name.trim() || !edit.data?.id) return
    if (cForm.siret && !/^\d{14}$/.test(cForm.siret)) {
      showNotification('Le SIRET doit contenir exactement 14 chiffres', 'error')
      return
    }
    try {
      await clientService.update(edit.data.id, buildCustomerPayload(cForm, edit.data))
      await loadData()
      closeModal()
      showNotification('Client modifié', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de modifier le client'), 'error')
    }
  }

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Supprimer le client "${name}" ?`)) return
    try {
      await clientService.delete(id)
      await loadData()
      showNotification('Client supprimé', 'warning')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de supprimer le client'), 'error')
    }
  }

  if (loading) return <div style={{padding:'2rem',textAlign:'center'}}>Chargement...</div>

  return (
    <div className="clients-content">
      {notification.show && <div className={`notification ${notification.type}`}>{notification.message}</div>}

      <div className="content-header">
        <div className="header-left">
          <h2>👥 Clients</h2>
          <span className="header-count">{filteredClients.length}</span>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>+ Nouveau client</button>
      </div>

      <div className="search-section">
        <div className="search-box large">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par nom, email ou SIRET..."
            className="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="clients-grid">
        {filteredClients.map(c => (
          <div key={c.id} className="client-card">
            <div className="client-card-header">
              <div className="client-avatar">{c.name.charAt(0)}</div>
              <div className="client-basic-info">
                <h4>{c.name}</h4>
                <p className="client-siret">{c.siret}</p>
              </div>
              <StatusBadge status={c.status}/>
            </div>
            <div className="client-card-body">
              <div className="client-contact">
                <p><span>📧</span>{c.email}</p>
                <p><span>📞</span>{c.phone}</p>
                <p><span>📍</span>{c.address}</p>
              </div>
              <div className="client-stats">
                <div className="client-stat"><span>Cmd</span><strong>{c.totalOrders}</strong></div>
                <div className="client-stat"><span>Total</span><strong>{utils.formatCurrency(c.totalSpent)}</strong></div>
                <div className="client-stat"><span>Dernière</span><strong>{utils.formatDate(c.lastOrder)}</strong></div>
              </div>
            </div>
            <div className="client-card-footer">
              <button
                className="btn-outline"
                onClick={() => navigate(`/facturation/orders?search=${encodeURIComponent(c.name)}`)}
              >
                Voir commandes
              </button>
              <button className="btn-icon" onClick={() => openModal(c)}>✏️</button>
              <button className="btn-icon" onClick={() => handleDelete(c.id, c.name)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{edit.type === 'client' ? '✏️ Modifier' : '➕ Nouveau'} client</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Nom *</label>
                <input type="text" value={cForm.name} onChange={e=>setCForm({...cForm,name:e.target.value})}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Email</label>
                  <input type="email" value={cForm.email} onChange={e=>setCForm({...cForm,email:e.target.value})}/>
                </div>
                <div className="form-group">
                  <label>Tél</label>
                  <input type="tel" value={cForm.phone} onChange={e=>setCForm({...cForm,phone:e.target.value})}/>
                </div>
              </div>
              <div className="form-group">
                <label>Adresse</label>
                <input type="text" value={cForm.address} onChange={e=>setCForm({...cForm,address:e.target.value})}/>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>SIRET</label>
                  <input type="text" value={cForm.siret} maxLength="14" onChange={e=>setCForm({...cForm,siret:e.target.value})}/>
                  <small style={{display:'block',marginTop:'4px',color:'#6b7280',fontSize:'0.75rem'}}>14 chiffres requis</small>
                </div>
                <div className="form-group">
                  <label>Statut</label>
                  <select value={cForm.status} onChange={e=>setCForm({...cForm,status:e.target.value})}>
                    {C.CLIENT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-primary" onClick={edit.type==='client' ? handleUpdate : handleAdd}>
                {edit.type==='client' ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
