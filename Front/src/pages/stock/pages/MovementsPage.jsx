import { useState, useEffect, useMemo, useCallback } from 'react'
import stockMovementService from '../../../services/stockMovementService'
import productService from '../../../services/productService'
import supplierService from '../../../services/supplierService'
import {
  extractApiErrorMessage,
  mapMovementToUi,
  mapProductToUi,
  mapSupplierToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'
import Modal from '../../../components/common/Modal'
import FormField from '../../../components/common/FormField'

const MV = { IN: "entrée", OUT: "sortie" }

function MovementsPage() {
  // Data
  const [mov, setMov] = useState([])
  const [prod, setProd] = useState([])
  const [supp, setSupp] = useState([])

  // Filters
  const [f, setF] = useState({ movement: "all", date: "", searchProduct: "", startDate: "", endDate: "" })
  const [sdp, setSdp] = useState(false)

  // Modal / form
  const [mod, setMod] = useState(false)
  const [mf, setMf] = useState({ productId: "", product: "", type: MV.IN, quantity: "", date: new Date().toISOString().split('T')[0], note: "" })
  const [fe, setFe] = useState({})

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [movementRes, productRes, supplierRes] = await Promise.all([
        stockMovementService.getAll({ limit: 200 }),
        productService.getAll({ limit: 200 }),
        supplierService.getAll({ limit: 200 }),
      ])
      setMov(pickList(movementRes, ['movements', 'data']).map(mapMovementToUi))
      setProd(pickList(productRes, ['products', 'data']).map(mapProductToUi))
      setSupp(pickList(supplierRes, ['suppliers', 'data']).map(mapSupplierToUi))
    } catch (error) {
      console.error('MovementsPage load error:', error)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Filtered movements
  const fm = useMemo(() => mov.filter(m =>
    (f.movement === 'all' || m.type === f.movement) &&
    (!f.date || m.date === f.date) &&
    (!f.startDate || m.date >= f.startDate) &&
    (!f.endDate || m.date <= f.endDate) &&
    (!f.searchProduct || m.product.toLowerCase().includes(f.searchProduct.toLowerCase()))
  ), [mov, f])

  const updateFilter = (k, v) => setF(prev => ({ ...prev, [k]: v }))
  const clearFilters = useCallback(() => setF({ movement: "all", date: "", searchProduct: "", startDate: "", endDate: "" }), [])

  // Validation
  const vMv = useCallback(() => {
    const e = {}
    if (!mf.productId) e.productId = "Produit requis"
    if (!mf.quantity || parseInt(mf.quantity) <= 0) e.quantity = "Quantité >0"
    if (mf.type === MV.OUT && mf.productId) {
      const p = prod.find(p => String(p.id) === String(mf.productId))
      if (p && parseInt(mf.quantity) > p.stock) e.quantity = `Stock insuffisant (${p.stock})`
    }
    return e
  }, [mf, prod])

  // Reset
  const rMv = useCallback(() => {
    setMf({ productId: "", product: "", type: MV.IN, quantity: "", date: new Date().toISOString().split('T')[0], note: "" })
    setFe({})
  }, [])

  // Product change handler
  const hdlProdChange = useCallback(e => {
    const id = e.target.value
    const p = prod.find(p => String(p.id) === String(id))
    if (p) setMf(prev => ({ ...prev, productId: id, product: p.name }))
  }, [prod])

  // CRUD Remote
  const hdlAddMvRemote = async () => {
    const e = vMv(); if (Object.keys(e).length) return setFe(e)
    try {
      if (mf.type === MV.IN) await stockMovementService.addEntry({ productId: mf.productId, quantity: mf.quantity, note: mf.note })
      else await stockMovementService.addExit({ productId: mf.productId, quantity: mf.quantity, note: mf.note })
      await loadData()
      rMv(); setMod(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible d'ajouter le mouvement"))
    }
  }

  const hdlDelMvRemote = async (id) => {
    if (!window.confirm("Supprimer ?")) return
    try {
      await stockMovementService.delete(id)
      await loadData()
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de supprimer le mouvement"))
    }
  }

  return (
    <div className="movements-tab">
      <header className="tab-header">
        <h2>🔄 Mouvements</h2>
        <div className="header-buttons">
          <button className="btn-secondary" onClick={clearFilters}>🧹 Effacer</button>
          <button className="btn-primary" onClick={() => { rMv(); setMod(true) }}>+ Nouveau</button>
        </div>
      </header>

      <div className="movements-search-bar">
        <div className="search-row">
          <FormField label="Rechercher" id="search-mvmt"><input type="text" placeholder="Produit..." value={f.searchProduct} onChange={e => updateFilter('searchProduct', e.target.value)} className="search-input" /></FormField>
          <FormField label="Date" id="search-date"><input type="date" value={f.date} onChange={e => updateFilter('date', e.target.value)} className="search-input" /></FormField>
          <button className="btn-toggle-date" onClick={() => setSdp(!sdp)}>{sdp ? "Masquer" : "Afficher"} plage</button>
        </div>
        {sdp && <div className="date-range-picker">
          <FormField label="Début" id="start"><input type="date" value={f.startDate} onChange={e => updateFilter('startDate', e.target.value)} className="search-input" /></FormField>
          <FormField label="Fin" id="end"><input type="date" value={f.endDate} onChange={e => updateFilter('endDate', e.target.value)} className="search-input" /></FormField>
        </div>}
      </div>

      <div className="movements-filters">
        {[
          { value: 'all', label: 'Tous', count: fm.length },
          { value: MV.IN, label: 'Entrées', count: fm.filter(m => m.type === MV.IN).length },
          { value: MV.OUT, label: 'Sorties', count: fm.filter(m => m.type === MV.OUT).length }
        ].map(fil => <button key={fil.value} className={`filter-btn ${f.movement === fil.value ? 'active' : ''}`} onClick={() => updateFilter('movement', fil.value)}>{fil.label} ({fil.count})</button>)}
      </div>

      <div className="movements-table-container">
        <table className="movements-table">
          <thead><tr><th>Date</th><th>Produit</th><th>Fournisseur</th><th>Type</th><th>Qté</th><th>Note</th><th>Utilisateur</th><th>Actions</th></tr></thead>
          <tbody>{fm.length ? fm.map(m => {
            const product = prod.find(p => p.id === m.productId)
            const supplier = product ? supp.find(s => s.id === product.supplierId) : null
            return <tr key={m.id}>
              <td><time dateTime={m.date}>{new Date(m.date).toLocaleDateString('fr-FR')}</time></td>
              <td className="product-name">{m.product}</td>
              <td>{supplier?.name || '-'}</td>
              <td><span className={`movement-type ${m.type}`} style={{ background: m.type === MV.IN ? "#c6f6d5" : "#fed7d7", color: m.type === MV.IN ? "#22543d" : "#742a2a" }}>{m.type === MV.IN ? "⬆️ Entrée" : "⬇️ Sortie"}</span></td>
              <td className={m.type === MV.IN ? "text-success" : "text-danger"}><strong>{m.quantity}</strong></td>
              <td className="movement-note">{m.note || "-"}</td>
              <td>{m.user}</td>
              <td><button className="btn-icon" onClick={() => hdlDelMvRemote(m.id)}>🗑️</button></td>
            </tr>
          }) : <tr><td colSpan="8" className="no-data-row"><div className="no-data-message">Aucun mouvement</div></td></tr>}</tbody>
        </table>
      </div>

      {/* Movement Modal */}
      <Modal isOpen={mod} onClose={() => { setMod(false); rMv() }} title="➕ Nouveau mouvement" onConfirm={hdlAddMvRemote} confirmText="Ajouter">
        <FormField label="Produit" id="mvmt-prod" error={fe.productId}><select value={mf.productId} onChange={hdlProdChange}><option value="">Sélectionner</option>{prod.map(p => <option key={p.id} value={p.id}>{p.name} ({p.stock}) - {supp.find(s => s.id === p.supplierId)?.name}</option>)}</select></FormField>
        <div className="form-row">
          <FormField label="Type" id="mvmt-type"><select value={mf.type} onChange={e => setMf({ ...mf, type: e.target.value })}><option value={MV.IN}>⬆️ Entrée</option><option value={MV.OUT}>⬇️ Sortie</option></select></FormField>
          <FormField label="Quantité" id="mvmt-qty" error={fe.quantity}><input type="number" min="1" value={mf.quantity} onChange={e => setMf({ ...mf, quantity: e.target.value })} /></FormField>
        </div>
        <FormField label="Date" id="mvmt-date"><input type="date" value={mf.date} onChange={e => setMf({ ...mf, date: e.target.value })} /></FormField>
        <FormField label="Note" id="mvmt-note"><textarea value={mf.note} onChange={e => setMf({ ...mf, note: e.target.value })} rows="2" /></FormField>
        {mf.productId && mf.type === MV.OUT && <div className="stock-warning">⚠️ Stock: {prod.find(p => String(p.id) === String(mf.productId))?.stock}</div>}
      </Modal>
    </div>
  )
}

export default MovementsPage
