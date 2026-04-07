import { useState, useEffect, useMemo } from 'react'
import { reportService } from '../../../services/reportService'
import { getUserRole } from '../../../utils/auth'
import {
  extractApiErrorMessage,
  mapReportToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' },
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_REPORT = { title: '', description: '', date: today }

const NoResults = ({ onReset }) => (
  <div className="no-results"><p>Aucun résultat</p><button className="btn-reset" onClick={onReset}>Réinitialiser</button></div>
)

const Pagination = ({ total, pagination, setPagination }) => {
  const totalPages = Math.ceil(total / pagination.itemsPerPage)
  const start = total > 0 ? (pagination.currentPage - 1) * pagination.itemsPerPage + 1 : 0
  const end = Math.min(pagination.currentPage * pagination.itemsPerPage, total)
  return (
    <div className="pagination">
      <span className="pagination-info">{total > 0 ? `${start}-${end} sur ${total}` : '0 élément'}</span>
      <div className="pagination-controls">
        <button className="pagination-btn" onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}
          disabled={pagination.currentPage === 1}>←</button>
        {[...Array(totalPages)].map((_, i) => {
          const page = i + 1
          const show = page === 1 || page === totalPages || (page >= pagination.currentPage - 2 && page <= pagination.currentPage + 2)
          if (show) return (
            <button key={page} className={`pagination-btn ${pagination.currentPage === page ? 'active' : ''}`}
              onClick={() => setPagination(p => ({ ...p, currentPage: page }))}>{page}</button>
          )
          if (page === pagination.currentPage - 3 || page === pagination.currentPage + 3)
            return <span key={page} className="pagination-dots">...</span>
          return null
        })}
        <button className="pagination-btn" onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(totalPages, p.currentPage + 1) }))}
          disabled={pagination.currentPage === totalPages || total === 0}>→</button>
      </div>
      <select className="pagination-limit" value={pagination.itemsPerPage}
        onChange={(e) => setPagination({ currentPage: 1, itemsPerPage: Number(e.target.value) })}>
        {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v} par page</option>)}
      </select>
    </div>
  )
}

const ReportViewModal = ({ report, onClose, formatDate, formatDateTime }) => {
  if (!report) return null
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '600px' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👁️ Contenu du rapport</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Titre</label>
            <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2d3748', margin: '4px 0 0' }}>{report.title}</p>
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description</label>
            <p style={{ color: '#4a5568', margin: '4px 0 0', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{report.description || <em style={{ color: '#a0aec0' }}>Aucune description</em>}</p>
          </div>
          <div style={{ display: 'flex', gap: '24px', padding: '12px', background: '#f7fafc', borderRadius: '8px' }}>
            <div>
              <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.75rem', textTransform: 'uppercase' }}>Date du rapport</label>
              <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{formatDate(report.date)}</p>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: '#4a5568', fontSize: '0.75rem', textTransform: 'uppercase' }}>Créé le</label>
              <p style={{ margin: '2px 0 0', fontWeight: 600 }}>{formatDateTime(report.createdAt)}</p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}

const ReportForm = ({ formData, setFormData }) => {
  const fd = formData
  const set = (field, value) => setFormData({ ...fd, [field]: value })
  return (<>
    <div className="form-group"><label>Titre *</label><input type="text" value={fd.title} onChange={e => set('title', e.target.value)} required /></div>
    <div className="form-group"><label>Description</label><textarea value={fd.description} onChange={e => set('description', e.target.value)} rows="4" /></div>
    <div className="form-group"><label>Date *</label><input type="date" value={fd.date} onChange={e => set('date', e.target.value)} required /></div>
  </>)
}

function ReportsPage({ showNotif }) {
  const [reports, setReports] = useState([])
  const [filters, setFilters] = useState({ search: '' })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_REPORT })
  const [viewReport, setViewReport] = useState(null)
  const [loading, setLoading] = useState(true)

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : ''
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('fr-FR', FORMAT_OPTIONS.datetime) : ''

  const loadData = async () => {
    try {
      const userRole = getUserRole()
      const res = await reportService.getAll({ limit: 200 })
      const list = pickList(res, ['data'])
        .filter(report => {
          if (userRole === 'admin_principal') return true
          const tags = report.tags || []
          return tags.length === 0 || tags.includes('source:finance')
        })
        .map(report => mapReportToUi(report, '📄'))
      setReports(list)
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de charger les rapports'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const resetFilters = () => {
    setFilters({ search: '' })
    setPagination(p => ({ ...p, currentPage: 1 }))
  }

  const filteredData = useMemo(() => {
    return reports.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (![item.title, item.description].some(f => f?.toLowerCase().includes(s))) return false
      }
      return true
    })
  }, [reports, filters])

  const paginatedData = filteredData.slice(
    (pagination.currentPage - 1) * pagination.itemsPerPage,
    pagination.currentPage * pagination.itemsPerPage
  )

  const openModal = (mode, item = null) => {
    if (item && mode === 'edit') {
      setFormData({ ...item })
    } else {
      setFormData({ ...EMPTY_REPORT })
    }
    setModal({ isOpen: true, mode, item })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', item: null })
    setFormData({ ...EMPTY_REPORT })
  }

  const handleAdd = async () => {
    try {
      await reportService.create({ ...formData, tags: ['source:finance'] })
      await loadData()
      closeModal()
      showNotif('report ajouté')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, "Impossible d'ajouter report"), 'error')
    }
  }

  const handleUpdate = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await reportService.update(targetId, formData)
      await loadData()
      closeModal()
      showNotif('report modifié')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de modifier report'), 'error')
    }
  }

  const handleDelete = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await reportService.delete(targetId)
      await loadData()
      closeModal()
      showNotif('report supprimé')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de supprimer report'), 'error')
    }
  }

  const handleReportDownload = async (report) => {
    try {
      await reportService.generatePdf(report.id)
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de télécharger le rapport'), 'error')
    }
  }

  if (loading) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>

  return (
    <div className="reports-content">
      <div className="filters-container">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher un rapport par titre ou description..."
            value={filters.search}
            onChange={e => { setFilters({ ...filters, search: e.target.value }); setPagination(p => ({ ...p, currentPage: 1 })) }}
            className="search-input" />
          {filters.search && <button className="clear-search" onClick={() => setFilters({ ...filters, search: '' })}>×</button>}
        </div>
      </div>
      {filters.search && (
        <p style={{ margin: '0 0 12px', fontSize: '0.85rem', color: '#718096' }}>
          {filteredData.length} résultat{filteredData.length !== 1 ? 's' : ''} trouvé{filteredData.length !== 1 ? 's' : ''}
        </p>
      )}
      <div className="reports-grid">
        {paginatedData.map(r => (
          <div key={r.id} className="report-card">
            <div className="report-icon" style={{ background: '#4299e115', color: '#4299e1' }}>📄</div>
            <div className="report-info">
              <h4>{r.title}</h4>
              <p className="report-description">{r.description}</p>
              <p className="report-date">
                <span>Date : {formatDate(r.date)}</span>
                <span className="report-created">Créé le : {formatDateTime(r.createdAt)}</span>
              </p>
            </div>
            <div className="report-actions">
              <button className="btn-icon" title="Voir le contenu complet" onClick={() => setViewReport(r)}>👁️</button>
              <button className="btn-icon" title="Modifier" onClick={() => openModal('edit', r)}>✏️</button>
              <button className="btn-icon" title="Télécharger en PDF" onClick={() => handleReportDownload(r)}>PDF</button>
              <button className="btn-icon delete" title="Supprimer" onClick={() => openModal('delete', r)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>
      {!filteredData.length && <NoResults onReset={resetFilters} />}
      <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />

      {modal.isOpen && modal.mode !== 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'add' ? '➕ Nouveau' : '✏️ Modifier'} report</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <ReportForm formData={formData} setFormData={setFormData} />
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-primary" style={{ background: '#4299e1' }}
                onClick={modal.mode === 'add' ? handleAdd : handleUpdate}>
                {modal.mode === 'add' ? 'Ajouter' : 'Modifier'}
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.isOpen && modal.mode === 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>⚠️ Confirmation</h3><button className="modal-close" onClick={closeModal}>×</button></div>
            <div className="modal-body">
              <p>Êtes-vous sûr de vouloir supprimer cet élément ?</p>
              <p className="text-danger">Cette action est irréversible.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-danger" onClick={handleDelete}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {viewReport && (
        <ReportViewModal report={viewReport} onClose={() => setViewReport(null)} formatDate={formatDate} formatDateTime={formatDateTime} />
      )}
    </div>
  )
}

export default ReportsPage
