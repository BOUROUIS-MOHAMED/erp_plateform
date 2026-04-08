import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { transactionService } from '../../../services/transactionService'
import { accountService } from '../../../services/accountService'
import {
  extractApiErrorMessage,
  mapTransactionToUi,
  mapAccountToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const COLORS = {
  success: '#48bb78', warning: '#ed8936', danger: '#f56565', muted: '#718096',
  successBg: '#c6f6d5', warningBg: '#feebc8', dangerBg: '#fed7d7',
  mutedBg: '#edf2f7', defaultBg: '#e2e8f0'
}

const STATUS_CONFIG = {
  'complété': { color: COLORS.success, bg: COLORS.successBg },
  'en attente': { color: COLORS.warning, bg: COLORS.warningBg },
  'en retard': { color: COLORS.danger, bg: COLORS.dangerBg },
}

const getStatusStyle = (status) => STATUS_CONFIG[status] || { color: COLORS.muted, bg: COLORS.defaultBg }

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
}

const today = new Date().toISOString().split('T')[0]

const EMPTY_TRANSACTION = {
  description: '', amount: '', type: 'revenu', category: 'Vente', account: '',
  date: today, status: 'complété', notes: ''
}

const StatusBadge = ({ status }) => {
  const style = getStatusStyle(status)
  return <span className="status-badge" style={{ background: style.bg, color: style.color }}>{status}</span>
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

const TransactionForm = ({ formData, setFormData, accounts }) => {
  const fd = formData
  const set = (field, value) => setFormData({ ...fd, [field]: value })
  return (<>
    <div className="form-group"><label>Description *</label><input type="text" value={fd.description} onChange={e => set('description', e.target.value)} required /></div>
    <div className="form-row">
      <div className="form-group"><label>Montant *</label><input type="number" value={fd.amount} onChange={e => set('amount', e.target.value)} step="0.01" required /></div>
      <div className="form-group"><label>Type *</label><select value={fd.type} onChange={e => set('type', e.target.value)}><option value="revenu">Revenu</option><option value="dépense">Dépense</option></select></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Catégorie *</label><select value={fd.category} onChange={e => set('category', e.target.value)}>
        <option value="Vente">Vente</option><option value="Achat">Achat</option><option value="Salaires">Salaires</option><option value="Loyer">Loyer</option>
      </select></div>
      <div className="form-group"><label>Compte *</label><select value={fd.account || ''} onChange={e => set('account', e.target.value)}>
        <option value="" disabled>-- Sélectionnez un compte --</option>
        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
      </select></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Date *</label><input type="date" value={fd.date} onChange={e => set('date', e.target.value)} required /></div>
      <div className="form-group"><label>Statut *</label><select value={fd.status} onChange={e => set('status', e.target.value)}>
        <option value="complété">Complété</option><option value="en attente">En attente</option><option value="en retard">En retard</option>
      </select></div>
    </div>
    <div className="form-group"><label>Notes</label><textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="3" /></div>
  </>)
}

function TransactionsPage({ showNotif }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialAccount = searchParams.get('account') || 'tous'
  const notify = (msg, type) => { if (typeof showNotif === 'function') showNotif(msg, type); else if (type === 'error') window.alert(msg) }

  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [filters, setFilters] = useState({
    search: '', type: 'tous', status: 'tous', category: 'tous',
    account: initialAccount,
    dateRange: { start: '', end: '' }
  })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [sort, setSort] = useState({ key: 'date', direction: 'desc' })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_TRANSACTION })
  const [loading, setLoading] = useState(true)

  const formatCurrency = (amount) => (amount || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency)
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : ''

  const loadData = async () => {
    try {
      const [txRes, accRes] = await Promise.all([
        transactionService.getAll({ limit: 200 }),
        accountService.getAll({ limit: 200 }),
      ])
      setTransactions(pickList(txRes, ['data']).map(mapTransactionToUi))
      setAccounts(pickList(accRes, ['data']).map(mapAccountToUi))
    } catch (error) {
      notify(extractApiErrorMessage(error, 'Impossible de charger les transactions'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const resetFilters = () => {
    setFilters({ search: '', type: 'tous', status: 'tous', category: 'tous', account: 'tous', dateRange: { start: '', end: '' } })
    setPagination(p => ({ ...p, currentPage: 1 }))
  }

  const filteredData = useMemo(() => {
    return transactions.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (![item.description, item.id].some(f => f?.toLowerCase().includes(s))) return false
      }
      if (filters.type !== 'tous' && item.type !== filters.type) return false
      if (filters.status !== 'tous' && item.status !== filters.status) return false
      if (filters.category !== 'tous' && item.category !== filters.category) return false
      if (filters.account !== 'tous' && item.account !== filters.account) return false
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start) return false
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end) return false
      return true
    })
  }, [transactions, filters])

  const sortedData = useMemo(() => [...filteredData].sort((a, b) => {
    let valA = a[sort.key], valB = b[sort.key]
    if (['date', 'createdAt'].includes(sort.key)) { valA = new Date(valA || 0); valB = new Date(valB || 0) }
    if (['amount'].includes(sort.key)) { valA = Number(valA) || 0; valB = Number(valB) || 0 }
    return valA < valB ? (sort.direction === 'asc' ? -1 : 1) : valA > valB ? (sort.direction === 'asc' ? 1 : -1) : 0
  }), [filteredData, sort])

  const paginatedData = sortedData.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage)

  const openModal = (mode, item = null) => {
    if (item && mode === 'edit') {
      setFormData({ ...item, amount: Math.abs(item.amount || 0).toString() })
    } else {
      setFormData({ ...EMPTY_TRANSACTION })
    }
    setModal({ isOpen: true, mode, item })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', item: null })
    setFormData({ ...EMPTY_TRANSACTION })
  }

  const handleAdd = async () => {
    try {
      const form = formData
      const amount = parseFloat(form.amount) || 0
      const mainAcc = accounts.find(a => String(a.id) === String(form.account) || a.name === form.account)
      if (!mainAcc) throw new Error('Veuillez sélectionner un compte principal valide.')
      const mainAccId = mainAcc.backendId || mainAcc.id
      let counterAcc = accounts.find(a => a.name.toLowerCase().includes(form.type === 'revenu' ? 'client' : 'fournisseur'))
      if (!counterAcc) counterAcc = accounts.find(a => String(a.backendId || a.id) !== String(mainAccId))
      if (!counterAcc) {
        const autoName = form.type === 'revenu' ? 'Compte Client (Auto)' : 'Compte Fournisseur (Auto)'
        await accountService.create({ name: autoName, type: form.type === 'revenu' ? 'Créance' : 'Dette', balance: 0, status: 'actif' })
        const newAccounts = await accountService.getAll({ limit: 200 })
        counterAcc = pickList(newAccounts, ['data']).map(mapAccountToUi).find(a => a.name === autoName)
        if (!counterAcc) throw new Error('Erreur critique lors de la création du compte partiel automatique.')
      }
      const counterAccId = counterAcc.backendId || counterAcc.id
      const payload = { date: form.date, description: form.description, reference: form.notes, entries: [] }
      if (form.type === 'revenu') {
        payload.entries.push({ account: mainAccId, debit: amount, credit: 0, label: form.category })
        payload.entries.push({ account: counterAccId, debit: 0, credit: amount, label: form.category })
      } else {
        payload.entries.push({ account: counterAccId, debit: amount, credit: 0, label: form.category })
        payload.entries.push({ account: mainAccId, debit: 0, credit: amount, label: form.category })
      }
      const createResult = await transactionService.create(payload)
      if (form.status === 'complété') {
        const newTxId = createResult?.data?.id || createResult?.data?._id
        if (newTxId) { try { await transactionService.validate(newTxId) } catch (e) { console.warn('Auto-validate failed:', e) } }
      }
      await loadData()
      closeModal()
      notify('transaction ajouté')
    } catch (error) {
      notify(extractApiErrorMessage(error, "Impossible d'ajouter transaction"), 'error')
    }
  }

  const handleUpdate = async () => {
    try {
      const form = formData
      const targetId = modal.item?.backendId || modal.item?.id
      const amount = parseFloat(form.amount) || 0
      const mainAcc = accounts.find(a => String(a.id) === String(form.account) || String(a.backendId) === String(form.account) || a.name === form.account)
      if (!mainAcc) throw new Error('Veuillez sélectionner un compte principal valide.')
      const mainAccId = mainAcc.backendId || mainAcc.id
      let counterAcc = accounts.find(a => a.name.toLowerCase().includes(form.type === 'revenu' ? 'client' : 'fournisseur'))
      if (!counterAcc) counterAcc = accounts.find(a => String(a.backendId || a.id) !== String(mainAccId))
      const counterAccId = counterAcc ? (counterAcc.backendId || counterAcc.id) : mainAccId
      const payload = { description: form.description, entries: [] }
      if (form.type === 'revenu') {
        payload.entries.push({ account: mainAccId, debit: amount, credit: 0, label: form.category })
        payload.entries.push({ account: counterAccId, debit: 0, credit: amount, label: form.category })
      } else {
        payload.entries.push({ account: counterAccId, debit: amount, credit: 0, label: form.category })
        payload.entries.push({ account: mainAccId, debit: 0, credit: amount, label: form.category })
      }
      await transactionService.update(targetId, payload)
      if (form.status === 'complété') { try { await transactionService.validate(targetId) } catch (e) { console.warn('Validation call failed:', e) } }
      await loadData()
      closeModal()
      notify('transaction modifié')
    } catch (error) {
      notify(extractApiErrorMessage(error, 'Impossible de modifier transaction'), 'error')
    }
  }

  const handleDelete = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await transactionService.delete(targetId)
      await loadData()
      closeModal()
      notify('transaction supprimé')
    } catch (error) {
      notify(extractApiErrorMessage(error, 'Impossible de supprimer transaction'), 'error')
    }
  }

  const exportToCSV = () => {
    if (!filteredData.length) return notify('Aucune donnée', 'error')
    const csv = [Object.keys(filteredData[0]).join(','), ...filteredData.map(item => Object.values(item).join(','))].join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `transactions_${today}.csv` })
    a.click(); URL.revokeObjectURL(url)
    showNotif('Exporté dans transactions.csv')
  }

  if (loading) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>

  return (
    <div className="transactions-content">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
        <button className="btn-primary" onClick={() => openModal('add')}>+ Nouvelle transaction</button>
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
            <option value="tous">Tous types</option><option value="revenu">Revenus</option><option value="dépense">Dépenses</option>
          </select>
          <select className="filter-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="tous">Tous statuts</option><option value="complété">Complété</option><option value="en attente">En attente</option><option value="en retard">En retard</option>
          </select>
          <select className="filter-select" value={filters.account} onChange={e => setFilters({ ...filters, account: e.target.value })}>
            <option value="tous">Tous comptes</option>{accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
          </select>
          <button className="btn-reset-filters" onClick={resetFilters}>↻ Réinitialiser</button>
          <button className="btn-export" onClick={exportToCSV}>📥 Exporter</button>
        </div>
      </div>

      <div className="table-container">
        <table className="transactions-full-table">
          <thead><tr>
            {['N°', 'Date', 'Description', 'Catégorie', 'Compte', 'Montant', 'Statut', 'Actions'].map(col => {
              const keyMap = { 'N°': 'id', 'Date': 'date', 'Montant': 'amount' }
              const sortKey = keyMap[col]
              return <th key={col} onClick={() => sortKey && setSort({ key: sortKey, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}>
                {col} {sort.key === sortKey && (sort.direction === 'asc' ? '↑' : '↓')}
              </th>
            })}
          </tr></thead>
          <tbody>
            {paginatedData.map(t => (
              <tr key={t.id}>
                <td className="transaction-number">{t.id}</td>
                <td>{formatDate(t.date)}</td>
                <td className="transaction-desc">{t.description}{t.notes && <small className="notes-indicator">📝</small>}</td>
                <td><span className="category-badge">{t.category}</span></td>
                <td>{t.account}</td>
                <td className={t.type === 'revenu' ? 'text-success' : 'text-danger'}>
                  <strong>{t.type === 'revenu' ? '+' : '-'}{formatCurrency(Math.abs(t.amount))}</strong>
                </td>
                <td><StatusBadge status={t.status} /></td>
                <td><div className="action-buttons">
                  <button className="action-btn" onClick={() => openModal('edit', t)}>✏️</button>
                  <button className="action-btn delete" onClick={() => openModal('delete', t)}>🗑️</button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filteredData.length && <NoResults onReset={resetFilters} />}
      </div>
      <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />

      {modal.isOpen && modal.mode !== 'delete' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === 'add' ? '➕ Nouvelle transaction' : '✏️ Modifier la transaction'}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <TransactionForm formData={formData} setFormData={setFormData} accounts={accounts} />
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

export default TransactionsPage
