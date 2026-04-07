import { useState, useEffect, useMemo } from 'react'
import { targetService } from '../../../services/targetService'
import {
  extractApiErrorMessage,
  mapTargetToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const COLORS = {
  success: '#48bb78', warning: '#ed8936', danger: '#f56565', muted: '#718096', info: '#4299e1',
  successBg: '#c6f6d5', warningBg: '#feebc8', dangerBg: '#fed7d7',
  mutedBg: '#edf2f7', infoBg: '#bee3f8', defaultBg: '#e2e8f0'
}

const STATUS_CONFIG = {
  'in_progress': { color: COLORS.info, bg: COLORS.infoBg },
  'reached': { color: COLORS.success, bg: COLORS.successBg },
  'failed': { color: COLORS.danger, bg: COLORS.dangerBg },
  'desactivated': { color: COLORS.muted, bg: COLORS.mutedBg },
}

const STATUS_LABELS = {
  in_progress: 'En cours', reached: 'Atteint', failed: 'Échoué', desactivated: 'Désactivé'
}

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_TARGET = {
  category: '', amount: '', realisedAmount: '0',
  startDate: '', endDate: '', notes: '', status: 'in_progress'
}

const getStatusStyle = (status) => STATUS_CONFIG[status] || { color: COLORS.muted, bg: COLORS.defaultBg }
const getStatusLabel = (status) => STATUS_LABELS[status] || status

const StatusBadge = ({ status }) => {
  const style = getStatusStyle(status)
  return <span className="status-badge" style={{ background: style.bg, color: style.color }}>{getStatusLabel(status)}</span>
}

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

const TargetForm = ({ formData, setFormData }) => {
  const fd = formData
  const set = (field, value) => setFormData({ ...fd, [field]: value })
  return (<>
    <div className="form-group">
      <label>Catégorie *</label>
      <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} placeholder="ex: ventes, abonnements..." required />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Objectif (montant) *</label>
        <input type="number" value={fd.amount} onChange={e => set('amount', e.target.value)} step="0.01" min="0" required />
      </div>
      <div className="form-group">
        <label>Réalisé</label>
        <input type="number" value={fd.realisedAmount} onChange={e => set('realisedAmount', e.target.value)} step="0.01" min="0" />
        <small style={{ color: '#718096' }}>Recalculé automatiquement par Money Flow</small>
      </div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Date début *</label><input type="date" value={fd.startDate} onChange={e => set('startDate', e.target.value)} required /></div>
      <div className="form-group"><label>Date fin *</label><input type="date" value={fd.endDate} onChange={e => set('endDate', e.target.value)} required /></div>
    </div>
    <div className="form-group">
      <label>Statut</label>
      <select value={fd.status} onChange={e => set('status', e.target.value)}>
        <option value="in_progress">En cours (auto)</option>
        <option value="desactivated">Désactivé</option>
      </select>
      <small style={{ color: '#718096' }}>Seul "Désactivé" peut être défini manuellement</small>
    </div>
    <div className="form-group"><label>Notes</label><textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="3" /></div>
  </>)
}

function TargetsPage({ showNotif }) {
  const [targets, setTargets] = useState([])
  const [filters, setFilters] = useState({ search: '', status: 'tous', dateRange: { start: '', end: '' } })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [sort, setSort] = useState({ key: 'startDate', direction: 'desc' })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_TARGET })
  const [loading, setLoading] = useState(true)

  const formatCurrency = (amount) => (amount || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency)
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : ''

  const loadData = async () => {
    try {
      const res = await targetService.getAll({ limit: 200 })
      setTargets(pickList(res, ['data']).map(mapTargetToUi))
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de charger les objectifs'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const resetFilters = () => {
    setFilters({ search: '', status: 'tous', dateRange: { start: '', end: '' } })
    setPagination(p => ({ ...p, currentPage: 1 }))
  }

  const filteredData = useMemo(() => {
    return targets.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (![item.category].some(f => f?.toLowerCase().includes(s))) return false
      }
      if (filters.status !== 'tous' && item.status !== filters.status) return false
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start) return false
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end) return false
      return true
    })
  }, [targets, filters])

  const sortedData = useMemo(() => [...filteredData].sort((a, b) => {
    let valA = a[sort.key], valB = b[sort.key]
    if (['startDate', 'endDate'].includes(sort.key)) { valA = new Date(valA || 0); valB = new Date(valB || 0) }
    if (['amount', 'realisedAmount'].includes(sort.key)) { valA = Number(valA) || 0; valB = Number(valB) || 0 }
    return valA < valB ? (sort.direction === 'asc' ? -1 : 1) : valA > valB ? (sort.direction === 'asc' ? 1 : -1) : 0
  }), [filteredData, sort])

  const paginatedData = sortedData.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage)

  const targetTotalGoal = filteredData.reduce((s, t) => s + (t.amount || 0), 0)
  const targetTotalRealised = filteredData.reduce((s, t) => s + (t.realisedAmount || 0), 0)

  const openModal = (mode, item = null) => {
    if (item && mode === 'edit') {
      setFormData({ ...item, amount: (item.amount || 0).toString(), realisedAmount: (item.realisedAmount || 0).toString() })
    } else {
      setFormData({ ...EMPTY_TARGET })
    }
    setModal({ isOpen: true, mode, item })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', item: null })
    setFormData({ ...EMPTY_TARGET })
  }

  const handleAdd = async () => {
    try {
      await targetService.create(formData)
      await loadData()
      closeModal()
      showNotif('target ajouté')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, "Impossible d'ajouter target"), 'error')
    }
  }

  const handleUpdate = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await targetService.update(targetId, formData)
      await loadData()
      closeModal()
      showNotif('target modifié')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de modifier target'), 'error')
    }
  }

  const handleDelete = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await targetService.delete(targetId)
      await loadData()
      closeModal()
      showNotif('target supprimé')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de supprimer target'), 'error')
    }
  }

  const exportToCSV = () => {
    if (!filteredData.length) return showNotif('Aucune donnée', 'error')
    const csv = [Object.keys(filteredData[0]).join(','), ...filteredData.map(item => Object.values(item).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `targets_${today}.csv` })
    a.click(); URL.revokeObjectURL(url)
    showNotif('Exporté dans targets.csv')
  }

  if (loading) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>

  return (
    <div className="budgets-content">
      <div className="filters-container">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher..." value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="search-input" />
          {filters.search && <button className="clear-search" onClick={() => setFilters({ ...filters, search: '' })}>×</button>}
        </div>
        <div className="filter-group">
          <select className="filter-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="tous">Tous statuts</option><option value="in_progress">En cours</option><option value="reached">Atteint</option><option value="failed">Échoué</option><option value="desactivated">Désactivé</option>
          </select>
          <button className="btn-reset-filters" onClick={resetFilters}>↻ Réinitialiser</button>
          <button className="btn-export" onClick={exportToCSV}>📥 Exporter</button>
        </div>
      </div>

      <div className="budgets-summary">
        {[
          { label: 'Total objectifs', value: formatCurrency(targetTotalGoal) },
          { label: 'Total réalisé', value: formatCurrency(targetTotalRealised) },
          { label: 'Taux de réussite', value: targetTotalGoal > 0 ? `${((targetTotalRealised / targetTotalGoal) * 100).toFixed(1)}%` : '0%' }
        ].map((item, i) => (
          <div key={i} className="budget-summary-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="table-container">
        <table className="budgets-table">
          <thead><tr>
            <th onClick={() => setSort({ key: 'category', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
              Catégorie {sort.key === 'category' && (sort.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => setSort({ key: 'amount', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
              Objectif {sort.key === 'amount' && (sort.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th>Réalisé</th>
            <th>Progression %</th>
            <th>Statut</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {paginatedData.map(t => {
              const progression = t.amount > 0 ? Math.min((t.realisedAmount / t.amount) * 100, 100) : 0
              const progressColor = progression >= 100 ? COLORS.success : progression > 70 ? COLORS.warning : COLORS.info
              return (
                <tr key={t.id}>
                  <td className="budget-category">{t.category}{t.notes && <small className="notes-indicator" title={t.notes}>📝</small>}</td>
                  <td>{formatCurrency(t.amount)}</td>
                  <td>{formatCurrency(t.realisedAmount)}</td>
                  <td>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${progression}%`, background: progressColor }}></div>
                      <span className="progress-text">{progression.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td>{formatDate(t.startDate)}</td>
                  <td>{formatDate(t.endDate)}</td>
                  <td><div className="action-buttons">
                    <button className="action-btn" onClick={() => openModal('edit', t)}>✏️</button>
                    <button className="action-btn delete" onClick={() => openModal('delete', t)}>🗑️</button>
                  </div></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!filteredData.length && <NoResults onReset={resetFilters} />}
      </div>
      <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />

      {modal.isOpen && modal.mode !== 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'add' ? '➕ Nouveau' : '✏️ Modifier'} target</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <TargetForm formData={formData} setFormData={setFormData} />
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
    </div>
  )
}

export default TargetsPage
