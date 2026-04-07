// src/pages/facturation/pages/ArchivePage.jsx
import { useState, useMemo, useCallback } from 'react'

const ARCHIVE_LS_KEY = 'erp_facturation_archives'
const getArchivedInvoices = () => { try { return JSON.parse(localStorage.getItem(ARCHIVE_LS_KEY)||'[]') } catch { return [] } }
const saveArchivedInvoices = (a) => localStorage.setItem(ARCHIVE_LS_KEY, JSON.stringify(a))

const utils = {
  formatCurrency: a => (a||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}),
  formatDate: d => d ? new Date(d).toLocaleDateString('fr-FR') : '',
}

const useNotification = () => {
  const [n,setN] = useState({show:false,message:'',type:''})
  const show = useCallback((m,t)=>{setN({show:true,message:m,type:t});setTimeout(()=>setN({show:false,message:'',type:''}),3000)},[])
  return {notification:n, showNotification:show}
}

export default function ArchivePage() {
  const [archiveLog, setArchiveLog] = useState(() => getArchivedInvoices())
  const [filters, setFilters] = useState({ search:'', year:'all' })
  const { notification, showNotification } = useNotification()

  const filteredArchiveLog = useMemo(() =>
    archiveLog
      .filter(e =>
        (!filters.search ||
          (e.invoiceId||'').toLowerCase().includes(filters.search.toLowerCase()) ||
          (e.client||'').toLowerCase().includes(filters.search.toLowerCase()) ||
          (e.reference||'').toLowerCase().includes(filters.search.toLowerCase())
        ) &&
        (filters.year === 'all' || (e.archivedDate||'').startsWith(filters.year))
      )
      .sort((a,b) => new Date(b.archivedDate||0) - new Date(a.archivedDate||0)),
    [archiveLog, filters])

  const availableYears = useMemo(() =>
    [...new Set(archiveLog.map(e => (e.archivedDate||e.date||'').substring(0,4)).filter(Boolean))].sort().reverse(),
    [archiveLog])

  const handleRestore = (entry) => {
    const daysSince = Math.floor((new Date() - new Date(entry.archivedDate)) / (1000*60*60*24))
    if (daysSince > 7) {
      showNotification(`Restauration impossible : archivée depuis ${daysSince} jours (max 7 jours)`, 'error')
      return
    }
    const archives = getArchivedInvoices().filter(a => a.id !== entry.id)
    saveArchivedInvoices(archives)
    setArchiveLog(archives)
    showNotification(`Facture ${entry.invoiceId} restaurée`, 'success')
  }

  return (
    <div className="archive-content">
      {notification.show && <div className={`notification ${notification.type}`}>{notification.message}</div>}

      <div className="archive-header">
        <h2>🗄️ Archive comptable</h2>
      </div>

      <div className="archive-filters">
        <div className="search-box large">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par facture, client ou référence..."
            className="search-input"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <select
          className="archive-year-filter"
          value={filters.year}
          onChange={e => setFilters(f => ({ ...f, year: e.target.value }))}
        >
          <option value="all">Toutes les années</option>
          {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      <div className="archive-log">
        <h3>Journal des archives ({filteredArchiveLog.length})</h3>
        <table className="archive-table">
          <thead>
            <tr>
              <th>Référence</th><th>Facture</th><th>Date archivage</th><th>Client</th>
              <th>Montant</th><th>Motif</th><th>Archivé par</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredArchiveLog.map(e => {
              const daysSince = Math.floor((new Date() - new Date(e.archivedDate)) / (1000*60*60*24))
              const canRestore = daysSince <= 7
              return (
                <tr key={e.id}>
                  <td><span className="archive-ref">{e.reference}</span></td>
                  <td>{e.invoiceId}</td>
                  <td>{utils.formatDate(e.archivedDate)}</td>
                  <td>{e.client || '-'}</td>
                  <td>{utils.formatCurrency(e.amount||0)}</td>
                  <td>{e.reason}</td>
                  <td>{e.archivedBy}</td>
                  <td>
                    {canRestore
                      ? <button className="btn-icon" onClick={() => handleRestore(e)} title="Restaurer (encore possible)">↩️</button>
                      : <span style={{color:'#6b7280',fontSize:'0.8rem'}}>Verrouillé ({daysSince}j)</span>
                    }
                  </td>
                </tr>
              )
            })}
            {filteredArchiveLog.length === 0 && (
              <tr><td colSpan="8" style={{textAlign:'center',padding:'2rem',color:'#9ca3af'}}>Aucune archive trouvée</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
