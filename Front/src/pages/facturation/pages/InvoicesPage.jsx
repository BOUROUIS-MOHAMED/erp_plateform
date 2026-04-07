// src/pages/facturation/pages/InvoicesPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { invoiceService } from '../../../services/invoiceService'
import {
  extractApiErrorMessage,
  mapInvoiceToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

// ===== CONSTANTS =====
const C = {
  STATUS: { 'payée':'#10b981','en attente':'#f59e0b','envoyée':'#3b82f6',brouillon:'#6b7280','en retard':'#ef4444','archivée':'#6b7280' },
  STATUS_BG: { 'payée':'#d1fae5','en attente':'#fef3c7','envoyée':'#dbeafe',brouillon:'#f3f4f6','en retard':'#fee2e2','archivée':'#e5e7eb' },
}

const ARCHIVE_LS_KEY = 'erp_facturation_archives'
const getArchivedInvoices = () => { try { return JSON.parse(localStorage.getItem(ARCHIVE_LS_KEY)||'[]') } catch { return [] } }
const saveArchivedInvoices = (a) => localStorage.setItem(ARCHIVE_LS_KEY, JSON.stringify(a))

const utils = {
  formatCurrency: a => (a||0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}),
  formatDate: d => d ? new Date(d).toLocaleDateString('fr-FR') : '',
  generateArchiveRef: () => `ARCH-${new Date().getFullYear()}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`,
  calculateRetentionDate: (date,years=10) => { const d=new Date(date); d.setFullYear(d.getFullYear()+years); return d.toISOString().split('T')[0]; },
}

const StatusBadge = ({status}) => (
  <span className="status-badge" style={{background:C.STATUS_BG[status]||'#f3f4f6',color:C.STATUS[status]||'#6b7280'}}>{status}</span>
)

const useNotification = () => {
  const [n,setN] = useState({show:false,message:'',type:''})
  const show = useCallback((m,t)=>{setN({show:true,message:m,type:t});setTimeout(()=>setN({show:false,message:'',type:''}),3000)},[])
  return {notification:n, showNotification:show}
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([])
  const [archiveLog, setArchiveLog] = useState(() => getArchivedInvoices())
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [archiveModal, setArchiveModal] = useState({ show: false, invoice: null })
  const { notification, showNotification } = useNotification()

  const loadData = useCallback(async () => {
    try {
      const res = await invoiceService.getAll({ limit: 200 })
      setInvoices(pickList(res, ['data']).map(mapInvoiceToUi))
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de charger les factures'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  useEffect(() => { loadData() }, [loadData])

  const archivedInvoiceIds = useMemo(() => new Set(archiveLog.map(a => a.invoiceId)), [archiveLog])

  const filteredInvoices = useMemo(() =>
    invoices
      .filter(i =>
        !archivedInvoiceIds.has(i.id) &&
        (!search ||
          i.id.toLowerCase().includes(search.toLowerCase()) ||
          i.client.toLowerCase().includes(search.toLowerCase()) ||
          (i.orderId||'').toLowerCase().includes(search.toLowerCase()))
      )
      .sort((a,b) => new Date(b.date) - new Date(a.date)),
    [invoices, search, archivedInvoiceIds])

  const handleMarkAsPaid = async (invoice) => {
    try {
      await invoiceService.markAsPaid(invoice.backendId || invoice.id, {
        paymentMethod: 'virement',
        amount: Number(invoice.amount) || 0,
        reference: `UI-${invoice.id}`,
      })
      await loadData()
      showNotification('Facture marquée payée', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de marquer la facture comme payée'), 'error')
    }
  }

  const handleArchive = async (invoice) => {
    const archives = getArchivedInvoices()
    const entry = {
      id: Date.now(),
      invoiceId: invoice.id,
      backendId: invoice.backendId,
      client: invoice.client,
      amount: invoice.amount,
      date: invoice.date,
      archivedDate: new Date().toISOString(),
      archivedBy: 'admin_facture',
      reason: 'Archivage manuel',
      reference: utils.generateArchiveRef(),
    }
    archives.unshift(entry)
    saveArchivedInvoices(archives)
    setArchiveLog(archives)
    await loadData()
    showNotification(`Facture ${invoice.id} archivée`, 'success')
  }

  const handleRestore = async (entry) => {
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

  const handleDownload = async (invoice) => {
    try {
      await invoiceService.downloadPdf(invoice.backendId || invoice.id)
      showNotification('Facture téléchargée', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de télécharger la facture'), 'error')
    }
  }

  if (loading) return <div style={{padding:'2rem',textAlign:'center'}}>Chargement...</div>

  return (
    <div className="invoices-content">
      {notification.show && <div className={`notification ${notification.type}`}>{notification.message}</div>}

      <div className="content-header">
        <div className="header-left">
          <h2>📄 Factures</h2>
          <span className="header-count">{filteredInvoices.length}</span>
        </div>
      </div>

      <div className="search-section">
        <div className="search-box large">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par N° facture, client ou commande..."
            className="search-input"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>N°</th><th>Date</th><th>Commande</th><th>Client</th><th>Montant</th>
              <th>Statut</th><th>Échéance</th><th>Archive</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map(i => (
              <tr key={i.id} className={i.archived ? 'archived-row' : ''}>
                <td className="invoice-number">{i.id}</td>
                <td>{utils.formatDate(i.date)}</td>
                <td className="order-id">{i.orderId}</td>
                <td className="client-name">{i.client}</td>
                <td className="amount">{utils.formatCurrency(i.amount)}</td>
                <td><StatusBadge status={i.status}/></td>
                <td className={new Date(i.dueDate)<new Date()&&i.status!=='payée'&&i.status!=='archivée' ? 'text-danger' : ''}>
                  {utils.formatDate(i.dueDate)}
                  {i.archived && i.retentionDate && <small className="retention-info">(Conservée jusqu'au {utils.formatDate(i.retentionDate)})</small>}
                </td>
                <td>
                  {i.archived
                    ? <span className="archived-badge" title={`Réf: ${i.archiveRef}`}>📦 Archivée{i.archiveRef&&<small>{i.archiveRef}</small>}</span>
                    : i.status==='payée' && <button className="btn-small btn-archive" onClick={()=>setArchiveModal({show:true,invoice:i})} title="Archiver">📦 Archiver</button>
                  }
                </td>
                <td>
                  <div className="action-buttons">
                    {i.archived
                      ? <button className="action-btn" onClick={()=>handleRestore(i)} title="Restaurer">↩️</button>
                      : i.status!=='payée' && <button className="action-btn success" onClick={()=>handleMarkAsPaid(i)} title="Marquer payée">💰</button>
                    }
                    <button className="action-btn" title="Télécharger" onClick={()=>handleDownload(i)}>📥</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {archiveModal.show && archiveModal.invoice && (
        <div className="modal-overlay" onClick={()=>setArchiveModal({show:false,invoice:null})}>
          <div className="modal-content" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>📦 Archiver la facture</h3>
              <button className="modal-close" onClick={()=>setArchiveModal({show:false,invoice:null})}>×</button>
            </div>
            <div className="modal-body">
              <p>Vous êtes sur le point d'archiver :</p>
              <div className="archive-invoice-info">
                <p><strong>Facture:</strong> {archiveModal.invoice.id}</p>
                <p><strong>Client:</strong> {archiveModal.invoice.client}</p>
                <p><strong>Montant:</strong> {utils.formatCurrency(archiveModal.invoice.amount)}</p>
                <p><strong>Date:</strong> {utils.formatDate(archiveModal.invoice.date)}</p>
              </div>
              <p className="archive-warning">⚠️ Vous pourrez restaurer cette facture pendant 7 jours après l'archivage.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setArchiveModal({show:false,invoice:null})}>Annuler</button>
              <button className="btn-primary" onClick={()=>{handleArchive(archiveModal.invoice,'Archivage manuel');setArchiveModal({show:false,invoice:null})}}>Archiver</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
