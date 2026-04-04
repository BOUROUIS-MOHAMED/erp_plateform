import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { accountService } from '../../../services/accountService'
import {
  extractApiErrorMessage,
  mapAccountToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const COLORS = {
  success: '#48bb78', warning: '#ed8936', danger: '#f56565', muted: '#718096',
  successBg: '#c6f6d5', warningBg: '#feebc8', dangerBg: '#fed7d7',
  mutedBg: '#edf2f7', defaultBg: '#e2e8f0'
}

const STATUS_CONFIG = {
  'actif': { color: COLORS.success, bg: COLORS.successBg },
  'inactif': { color: COLORS.muted, bg: COLORS.mutedBg },
}

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
}

const EMPTY_ACCOUNT = {
  name: '', type: 'Banque', number: '', iban: '', bic: '',
  balance: '', status: 'actif', inMoneyFlow: false
}

const getStatusStyle = (status) => STATUS_CONFIG[status] || { color: COLORS.muted, bg: COLORS.defaultBg }

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

const AccountForm = ({ formData, setFormData }) => {
  const fd = formData
  const set = (field, value) => setFormData({ ...fd, [field]: value })
  return (<>
    <div className="form-group"><label>Nom *</label><input type="text" value={fd.name} onChange={e => set('name', e.target.value)} required /></div>
    <div className="form-row">
      <div className="form-group"><label>Type *</label><select value={fd.type} onChange={e => set('type', e.target.value)}>
        <option value="Banque">Banque</option><option value="Épargne">Épargne</option><option value="Créance">Créance</option><option value="Dette">Dette</option>
      </select></div>
      <div className="form-group">
        <label>Capital *</label>
        <input type="number" value={fd.balance} onChange={e => set('balance', e.target.value)} step="0.01" required />
        <small style={{ color: '#718096' }}>Le solde sera calculé : capital + transactions validées</small>
      </div>
    </div>
    <div className="form-group"><label>Numéro de compte</label><input type="text" value={fd.number} onChange={e => set('number', e.target.value)} /></div>
    <div className="form-row">
      <div className="form-group"><label>IBAN</label><input type="text" value={fd.iban} onChange={e => set('iban', e.target.value)} /></div>
      <div className="form-group"><label>BIC</label><input type="text" value={fd.bic} onChange={e => set('bic', e.target.value)} /></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Statut</label><select value={fd.status} onChange={e => set('status', e.target.value)}>
        <option value="actif">Actif</option><option value="inactif">Inactif</option>
      </select></div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(fd.inMoneyFlow)} onChange={e => set('inMoneyFlow', e.target.checked)} style={{ width: '18px', height: '18px' }} />
          Inclure dans le flux de trésorerie
        </label>
        <small style={{ color: '#718096' }}>Ce compte apparaîtra dans Money Flow</small>
      </div>
    </div>
  </>)
}

function AccountsPage({ showNotif }) {
  const navigate = useNavigate()

  const [accounts, setAccounts] = useState([])
  const [filters, setFilters] = useState({ search: '', type: 'tous', status: 'tous' })
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 })
  const [modal, setModal] = useState({ isOpen: false, mode: 'add', item: null })
  const [formData, setFormData] = useState({ ...EMPTY_ACCOUNT })
  const [loading, setLoading] = useState(true)

  const formatCurrency = (amount) => (amount || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency)

  const loadData = async () => {
    try {
      const res = await accountService.getAll({ limit: 200 })
      setAccounts(pickList(res, ['data']).map(mapAccountToUi))
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de charger les comptes'), 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const resetFilters = () => {
    setFilters({ search: '', type: 'tous', status: 'tous' })
    setPagination(p => ({ ...p, currentPage: 1 }))
  }

  const filteredData = useMemo(() => {
    return accounts.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase()
        if (![item.name, item.number].some(f => f?.toLowerCase().includes(s))) return false
      }
      if (filters.type !== 'tous' && item.type !== filters.type) return false
      if (filters.status !== 'tous' && item.status !== filters.status) return false
      return true
    })
  }, [accounts, filters])

  const paginatedData = filteredData.slice(
    (pagination.currentPage - 1) * pagination.itemsPerPage,
    pagination.currentPage * pagination.itemsPerPage
  )

  const openModal = (mode, item = null) => {
    if (item && mode === 'edit') {
      setFormData({ ...item, balance: (item.capital ?? item.balance ?? 0).toString(), inMoneyFlow: Boolean(item.inMoneyFlow) })
    } else {
      setFormData({ ...EMPTY_ACCOUNT })
    }
    setModal({ isOpen: true, mode, item })
  }

  const closeModal = () => {
    setModal({ isOpen: false, mode: 'add', item: null })
    setFormData({ ...EMPTY_ACCOUNT })
  }

  const handleAdd = async () => {
    try {
      await accountService.create({ ...formData, inMoneyFlow: Boolean(formData.inMoneyFlow) })
      await loadData()
      closeModal()
      showNotif('account ajouté')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, "Impossible d'ajouter account"), 'error')
    }
  }

  const handleUpdate = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await accountService.update(targetId, { ...formData, inMoneyFlow: Boolean(formData.inMoneyFlow) })
      await loadData()
      closeModal()
      showNotif('account modifié')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de modifier account'), 'error')
    }
  }

  const handleDelete = async () => {
    try {
      const targetId = modal.item?.backendId || modal.item?.id
      await accountService.delete(targetId)
      await loadData()
      closeModal()
      showNotif('account supprimé')
    } catch (error) {
      showNotif(extractApiErrorMessage(error, 'Impossible de supprimer account'), 'error')
    }
  }

  if (loading) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>

  return (
    <div className="accounts-content">
      <div className="filters-container">
        <div className="search-box">
          <span className="search-icon">🔍</span>
          <input type="text" placeholder="Rechercher..." value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="search-input" />
          {filters.search && <button className="clear-search" onClick={() => setFilters({ ...filters, search: '' })}>×</button>}
        </div>
        <div className="filter-group">
          <select className="filter-select" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
            <option value="tous">Tous types</option><option value="Banque">Banque</option><option value="Épargne">Épargne</option><option value="Créance">Créance</option><option value="Dette">Dette</option>
          </select>
          <select className="filter-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
            <option value="tous">Tous statuts</option><option value="actif">Actif</option><option value="inactif">Inactif</option>
          </select>
          <button className="btn-reset-filters" onClick={resetFilters}>↻ Réinitialiser</button>
        </div>
      </div>

      <div className="accounts-grid">
        {paginatedData.map(a => (
          <div key={a.id} className="account-card">
            <div className="account-card-header">
              <div className="account-icon" style={{ background: '#4299e115', color: '#4299e1' }}>
                {a.type === 'Banque' ? '🏦' : a.type === 'Épargne' ? '💰' : '📋'}
              </div>
              <div className="account-info"><h4>{a.name}</h4><p className="account-number">{a.number}</p></div>
              <StatusBadge status={a.status} />
            </div>
            <div className="account-card-body">
              <div className="account-balance"><span>Capital</span><strong>{formatCurrency(a.capital)}</strong></div>
              <div className="account-balance"><span>Solde</span><strong className={a.solde >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(a.solde)}</strong></div>
              <div className="account-type"><span>Type</span><strong>{a.type}</strong></div>
              {a.inMoneyFlow && <span className="status-badge" style={{ background: '#bee3f8', color: '#2b6cb0', fontSize: '0.7rem' }}>Money Flow</span>}
              {a.iban && <div className="account-iban"><span>IBAN</span><small>{a.iban}</small></div>}
            </div>
            <div className="account-card-footer">
              <button className="btn-small" onClick={() => navigate(`/finance/transactions?account=${encodeURIComponent(a.id)}`)}>Voir transactions</button>
              <button className="btn-icon" onClick={() => openModal('edit', a)}>✏️</button>
              <button className="btn-icon" onClick={() => openModal('delete', a)}>🗑️</button>
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
              <h3>{modal.mode === 'add' ? '➕ Nouveau' : '✏️ Modifier'} account</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              <AccountForm formData={formData} setFormData={setFormData} />
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
              {modal.item?.balance !== 0 && (
                <p className="text-warning">⚠️ Attention : Ce compte a un solde de {formatCurrency(modal.item?.balance)}.</p>
              )}
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

export default AccountsPage
