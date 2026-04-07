// src/pages/facturation/pages/OrdersPage.jsx
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { orderService } from '../../../services/orderService'
import { clientService } from '../../../services/clientService'
import { invoiceService } from '../../../services/invoiceService'
import productService from '../../../services/productService'
import {
  buildCustomerPayload,
  extractApiErrorMessage,
  mapOrderToUi,
  mapInvoiceToUi,
  mapProductToUi,
  mapCustomerToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

// ===== CONSTANTS =====
const C = {
  ORDER_STATUSES: ['en attente','confirmée','en préparation','expédiée','livrée'],
  PAYMENT_STATUSES: ['non payée','en attente','payée'],
  STATUS: { 'payée':'#10b981','en attente':'#f59e0b','envoyée':'#3b82f6',brouillon:'#6b7280','en retard':'#ef4444','livrée':'#10b981','expédiée':'#3b82f6','en préparation':'#8b5cf6','confirmée':'#8b5cf6','non payée':'#ef4444',actif:'#10b981',inactif:'#6b7280','archivée':'#6b7280' },
  STATUS_BG: { 'payée':'#d1fae5','en attente':'#fef3c7','envoyée':'#dbeafe',brouillon:'#f3f4f6','en retard':'#fee2e2','livrée':'#d1fae5','expédiée':'#dbeafe','en préparation':'#ede9fe','confirmée':'#ede9fe','non payée':'#fee2e2',actif:'#d1fae5',inactif:'#f3f4f6','archivée':'#e5e7eb' },
}

const utils = {
  formatCurrency: a => (a || 0).toLocaleString('fr-FR',{style:'currency',currency:'EUR'}),
  formatDate: d => d ? new Date(d).toLocaleDateString('fr-FR') : '',
  generateId: (p, items) => `${p}-${String(Math.max(...items.map(i=>+i.id.split('-').pop()||0),0)+1).padStart(3,'0')}`,
}

const StatusBadge = ({status}) => (
  <span className="status-badge" style={{background:C.STATUS_BG[status]||'#f3f4f6',color:C.STATUS[status]||'#6b7280'}}>{status}</span>
)

const useNotification = () => {
  const [n,setN] = useState({show:false,message:'',type:''})
  const show = useCallback((m,t)=>{setN({show:true,message:m,type:t});setTimeout(()=>setN({show:false,message:'',type:''}),3000)},[])
  return {notification:n, showNotification:show}
}

export default function OrdersPage() {
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({ date: { start: '', end: '' }, search: initialSearch })
  const [modal, setModal] = useState(false)
  const [edit, setEdit] = useState({ type: null, data: null })
  const [oForm, setOForm] = useState({ client: '', items: [{product:'',quantity:1,unitPrice:0}], status: 'en attente', paymentStatus: 'non payée', expectedDate: '', notes: '' })
  const { notification, showNotification } = useNotification()

  const loadData = useCallback(async () => {
    try {
      const [ordersRes, clientsRes, invoicesRes, productsRes] = await Promise.all([
        orderService.getAll({ limit: 200 }),
        clientService.getAll({ limit: 200 }),
        invoiceService.getAll({ limit: 200 }),
        productService.getAll({ limit: 200 }),
      ])
      const invoiceItems = pickList(invoicesRes, ['data']).map(mapInvoiceToUi)
      const invoiceByOrderId = new Map(invoiceItems.filter(inv => inv.orderId).map(inv => [inv.orderId, inv]))
      setOrders(pickList(ordersRes, ['data']).map(o => mapOrderToUi(o, invoiceByOrderId)))
      setClients(pickList(clientsRes, ['data']).map(mapCustomerToUi))
      setProducts(pickList(productsRes, ['products','data']).map(mapProductToUi))
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de charger les commandes'), 'error')
    } finally {
      setLoading(false)
    }
  }, [showNotification])

  useEffect(() => { loadData() }, [loadData])

  // Apply ?search param on mount if present
  useEffect(() => {
    if (initialSearch) {
      setFilters(f => ({ ...f, search: initialSearch }))
    }
  }, [initialSearch])

  const filteredOrders = useMemo(() =>
    orders.filter(o =>
      (!filters.date.start || o.date >= filters.date.start) &&
      (!filters.date.end   || o.date <= filters.date.end) &&
      (!filters.search || o.id.toLowerCase().includes(filters.search.toLowerCase()) || o.client.toLowerCase().includes(filters.search.toLowerCase()))
    ), [orders, filters])

  const openModal = (item = null) => {
    if (item) {
      setEdit({ type: 'order', data: item })
      setOForm({
        client: item.customerId || item.client,
        items: item.backend?.items?.map(i => ({ product: typeof i.product === 'object' ? i.product._id : i.product, quantity: i.quantity, unitPrice: i.unitPrice })) || [{product:'',quantity:1,unitPrice:0}],
        status: item.status,
        paymentStatus: item.paymentStatus,
        expectedDate: item.backend?.expectedDate ? item.backend.expectedDate.split('T')[0] : '',
        notes: item.backend?.notes || '',
      })
    }
    setModal(true)
  }

  const closeModal = () => {
    setModal(false)
    setEdit({ type: null, data: null })
    setOForm({ client: '', items: [{product:'',quantity:1,unitPrice:0}], status: 'en attente', paymentStatus: 'non payée', expectedDate: '', notes: '' })
  }

  const handleAdd = async () => {
    if (!oForm.client || oForm.items.some(i => !i.product)) {
      showNotification('Veuillez sélectionner un client et au moins un produit', 'error')
      return
    }
    try {
      await orderService.create({
        type: 'vente',
        customer: oForm.client,
        items: oForm.items.map(i => ({ product: i.product, quantity: parseInt(i.quantity)||1, unitPrice: parseFloat(i.unitPrice)||0 })),
        expectedDate: oForm.expectedDate || null,
        notes: oForm.notes || '',
      })
      await loadData()
      closeModal()
      showNotification('Commande créée avec succès', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de créer la commande'), 'error')
    }
  }

  const handleUpdate = async () => {
    if (!oForm.client || oForm.items.some(i => !i.product) || !edit.data?.id) {
      showNotification('Veuillez sélectionner un client et au moins un produit', 'error')
      return
    }
    try {
      await orderService.update(edit.data.backendId || edit.data.id, {
        expectedDate: oForm.expectedDate || null,
        notes: oForm.notes || '',
        items: oForm.items.map(i => ({ product: i.product, quantity: parseInt(i.quantity)||1, unitPrice: parseFloat(i.unitPrice)||0 })),
      })
      await loadData()
      closeModal()
      showNotification('Commande modifiée avec succès', 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de modifier la commande'), 'error')
    }
  }

  const handleDelete = async (order) => {
    if (!order || !window.confirm('Supprimer cette commande ?')) return
    try {
      await orderService.delete(order.backendId || order.id)
      await loadData()
      showNotification('Commande supprimée', 'warning')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de supprimer la commande'), 'error')
    }
  }

  const handleGenerateInvoice = async (order) => {
    if (!order?.customerId) {
      showNotification('Impossible de générer : client introuvable sur cette commande', 'error')
      return
    }
    const backendItems = order?.backend?.items
    if (!Array.isArray(backendItems) || backendItems.length === 0) {
      showNotification('Impossible de générer : la commande ne contient aucun article', 'error')
      return
    }
    try {
      const dueDate = new Date(Date.now() + 30*24*60*60*1000).toISOString()
      const items = backendItems.map(item => ({
        product: item.product?._id || item.product,
        description: item.description || item.product?.name || 'Article',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 20,
        discount: item.discount || 0,
      }))
      await invoiceService.create({
        customer: order.customerId,
        items,
        dueDate,
        orderId: order.id,
        notes: `Facture générée depuis la commande ${order.id}`,
      })
      await loadData()
      showNotification(`Facture créée pour la commande ${order.id}`, 'success')
    } catch (err) {
      showNotification(extractApiErrorMessage(err, 'Impossible de générer la facture'), 'error')
    }
  }

  if (loading) return <div style={{padding:'2rem',textAlign:'center'}}>Chargement...</div>

  return (
    <div className="orders-content">
      {notification.show && <div className={`notification ${notification.type}`}>{notification.message}</div>}

      <div className="content-header">
        <div className="header-left">
          <h2>📋 Commandes</h2>
          <span className="header-count">{filteredOrders.length}</span>
        </div>
        <button className="btn-primary" onClick={() => openModal()}>+ Nouvelle commande</button>
      </div>

      <div className="filters-bar">
        <div className="search-box large">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher par N° commande ou client..."
            className="search-input"
            value={filters.search}
            onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
          />
        </div>
        <div className="filter-group">
          <div className="date-filter">
            <input type="date" value={filters.date.start} onChange={e => setFilters(f => ({ ...f, date: { ...f.date, start: e.target.value } }))} />
            <span>à</span>
            <input type="date" value={filters.date.end} onChange={e => setFilters(f => ({ ...f, date: { ...f.date, end: e.target.value } }))} />
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>N°</th><th>Date</th><th>Client</th><th>Art.</th><th>Total</th>
              <th>Statut</th><th>Paiement</th><th>Facture</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map(o => (
              <tr key={o.id}>
                <td className="order-number">{o.id}</td>
                <td>{utils.formatDate(o.date)}</td>
                <td className="client-name">{o.client}</td>
                <td>{o.items}</td>
                <td className="amount">{utils.formatCurrency(o.total)}</td>
                <td><StatusBadge status={o.status}/></td>
                <td><StatusBadge status={o.paymentStatus}/></td>
                <td>
                  {o.invoiceId
                    ? <span className="invoice-linked">✅ {o.invoiceId}</span>
                    : <button className="btn-small btn-warning" onClick={() => handleGenerateInvoice(o)}>Générer</button>
                  }
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn" onClick={() => openModal(o)}>✏️</button>
                    <button className="action-btn" onClick={() => handleDelete(o)}>🗑️</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{edit.type === 'order' ? '✏️ Modifier' : '➕ Nouvelle'} commande</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body" style={{maxHeight:'65vh',overflowY:'auto'}}>
              <div className="form-group">
                <label>Client *</label>
                {edit.type === 'order' ? (
                  <input type="text" value={clients.find(c=>String(c.id)===String(oForm.client))?.name || (typeof oForm.client==='string' ? oForm.client : 'Client...')} disabled />
                ) : (
                  <select value={oForm.client} onChange={e => setOForm({...oForm, client: e.target.value})}>
                    <option value="">Sélectionner un client</option>
                    {clients.filter(c=>c.status==='actif').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                )}
              </div>
              <div className="form-group">
                <label>Articles *</label>
                <div style={{border:'1px solid #e5e7eb',borderRadius:'0.5rem',overflow:'hidden'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.9rem'}}>
                    <thead>
                      <tr style={{background:'#f9fafb'}}>
                        <th style={{padding:'10px 12px',textAlign:'left',fontWeight:600,fontSize:'0.8rem',color:'#6b7280'}}>Produit</th>
                        <th style={{padding:'10px 12px',textAlign:'center',fontWeight:600,fontSize:'0.8rem',color:'#6b7280',width:'80px'}}>Qté</th>
                        <th style={{padding:'10px 12px',textAlign:'center',fontWeight:600,fontSize:'0.8rem',color:'#6b7280',width:'110px'}}>Prix U.</th>
                        <th style={{padding:'10px 12px',textAlign:'right',fontWeight:600,fontSize:'0.8rem',color:'#6b7280',width:'100px'}}>Sous-total</th>
                        <th style={{width:'40px'}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {oForm.items.map((item,idx) => (
                        <tr key={idx} style={{borderTop:'1px solid #e5e7eb'}}>
                          <td style={{padding:'8px 12px'}}>
                            <select value={item.product} onChange={e=>{const prod=products.find(p=>String(p.id)===e.target.value);const ni=[...oForm.items];ni[idx]={...ni[idx],product:e.target.value,unitPrice:prod?prod.price:item.unitPrice};setOForm({...oForm,items:ni})}} style={{width:'100%',padding:'8px',border:'1px solid #e5e7eb',borderRadius:'0.5rem',fontSize:'0.85rem'}}>
                              <option value="">Choisir...</option>
                              {products.filter(p=>p.status!=='inactif').map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock})</option>)}
                            </select>
                          </td>
                          <td style={{padding:'8px 6px',textAlign:'center'}}>
                            <input type="number" min="1" value={item.quantity} onChange={e=>{const ni=[...oForm.items];ni[idx].quantity=e.target.value;setOForm({...oForm,items:ni})}} style={{width:'100%',padding:'8px',border:'1px solid #e5e7eb',borderRadius:'0.5rem',textAlign:'center',fontSize:'0.85rem'}}/>
                          </td>
                          <td style={{padding:'8px 6px',textAlign:'center'}}>
                            <input type="number" step="0.01" value={item.unitPrice} onChange={e=>{const ni=[...oForm.items];ni[idx].unitPrice=e.target.value;setOForm({...oForm,items:ni})}} style={{width:'100%',padding:'8px',border:'1px solid #e5e7eb',borderRadius:'0.5rem',textAlign:'right',fontSize:'0.85rem'}}/>
                          </td>
                          <td style={{padding:'8px 12px',textAlign:'right',fontWeight:600,fontSize:'0.85rem'}}>
                            {utils.formatCurrency((parseFloat(item.quantity)||0)*(parseFloat(item.unitPrice)||0))}
                          </td>
                          <td style={{padding:'8px 6px',textAlign:'center'}}>
                            {oForm.items.length>1 && <button onClick={e=>{e.preventDefault();setOForm({...oForm,items:oForm.items.filter((_,i)=>i!==idx)})}} style={{background:'none',border:'none',cursor:'pointer',color:'#ef4444',fontSize:'1rem',padding:'4px'}}>🗑️</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{padding:'10px 12px',borderTop:'1px solid #e5e7eb',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <button className="btn-outline" onClick={e=>{e.preventDefault();setOForm({...oForm,items:[...oForm.items,{product:'',quantity:1,unitPrice:0}]})}} style={{fontSize:'0.8rem',padding:'6px 12px'}}>+ Ajouter un produit</button>
                    <div style={{fontWeight:700,fontSize:'1rem'}}>Total TTC : <span style={{color:'#10b981'}}>{utils.formatCurrency(oForm.items.reduce((s,i)=>s+((parseFloat(i.quantity)||0)*(parseFloat(i.unitPrice)||0)),0)*1.2)}</span></div>
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Date prévue</label>
                  <input type="date" value={oForm.expectedDate} onChange={e=>setOForm({...oForm,expectedDate:e.target.value})}/>
                </div>
                <div className="form-group">
                  <label>Statut</label>
                  <select value={oForm.status} onChange={e=>setOForm({...oForm,status:e.target.value})}>
                    {C.ORDER_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea rows="2" value={oForm.notes} onChange={e=>setOForm({...oForm,notes:e.target.value})} placeholder="Instructions spéciales..."></textarea>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-primary" onClick={edit.type==='order' ? handleUpdate : handleAdd}>{edit.type==='order' ? 'Modifier' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
