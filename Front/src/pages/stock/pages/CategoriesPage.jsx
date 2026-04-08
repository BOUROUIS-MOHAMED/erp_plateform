import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import categoryService from '../../../services/categoryService'
import productService from '../../../services/productService'
import supplierService from '../../../services/supplierService'
import {
  extractApiErrorMessage,
  mapCategoryToUi,
  mapProductToUi,
  mapSupplierToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'
import Modal from '../../../components/common/Modal'
import StatusBadge from '../../../components/common/StatusBadge'
import FormField from '../../../components/common/FormField'

function CategoriesPage() {
  const navigate = useNavigate()

  // Data
  const [cat, setCat] = useState([])
  const [prod, setProd] = useState([])
  const [supp, setSupp] = useState([])

  // Filters
  const [f, setF] = useState({ categorySearch: "" })

  // Modals
  const [modCategory, setModCategory] = useState(false)
  const [modCategoryProducts, setModCategoryProducts] = useState(false)
  const [sc, setSc] = useState(null)

  // Form
  const [ec, setEc] = useState(null)
  const [cf, setCf] = useState({ name: "", code: "", description: "" })
  const [fe, setFe] = useState({})

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [categoryRes, productRes, supplierRes] = await Promise.all([
        categoryService.getAll({ limit: 200 }),
        productService.getAll({ limit: 200 }),
        supplierService.getAll({ limit: 200 }),
      ])
      setCat(pickList(categoryRes, ['categories', 'data']).map(mapCategoryToUi))
      setProd(pickList(productRes, ['products', 'data']).map(mapProductToUi))
      setSupp(pickList(supplierRes, ['suppliers', 'data']).map(mapSupplierToUi))
    } catch (error) {
      console.error('CategoriesPage load error:', error)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Filtered categories
  const fc = useMemo(() => cat.filter(c =>
    !f.categorySearch || c.name.toLowerCase().includes(f.categorySearch.toLowerCase())
  ), [cat, f.categorySearch])

  const updateFilter = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  // Validation
  const vCat = useCallback(() => {
    const e = {}
    if (!cf.name.trim()) e.name = "Nom requis"; else if (cf.name.length > 50) e.name = "Max 50"
    if (!cf.code.trim()) e.code = "Clé unique requise (ex: CA-145)"
    if (cf.description.length > 200) e.description = "Max 200"
    return e
  }, [cf])

  // Reset
  const rCat = useCallback(() => {
    setCf({ name: "", code: "", description: "" })
    setEc(null)
    setFe({})
  }, [])

  // Edit
  const hdlEditCat = (c) => {
    setEc(c)
    setCf({ name: c.name, code: c.code, description: c.description || "" })
    setModCategory(true)
  }

  // CRUD Remote
  const hdlAddCatRemote = async () => {
    const e = vCat(); if (Object.keys(e).length) return setFe(e)
    try {
      await categoryService.create({ name: cf.name.trim(), code: cf.code.trim(), description: cf.description.trim() })
      await loadData()
      rCat(); setModCategory(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible d'ajouter la categorie"))
    }
  }

  const hdlUpdCatRemote = async () => {
    const e = vCat(); if (Object.keys(e).length) return setFe(e)
    try {
      await categoryService.update(ec.id, { name: cf.name.trim(), code: cf.code.trim(), description: cf.description.trim() })
      await loadData()
      rCat(); setModCategory(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de modifier la categorie"))
    }
  }

  const hdlDelCatRemote = async (id) => {
    if (!window.confirm("Supprimer cette categorie ?")) return
    try {
      await categoryService.delete(id)
      await loadData()
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de supprimer la categorie"))
    }
  }

  return (
    <div className="categories-tab">
      <header className="tab-header">
        <h2>📑 Catégories</h2>
        <button className="btn-primary" onClick={() => { rCat(); setModCategory(true) }}>+ Nouvelle</button>
      </header>

      {/* Search bar */}
      <div className="categories-search-bar" style={{ marginBottom: "1.5rem" }}>
        <div className="search-row">
          <FormField label="🔍 Rechercher une catégorie" id="search-category-name">
            <input
              type="text"
              placeholder="Nom de la catégorie..."
              value={f.categorySearch}
              onChange={e => updateFilter('categorySearch', e.target.value)}
              className="search-input"
            />
          </FormField>
          {f.categorySearch && <button className="btn-clear-filters" onClick={() => updateFilter('categorySearch', '')}>✖ Effacer</button>}
        </div>
        <div className="search-results-info">{fc.length} catégorie(s)</div>
      </div>

      <div className="categories-grid">
        {fc.length
          ? fc.map(c => <article key={c.id} className="category-card">
            <div className="category-icon">📁</div>
            <div className="category-info">
              <h3>{c.name}</h3>
              {c.code && <p style={{ fontSize: '0.8rem', fontFamily: 'monospace', fontWeight: 600, color: '#4a5568' }}>🔑 {c.code}</p>}
              <p style={{ fontSize: '0.7rem', color: '#a0aec0', fontFamily: 'monospace' }}>ID: {c.id}</p>
              <p>{c.description}</p>
              <div className="category-stats">
                {c.productCount
                  ? <button className="product-count-link" onClick={() => { setSc(c); setModCategoryProducts(true) }}>📦 <strong>{c.productCount}</strong> produits →</button>
                  : <span>📦 0 produit</span>}
              </div>
            </div>
            <div className="category-actions">
              <button className="btn-icon" onClick={() => hdlEditCat(c)}>✏️</button>
              <button className="btn-icon" onClick={() => hdlDelCatRemote(c.id, c.name)}>🗑️</button>
            </div>
          </article>)
          : <div className="no-data-message">Aucune catégorie trouvée</div>}
      </div>

      {/* Category Modal */}
      <Modal isOpen={modCategory} onClose={() => { setModCategory(false); rCat() }} title={ec ? '✏️ Modifier' : '➕ Nouvelle catégorie'} onConfirm={ec ? hdlUpdCatRemote : hdlAddCatRemote} confirmText={ec ? 'Modifier' : 'Créer'}>
        <FormField label="Nom" id="cat-name" error={fe.name}><input type="text" value={cf.name} onChange={e => setCf({ ...cf, name: e.target.value })} autoFocus /></FormField>
        <FormField label="Code unique (ex: CA-145)" id="cat-code" error={fe.code}><input type="text" value={cf.code} onChange={e => setCf({ ...cf, code: e.target.value })} placeholder="ex: CA-145" /></FormField>
        <FormField label="Description" id="cat-desc" error={fe.description}><textarea value={cf.description} onChange={e => setCf({ ...cf, description: e.target.value })} rows="3" /></FormField>
      </Modal>

      {/* Category Products Modal */}
      <Modal isOpen={modCategoryProducts} onClose={() => setModCategoryProducts(false)} title={`📁 ${sc?.name}`} showConfirm={false}>
        {sc && <>
          <div className="category-info-header">
            <p>{sc.description}</p>
            <p><strong>{sc.productCount}</strong> produit(s)</p>
          </div>
          <div className="category-products-list">
            {prod.filter(p => p.category === sc.name).length
              ? <table className="products-table">
                <thead><tr><th>Produit</th><th>Fournisseur</th><th>Stock</th><th>Prix</th><th>Statut</th></tr></thead>
                <tbody>{prod.filter(p => p.category === sc.name).map(p => <tr key={p.id}>
                  <td className="product-name">{p.name}</td>
                  <td>{supp.find(s => s.id === p.supplierId)?.name || '-'}</td>
                  <td className={p.stock === 0 ? "text-danger" : p.stock < 10 ? "text-warning" : ""}><strong>{p.stock}</strong></td>
                  <td>{p.price} €</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>)}</tbody>
              </table>
              : <div className="no-data-message">Aucun produit</div>}
          </div>
          <div className="modal-footer-extra">
            <button className="btn-primary" onClick={() => {
              setModCategoryProducts(false)
              navigate('/stock/products?category=' + encodeURIComponent(sc.name))
            }}>Voir dans Produits</button>
          </div>
        </>}
      </Modal>
    </div>
  )
}

export default CategoriesPage
