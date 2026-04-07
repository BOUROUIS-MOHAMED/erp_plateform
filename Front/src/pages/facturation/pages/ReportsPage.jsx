// src/pages/facturation/pages/ReportsPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { reportService } from '../../../services/reportService'
import { getUserRole } from '../../../utils/auth'
import {
  extractApiErrorMessage,
  mapReportToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

// ===== CONSTANTS =====
const REPORT_TYPES = ['financier','clients','commandes','analytique']

const utils = {
  formatCurrency: a => (a||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}),
  formatDate: d => d ? new Date(d).toLocaleDateString('fr-FR') : '',
  formatPercentage: p => `${((p||0)*100).toFixed(1)}%`,
}

const getReportIcon = (type='analytique') => ({
  financier:'💰', clients:'👥', commandes:'📦', analytique:'📊'
}[type] || '📈')

const useNotification = () => {
  const [n,setN] = useState({show:false,message:'',type:''})
  const show = useCallback((m,t)=>{setN({show:true,message:m,type:t});setTimeout(()=>setN({show:false,message:'',type:''}),3000)},[])
  return {notification:n, showNotification:show}
}

export default function ReportsPage() {
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState({ type: null, data: null })
  const [rForm, setRForm] = useState({ title:'', description:'', type:'financier' })
  const [reportModal, setReportModal] = useState({ show: false, report: null })
  const { notification, showNotification } = useNotification()

  const loadData = useCallback(async () => {
    try {
      const res = await reportService.getAll({ limit: 200 })
      const role = getUserRole()
      const items = pickList(res, ['data']).filter(r => {
        if (role === 'admin_principal') return true
        const tags = r.tags || []
        return tags.length === 0 || tags.includes('source:facturation')
      })
      setReports(items.map(r => mapReportToUi(r, getReportIcon(r.type))))
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de charger les rapports'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  useEffect(() => { loadData() }, [loadData])

  const filteredReports = useMemo(() =>
    reports
      .filter(r => !search || r.title.toLowerCase().includes(search.toLowerCase()))
      .sort((a,b) => new Date(b.date) - new Date(a.date)),
    [reports, search])

  const openModal = (item = null) => {
    if (item) {
      setEdit({ type: 'report', data: item })
      setRForm({ title: item.title, description: item.description, type: item.type })
    }
    setModal(true)
  }

  const closeModal = () => {
    setModal(false)
    setEdit({ type: null, data: null })
    setRForm({ title:'', description:'', type:'financier' })
  }

  const handleAdd = async () => {
    if (!rForm.title.trim() || !rForm.description.trim()) return
    try {
      await reportService.create({
        title: rForm.title,
        description: rForm.description,
        type: rForm.type,
        tags: ['source:facturation'],
      })
      await loadData()
      closeModal()
      showNotification('Rapport ajouté', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, "Impossible d'ajouter le rapport"), 'error')
    }
  }

  const handleUpdate = async () => {
    if (!rForm.title.trim() || !rForm.description.trim() || !edit.data?.id) return
    try {
      await reportService.update(edit.data.id, {
        title: rForm.title,
        description: rForm.description,
        type: rForm.type,
      })
      await loadData()
      closeModal()
      showNotification('Rapport modifié', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de modifier le rapport'), 'error')
    }
  }

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Supprimer le rapport "${title}" ?`)) return
    try {
      await reportService.delete(id)
      await loadData()
      showNotification('Rapport supprimé', 'warning')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de supprimer le rapport'), 'error')
    }
  }

  const handleDownload = async (report) => {
    try {
      await reportService.generatePdf(report.id || report.backend?._id)
      showNotification('Rapport téléchargé', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de télécharger le rapport'), 'error')
    }
  }

  if (loading) return <div style={{padding:'2rem',textAlign:'center'}}>Chargement...</div>

  return (
    <div className="reports-content">
      {notification.show && <div className={`notification ${notification.type}`}>{notification.message}</div>}

      <div className="content-header">
        <div className="header-left">
          <h2>📑 Rapports</h2>
          <span className="header-count">{filteredReports.length}</span>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>+ Nouveau rapport</button>
      </div>

      <div className="search-section">
        <div className="search-box large">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par titre..."
            className="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="reports-grid">
        {filteredReports.map(r => (
          <div key={r.id} className="report-card detailed">
            <div className="report-card-header">
              <div className="report-icon-large">{getReportIcon(r.type)}</div>
              <div className="report-info">
                <h3>{r.title}</h3>
                <p className="report-meta">
                  <span className="report-type">{r.type}</span>
                  <span className="report-date">📅 {utils.formatDate(r.date)}</span>
                  <span className="report-author">👤 {r.author}</span>
                </p>
              </div>
            </div>
            <div className="report-card-body">
              <p className="report-description">{r.description}</p>
              {r.stats && (
                <div className="report-stats-preview">
                  <div className="stat-item">
                    <span className="stat-label">CA Total:</span>
                    <span className="stat-value-small">{utils.formatCurrency(r.stats.totalRevenue)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Taux recouvrement:</span>
                    <span className="stat-value-small">{utils.formatPercentage(r.stats.paidRatio)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Meilleur client:</span>
                    <span className="stat-value-small">{r.stats.topClient?.name}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Paiements retard:</span>
                    <span className="stat-value-small">{r.stats.latePayments}</span>
                  </div>
                </div>
              )}
            </div>
            <div className="report-card-footer">
              <button className="btn-outline" onClick={()=>setReportModal({show:true,report:r})}>👁️ Voir détails</button>
              <button className="btn-outline" onClick={()=>handleDownload(r)}>📥 Télécharger</button>
              <button className="btn-icon" onClick={()=>openModal(r)}>✏️</button>
              <button className="btn-icon" onClick={()=>handleDelete(r.id,r.title)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Report view modal */}
      {reportModal.show && reportModal.report && (
        <div className="modal-overlay" onClick={()=>setReportModal({show:false,report:null})}>
          <div className="modal-content modal-large" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{reportModal.report.icon||'📈'} {reportModal.report.title}</h3>
              <button className="modal-close" onClick={()=>setReportModal({show:false,report:null})}>×</button>
            </div>
            <div className="modal-body">
              <div className="report-view-header">
                <div className="report-meta-info">
                  <span>📅 {utils.formatDate(reportModal.report.date)}</span>
                  <span>📊 Type: {reportModal.report.type}</span>
                  <span>👤 Auteur: {reportModal.report.author}</span>
                </div>
              </div>
              <div className="report-description-full">
                <p>{reportModal.report.description}</p>
              </div>
              {reportModal.report.stats && (
                <div className="report-stats-detailed">
                  <h4>Indicateurs clés</h4>
                  <div className="stats-detailed-grid">
                    <div className="stat-detailed-card"><div className="stat-detailed-label">Chiffre d'affaires total</div><div className="stat-detailed-value">{utils.formatCurrency(reportModal.report.stats.totalRevenue)}</div></div>
                    <div className="stat-detailed-card"><div className="stat-detailed-label">Nombre de factures</div><div className="stat-detailed-value">{reportModal.report.stats.totalInvoices}</div></div>
                    <div className="stat-detailed-card"><div className="stat-detailed-label">Taux de recouvrement</div><div className="stat-detailed-value">{utils.formatPercentage(reportModal.report.stats.paidRatio)}</div></div>
                    <div className="stat-detailed-card"><div className="stat-detailed-label">Meilleur client</div><div className="stat-detailed-value">{reportModal.report.stats.topClient?.name}</div><div className="stat-detailed-sub">{utils.formatCurrency(reportModal.report.stats.topClient?.amount)}</div></div>
                    <div className="stat-detailed-card"><div className="stat-detailed-label">Panier moyen</div><div className="stat-detailed-value">{utils.formatCurrency(reportModal.report.stats.avgOrderValue)}</div></div>
                    <div className="stat-detailed-card"><div className="stat-detailed-label">Paiements en retard</div><div className="stat-detailed-value">{reportModal.report.stats.latePayments}</div></div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setReportModal({show:false,report:null})}>Fermer</button>
              <button className="btn-primary" onClick={()=>handleDownload(reportModal.report)}>📥 Télécharger PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{edit.type==='report' ? '✏️ Modifier' : '➕ Nouveau'} rapport</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Titre *</label>
                <input type="text" value={rForm.title} onChange={e=>setRForm({...rForm,title:e.target.value})} placeholder="Ex: Rapport financier mensuel"/>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea value={rForm.description} onChange={e=>setRForm({...rForm,description:e.target.value})} placeholder="Description détaillée..." rows="4"/>
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={rForm.type} onChange={e=>setRForm({...rForm,type:e.target.value})}>
                  {REPORT_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-primary" onClick={edit.type==='report' ? handleUpdate : handleAdd} disabled={!rForm.title.trim()||!rForm.description.trim()}>
                {edit.type==='report' ? 'Modifier' : 'Créer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
