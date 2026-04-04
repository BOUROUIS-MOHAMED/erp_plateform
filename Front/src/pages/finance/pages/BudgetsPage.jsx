import { useState, useEffect, useMemo } from 'react'
import { budgetService } from '../../../services/budgetService'
import {
  extractApiErrorMessage,
  mapBudgetToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const COLORS = {
  success: '#48bb78', warning: '#ed8936', danger: '#f56565', muted: '#718096',
  successBg: '#c6f6d5', warningBg: '#feebc8', dangerBg: '#fed7d7',
  mutedBg: '#edf2f7', defaultBg: '#e2e8f0'
}

const STATUS_CONFIG = {
  'respected': { color: COLORS.success, bg: COLORS.successBg },
  'passed': { color: COLORS.danger, bg: COLORS.dangerBg },
  'desactivated': { color: COLORS.muted, bg: COLORS.mutedBg },
}

const STATUS_LABELS = {
  respected: 'Respecté', passed: 'Dépassé', desactivated: 'Désactivé'
}

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_BUDGET = {
  category: '', budget: '', usedAmount: '0',
  startDate: '', endDate: '', notes: '', status: 'respected'
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

const BudgetForm = ({ formData, setFormData }) => {
  const fd = formData
  const set = (field, value) => setFormData({ ...fd, [field]: value })
  return (<>
    <div className="form-group">
      <label>Catégorie *</label>
      <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} placeholder="ex: salaires, loyer..." required />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Montant budget *</label>
        <input type="number" value={fd.budget} onChange={e => set('budget', e.target.value)} step="0.01" min="0" required />
      </div>
      <div className="form-group">
        <label>Montant utilisé</label>
        <input type="number" value={fd.usedAmount} onChange={e => set('usedAmount', e.target.value)} step="0.01" min="0" />
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
        <option value="respected">Respecté (auto)</option>
        <option value="desactivated">Désactivé</option>
      </select>
      <small style={{ color: '#718096' }}>Seul "Désactivé" peut être défini manuellement — les autres sont calculés automatiquement</small>
    </div>
    <div className="form-group"><label>Notes</label><textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="3" /></div>
  </>)
}

function BudgetsPage({ showNotif }) {
  const [budgets, setBudgets] = useState([])
  const [filters, setFilters] = useState({ search: '', status: 'tous', dateRange: { start: '', end: '' } })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [sort, setSort] = useState({ key: 'startDate', direction: 'desc' })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_BUDGET })
  const [loading, setLoading] = useState(true)

  const formatCurrency = (amount) => (amount || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency)
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : ''

  const loadData = async () => {
    try {
      const res = await budgetService.getAll({ limit: 200 })
      setBudgets(pickList(res, ['data']).map(mapBudgetToUi))
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de charger les budgets'), 'error')
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
    return budgets.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (![item.category].some(f => f?.toLowerCase().includes(s))) return false
      }
      if (filters.status !== 'tous' && item.status !== filters.status) return false
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start) return false
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end) return false
      return true
    })
  }, [budgets, filters])

  const sortedData = useMemo(() => [...filteredData].sort((a, b) => {
    let valA = a[sort.key], valB = b[sort.key]
    if (['startDate', 'endDate'].includes(sort.key)) { valA = new Date(valA || 0); valB = new Date(valB || 0) }
    if (['budget', 'usedAmount'].includes(sort.key)) { valA = Number(valA) || 0; valB = Number(valB) || 0 }
    return valA < valB ? (sort.direction === 'asc' ? -1 : 1) : valA > valB ? (sort.direction === 'asc' ? 1 : -1) : 0
  }), [filteredData, sort])

  const paginatedData = sortedData.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage)

  const budgetTotalBudget = filteredData.reduce((s, b) => s + (b.budget || 0), 0)
  const budgetTotalUsed = filteredData.reduce((s, b) => s + (b.usedAmount || 0), 0)

  const openModal = (mode, item = null) => {
    if (item && mode === 'edit') {
      setFormData({ ...item, budget: (item.budget || 0).toString(), usedAmount: (item.usedAmount || 0).toString() })
    } else {
      setFormData({ ...EMPTY_BUDGET })
    }
    setModal({ isOpen: true, mode, item })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', item: null })
    setFormData({ ...EMPTY_BUDGET })
  }

  const handleAdd = async () => {
    try {
      await budgetService.create(formData)
      await loadData()
      closeModal()
      showNotif('budget ajouté')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, "Impossible d'ajouter budget"), 'error')
    }
  }

  const handleUpdate = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await budgetService.update(targetId, formData)
      await loadData()
      closeModal()
      showNotif('budget modifié')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de modifier budget'), 'error')
    }
  }

  const handleDelete = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await budgetService.delete(targetId)
      await loadData()
      closeModal()
      showNotif('budget supprimé')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de supprimer budget'), 'error')
    }
  }

  const exportToCSV = () => {
    if (!filteredData.length) return showNotif('Aucune donnée', 'error')
    const csv = [Object.keys(filteredData[0]).join(','), ...filteredData.map(item => Object.values(item).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `budgets_${today}.csv` })
    a.click(); URL.revokeObjectURL(url)
    showNotif('Exporté dans budgets.csv')
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
            <option value="tous">Tous statuts</option><option value="respected">Respecté</option><option value="passed">Dépassé</option><option value="desactivated">Désactivé</option>
          </select>
          <button className="btn-reset-filters" onClick={resetFilters}>↻ Réinitialiser</button>
          <button className="btn-export" onClick={exportToCSV}>📥 Exporter</button>
        </div>
      </div>

      <div className="budgets-summary">
        {[
          { label: 'Budget total', value: formatCurrency(budgetTotalBudget) },
          { label: 'Total utilisé', value: formatCurrency(budgetTotalUsed) },
          { label: 'Variance', value: formatCurrency(budgetTotalUsed - budgetTotalBudget), className: budgetTotalUsed <= budgetTotalBudget ? 'text-success' : 'text-danger' },
          { label: 'Taux global', value: budgetTotalBudget > 0 ? `${((budgetTotalUsed / budgetTotalBudget) * 100).toFixed(1)}%` : '0%' }
        ].map((item, i) => (
          <div key={i} className="budget-summary-card">
            <span>{item.label}</span>
            <strong className={item.className}>{item.value}</strong>
          </div>
        ))}
      </div>

      <div className="table-container">
        <table className="budgets-table">
          <thead><tr>
            <th onClick={() => setSort({ key: 'category', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
              Catégorie {sort.key === 'category' && (sort.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => setSort({ key: 'budget', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
              Montant {sort.key === 'budget' && (sort.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th>Utilisé</th>
            <th>Usage %</th>
            <th>Statut</th>
            <th>Début</th>
            <th>Fin</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {paginatedData.map(b => {
              const percentUsed = b.budget > 0 ? ((b.usedAmount || 0) / b.budget) * 100 : 0
              const progressColor = percentUsed > 100 ? COLORS.danger : percentUsed > 90 ? COLORS.warning : COLORS.success
              return (
                <tr key={b.id}>
                  <td className="budget-category">{b.category}{b.notes && <small className="notes-indicator" title={b.notes}>📝</small>}</td>
                  <td>{formatCurrency(b.budget)}</td>
                  <td>{formatCurrency(b.usedAmount)}</td>
                  <td>
                    <div className="progress-bar-container">
                      <div className="progress-bar" style={{ width: `${Math.min(percentUsed, 100)}%`, background: progressColor }}></div>
                      <span className="progress-text">{percentUsed.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td><StatusBadge status={b.status} /></td>
                  <td>{formatDate(b.startDate)}</td>
                  <td>{formatDate(b.endDate)}</td>
                  <td><div className="action-buttons">
                    <button className="action-btn" onClick={() => openModal('edit', b)}>✏️</button>
                    <button className="action-btn delete" onClick={() => openModal('delete', b)}>🗑️</button>
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
              <h3>{modal.mode === 'add' ? '➕ Nouveau' : '✏️ Modifier'} budget</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <BudgetForm formData={formData} setFormData={setFormData} />
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

export default BudgetsPage
