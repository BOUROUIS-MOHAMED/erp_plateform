import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import productService from '../../../services/productService'
import categoryService from '../../../services/categoryService'
import supplierService from '../../../services/supplierService'
import {
  extractApiErrorMessage,
  mapProductToUi,
  mapCategoryToUi,
  mapSupplierToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'
import Modal from '../../../components/common/Modal'
import StatusBadge from '../../../components/common/StatusBadge'
import FormField from '../../../components/common/FormField'

const STATUS = { IN_STOCK: "en stock", LOW_STOCK: "stock faible", OUT_OF_STOCK: "rupture" }

function ProductsPage() {
  const [searchParams] = useSearchParams()

  // Data
  const [prod, setProd] = useState([])
  const [cat, setCat] = useState([])
  const [supp, setSupp] = useState([])

  // Filters
  const [f, setF] = useState({ productName: "", productCategory: "", productStatus: "" })
  const [spf, setSpf] = useState(false)

  // Modal / form
  const [mod, setMod] = useState(false)
  const [ep, setEp] = useState(null)
  const [pf, setPf] = useState({ name: "", sku: "", category: "", stock: "", price: "", status: STATUS.IN_STOCK, supplierId: "" })
  const [fe, setFe] = useState({})

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [productRes, categoryRes, supplierRes] = await Promise.all([
        productService.getAll({ limit: 200 }),
        categoryService.getAll({ limit: 200 }),
        supplierService.getAll({ limit: 200 }),
      ])
      setProd(pickList(productRes, ['products', 'data']).map(mapProductToUi))
      setCat(pickList(categoryRes, ['categories', 'data']).map(mapCategoryToUi))
      setSupp(pickList(supplierRes, ['suppliers', 'data']).map(mapSupplierToUi))
    } catch (error) {
      console.error('ProductsPage load error:', error)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Cross-page URL filter: read ?category and ?supplier on mount
  useEffect(() => {
    const catParam = searchParams.get('category')
    const supParam = searchParams.get('supplier')
    if (catParam) setF(prev => ({ ...prev, productCategory: catParam }))
    if (supParam) setF(prev => ({ ...prev, supplierId: supParam }))
    if (catParam || supParam) setSpf(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Filtered products
  const fp = useMemo(() => prod.filter(p =>
    (!f.productName || p.name.toLowerCase().includes(f.productName.toLowerCase())) &&
    (!f.productCategory || p.category === f.productCategory) &&
    (!f.productStatus || p.status === f.productStatus) &&
    (!f.supplierId || String(p.supplierId) === String(f.supplierId))
  ), [prod, f])

  const updateFilter = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  // Validation
  const vProd = useCallback(() => {
    const e = {}
    if (!pf.name.trim()) e.name = "Nom requis"; else if (pf.name.length > 100) e.name = "Max 100"
    if (!pf.sku.trim()) e.sku = "Clé unique requise (ex: CA-145)"
    if (!pf.category) e.category = "Catégorie requise"
    if (!pf.supplierId) e.supplierId = "Fournisseur requis"
    if (pf.stock && parseInt(pf.stock) < 0) e.stock = "Stock positif"
    if (pf.price && parseInt(pf.price) < 0) e.price = "Prix positif"
    return e
  }, [pf])

  // Reset
  const rProd = useCallback(() => {
    setPf({ name: "", sku: "", category: "", stock: "", price: "", status: STATUS.IN_STOCK, supplierId: "" })
    setEp(null)
    setFe({})
  }, [])

  // Edit handler
  const hdlEditProd = (p) => {
    setEp(p)
    setPf({ name: p.name, sku: p.code, category: p.category, stock: p.stock.toString(), price: p.price.toString(), status: p.status, supplierId: p.supplierId })
    setMod(true)
  }

  // CRUD Remote
  const hdlAddProdRemote = async () => {
    const e = vProd(); if (Object.keys(e).length) return setFe(e)
    try {
      await productService.create({ name: pf.name, sku: pf.sku, category: pf.category, stock: pf.stock, price: pf.price, supplierId: pf.supplierId })
      await loadData()
      rProd(); setMod(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible d'ajouter le produit"))
    }
  }

  const hdlUpdProdRemote = async () => {
    const e = vProd(); if (Object.keys(e).length) return setFe(e)
    try {
      await productService.update(ep.id, { name: pf.name, sku: pf.sku, category: pf.category, stock: pf.stock, price: pf.price, supplierId: pf.supplierId })
      await loadData()
      rProd(); setMod(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de modifier le produit"))
    }
  }

  const hdlDelProdRemote = async (id) => {
    if (!window.confirm("Supprimer ?")) return
    try {
      await productService.delete(id)
      await loadData()
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de supprimer le produit"))
    }
  }

  return (
    <div className="products-tab">
      <header className="tab-header">
        <h2>📦 Produits</h2>
        <div className="header-buttons">
          <button className="btn-toggle-filters" onClick={() => setSpf(!spf)}>{spf ? "Masquer" : "Afficher"} filtres 🔍</button>
          <button className="btn-primary" onClick={() => { rProd(); setMod(true) }}>+ Nouveau produit</button>
        </div>
      </header>

      {spf && <div className="products-search-bar">
        <div className="search-row">
          <FormField label="🔍 Nom" id="search-name"><input type="text" placeholder="Nom..." value={f.productName} onChange={e => updateFilter('productName', e.target.value)} className="search-input" /></FormField>
          <FormField label="📂 Catégorie" id="search-cat"><select value={f.productCategory} onChange={e => updateFilter('productCategory', e.target.value)} className="search-input"><option value="">Toutes</option>{cat.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></FormField>
          <FormField label="📊 Statut" id="search-status"><select value={f.productStatus} onChange={e => updateFilter('productStatus', e.target.value)} className="search-input"><option value="">Tous</option><option value={STATUS.IN_STOCK}>En stock</option><option value={STATUS.LOW_STOCK}>Stock faible</option><option value={STATUS.OUT_OF_STOCK}>Rupture</option></select></FormField>
          {(f.productName || f.productCategory || f.productStatus) && <button className="btn-clear-filters" onClick={() => { updateFilter('productName', ''); updateFilter('productCategory', ''); updateFilter('productStatus', '') }}>✖ Effacer</button>}
        </div>
        <div className="search-results-info">{fp.length} produit(s)</div>
      </div>}

      <div className="products-table-container">
        <table className="products-table">
          <thead><tr><th>ID</th><th>Code</th><th>Produit</th><th>Catégorie</th><th>Fournisseur</th><th>Stock</th><th>Prix</th><th>Statut</th><th>Actions</th></tr></thead>
          <tbody>{fp.length ? fp.map(p => <tr key={p.id}>
            <td style={{ fontSize: '0.75rem', color: '#718096', fontFamily: 'monospace' }}>{p.id}</td>
            <td><strong>{p.code || '-'}</strong></td>
            <td className="product-name">{p.name}</td>
            <td>{p.category}</td>
            <td>{supp.find(s => s.id === p.supplierId)?.name || "-"}</td>
            <td className={p.stock === 0 ? "text-danger" : p.stock < 10 ? "text-warning" : ""}><strong>{p.stock}</strong></td>
            <td>{p.price} €</td>
            <td><StatusBadge status={p.status} /></td>
            <td><div className="action-buttons"><button className="btn-icon" onClick={() => hdlEditProd(p)}>✏️</button><button className="btn-icon" onClick={() => hdlDelProdRemote(p.id, p.category, p.supplierId)}>🗑️</button></div></td>
          </tr>) : <tr><td colSpan="9" className="no-data-row"><div className="no-data-message">Aucun produit</div></td></tr>}</tbody>
        </table>

        <div className="products-table-mobile">{fp.length ? fp.map(p => <article key={p.id} className="product-card-mobile">
          <div className="product-card-header"><h3>{p.name}</h3><StatusBadge status={p.status} /></div>
          <div className="product-card-body">
            <div><strong>Catégorie:</strong> {p.category}</div>
            <div><strong>Fournisseur:</strong> {supp.find(s => s.id === p.supplierId)?.name || "-"}</div>
            <div><strong>Stock:</strong> {p.stock}</div>
            <div><strong>Prix:</strong> {p.price} €</div>
          </div>
          <div className="product-card-footer"><button onClick={() => hdlEditProd(p)}>✏️</button><button onClick={() => hdlDelProdRemote(p.id, p.category, p.supplierId)}>🗑️</button></div>
        </article>) : <div className="no-data-message">Aucun produit</div>}</div>
      </div>

      {/* Product Modal */}
      <Modal isOpen={mod} onClose={() => { setMod(false); rProd() }} title={ep ? '✏️ Modifier' : '➕ Nouveau produit'} onConfirm={ep ? hdlUpdProdRemote : hdlAddProdRemote} confirmText={ep ? 'Modifier' : 'Ajouter'}>
        <FormField label="Nom" id="prod-name" error={fe.name}><input type="text" value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} autoFocus /></FormField>
        <FormField label="Code unique (ex: CA-145)" id="prod-sku" error={fe.sku}><input type="text" value={pf.sku} onChange={e => setPf({ ...pf, sku: e.target.value })} placeholder="ex: CA-145" /></FormField>
        <FormField label="Catégorie" id="prod-cat" error={fe.category}><select value={pf.category} onChange={e => setPf({ ...pf, category: e.target.value })}><option value="">Sélectionner</option>{cat.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</select></FormField>
        <FormField label="Fournisseur" id="prod-supplier" error={fe.supplierId}><select value={pf.supplierId} onChange={e => setPf({ ...pf, supplierId: e.target.value })}><option value="">Sélectionner</option>{supp.filter(s => s.status === 'actif').map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></FormField>
        <div className="form-row"><FormField label="Stock" id="prod-stock" error={fe.stock}><input type="number" min="0" value={pf.stock} onChange={e => setPf({ ...pf, stock: e.target.value })} /></FormField><FormField label="Prix (€)" id="prod-price" error={fe.price}><input type="number" min="0" value={pf.price} onChange={e => setPf({ ...pf, price: e.target.value })} /></FormField></div>
      </Modal>
    </div>
  )
}

export default ProductsPage
