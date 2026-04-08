import { useState, useEffect, useMemo } from 'react'
import { moneyFlowService } from '../../../services/moneyFlowService'
import { accountService } from '../../../services/accountService'
import {
  extractApiErrorMessage,
  mapMoneyFlowToUi,
  mapAccountToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const COLORS = {
  success: '#48bb78', danger: '#f56565', muted: '#718096', info: '#4299e1',
  successBg: '#c6f6d5', dangerBg: '#fed7d7', infoBg: '#bee3f8', defaultBg: '#e2e8f0'
}

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_MONEYFLOW = {
  category: '', amount: '', date: today, isExpense: false, note: ''
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

const MoneyFlowForm = ({ formData, setFormData }) => {
  const fd = formData
  const set = (field, value) => setFormData({ ...fd, [field]: value })
  return (<>
    <div className="form-group">
      <label>Catégorie *</label>
      <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} placeholder="ex: salaires, ventes..." required />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Montant *</label>
        <input type="number" value={fd.amount} onChange={e => set('amount', e.target.value)} step="0.01" min="0" required />
      </div>
      <div className="form-group"><label>Date *</label><input type="date" value={fd.date} onChange={e => set('date', e.target.value)} required /></div>
    </div>
    <div className="form-group">
      <label>Type *</label>
      <select value={fd.isExpense ? 'expense' : 'revenue'} onChange={e => set('isExpense', e.target.value === 'expense')}>
        <option value="revenue">Revenu</option>
        <option value="expense">Dépense</option>
      </select>
    </div>
    <div className="form-group"><label>Note</label><textarea value={fd.note} onChange={e => set('note', e.target.value)} rows="3" /></div>
  </>)
}

function MoneyFlowPage({ showNotif }) {
  const notify = (msg, type) => { if (typeof showNotif === 'function') showNotif(msg, type); else if (type === 'error') window.alert(msg) }
  const [moneyFlows, setMoneyFlows] = useState([])
  const [moneyFlowAccounts, setMoneyFlowAccounts] = useState([])
  const [filters, setFilters] = useState({ search: '', type: 'tous', dateRange: { start: '', end: '' } })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_MONEYFLOW })
  const [loading, setLoading] = useState(true)

  const formatCurrency = (amount) => (amount || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency)
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : ''

  const loadData = async () => {
    try {
      const [mfRes, accRes] = await Promise.all([
        moneyFlowService.getAll({ limit: 200 }),
        accountService.getAll({ limit: 200, inMoneyFlow: true }),
      ])
      setMoneyFlows(pickList(mfRes, ['data']).map(mapMoneyFlowToUi))
      setMoneyFlowAccounts(pickList(accRes, ['data']).map(mapAccountToUi))
    } catch (error) {
      notify(extractApiErrorMessage(error, 'Impossible de charger le money flow'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const resetFilters = () => {
    setFilters({ search: '', type: 'tous', dateRange: { start: '', end: '' } })
    setPagination(p => ({ ...p, currentPage: 1 }))
  }

  const filteredData = useMemo(() => {
    return moneyFlows.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (![item.category, item.note].some(f => f?.toLowerCase().includes(s))) return false
      }
      if (filters.type !== 'tous') {
        if (filters.type === 'expense' && !item.isExpense) return false
        if (filters.type === 'revenue' && item.isExpense) return false
      }
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start) return false
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end) return false
      return true
    })
  }, [moneyFlows, filters])

  const sortedData = useMemo(() => [...filteredData].sort((a, b) => {
    let valA = a[sort.key], valB = b[sort.key]
    if (['date'].includes(sort.key)) { valA = new Date(valA || 0); valB = new Date(valB || 0) }
    if (['amount'].includes(sort.key)) { valA = Number(valA) || 0; valB = Number(valB) || 0 }
    return valA < valB ? (sort.direction === 'asc' ? -1 : 1) : valA > valB ? (sort.direction === 'asc' ? 1 : -1) : 0
  }), [filteredData, sort])

  const paginatedData = sortedData.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage)

  const mfTotalRevenu = moneyFlows.reduce((s, e) => s + (!e.isExpense ? e.amount : 0), 0)
  const mfTotalDepense = moneyFlows.reduce((s, e) => s + (e.isExpense ? e.amount : 0), 0)
  const mfSoldesComptes = moneyFlowAccounts.reduce((s, a) => s + (a.solde || 0), 0)
  const mfNet = mfTotalRevenu - mfTotalDepense + mfSoldesComptes

  const openModal = (mode, item = null) => {
    if (item && mode === 'edit') {
      setFormData({ ...item, amount: (item.amount || 0).toString() })
    } else {
      setFormData({ ...EMPTY_MONEYFLOW })
    }
    setModal({ isOpen: true, mode, item })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', item: null })
    setFormData({ ...EMPTY_MONEYFLOW })
  }

  const handleAdd = async () => {
    try {
      await moneyFlowService.create(formData)
      await loadData()
      closeModal()
      notify('Flux ajouté')
    } catch (error) {
      notify(extractApiErrorMessage(error, "Impossible d'ajouter le flux"), 'error')
    }
  }

  const handleUpdate = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await moneyFlowService.update(targetId, formData)
      await loadData()
      closeModal()
      notify('Flux modifié')
    } catch (error) {
      notify(extractApiErrorMessage(error, 'Impossible de modifier le flux'), 'error')
    }
  }

  const handleDelete = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await moneyFlowService.delete(targetId)
      await loadData()
      closeModal()
      notify('Flux supprimé')
    } catch (error) {
      notify(extractApiErrorMessage(error, 'Impossible de supprimer le flux'), 'error')
    }
  }

  if (loading) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>

  return (
    <div className="budgets-content">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button className="btn-primary" onClick={() => openModal('add')}>+ Nouveau flux</button>
      </div>
      <div className="filters-container">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher..." value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="search-input" />
          {filters.search && <button className="clear-search" onClick={() => setFilters({ ...filters, search: '' })}>×</button>}
        </div>
        <div className="filter-group">
          <select className="filter-select" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
            <option value="tous">Tous types</option><option value="revenue">Revenus</option><option value="expense">Dépenses</option>
          </select>
          <button className="btn-reset-filters" onClick={resetFilters}>↻ Réinitialiser</button>
        </div>
      </div>

      <div className="budgets-summary">
        {[
          { label: 'Total revenus', value: formatCurrency(mfTotalRevenu), className: 'text-success' },
          { label: 'Total dépenses', value: formatCurrency(mfTotalDepense), className: 'text-danger' },
          { label: 'Soldes comptes', value: formatCurrency(mfSoldesComptes) },
          { label: 'NET', value: formatCurrency(mfNet), className: mfNet >= 0 ? 'text-success' : 'text-danger' }
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
            <th onClick={() => setSort({ key: 'amount', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
              Montant {sort.key === 'amount' && (sort.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th onClick={() => setSort({ key: 'date', direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
              Date {sort.key === 'date' && (sort.direction === 'asc' ? '↑' : '↓')}
            </th>
            <th>Type</th>
            <th>Note</th>
            <th>Actions</th>
          </tr></thead>
          <tbody>
            {paginatedData.map(e => (
              <tr key={e.id}>
                <td className="budget-category">{e.category}</td>
                <td className={e.isExpense ? 'text-danger' : 'text-success'}>
                  <strong>{e.isExpense ? '-' : '+'}{formatCurrency(e.amount)}</strong>
                </td>
                <td>{formatDate(e.date)}</td>
                <td>
                  <span className="status-badge" style={{ background: e.isExpense ? COLORS.dangerBg : COLORS.successBg, color: e.isExpense ? COLORS.danger : COLORS.success }}>
                    {e.isExpense ? 'Dépense' : 'Revenu'}
                  </span>
                </td>
                <td><small>{e.note || '—'}</small></td>
                <td><div className="action-buttons">
                  <button className="action-btn" onClick={() => openModal('edit', e)}>✏️</button>
                  <button className="action-btn delete" onClick={() => openModal('delete', e)}>🗑️</button>
                </div></td>
              </tr>
            ))}
            {moneyFlowAccounts.map(a => (
              <tr key={`acc-${a.id}`} style={{ background: '#f7fafc' }}>
                <td className="budget-category">🏦 {a.name}</td>
                <td className={a.solde >= 0 ? 'text-success' : 'text-danger'}>
                  <strong>{formatCurrency(a.solde)}</strong>
                </td>
                <td>—</td>
                <td>
                  <span className="status-badge" style={{ background: COLORS.infoBg, color: COLORS.info }}>Compte</span>
                </td>
                <td>—</td>
                <td>—</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredData.length && moneyFlowAccounts.length === 0 && <NoResults onReset={resetFilters} />}
      </div>
      <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />

      {modal.isOpen && modal.mode !== 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'add' ? '➕ Nouveau flux' : '✏️ Modifier le flux'}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <MoneyFlowForm formData={formData} setFormData={setFormData} />
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

export default MoneyFlowPage
