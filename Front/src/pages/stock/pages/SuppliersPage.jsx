import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import supplierService from '../../../services/supplierService'
import productService from '../../../services/productService'
import {
  extractApiErrorMessage,
  mapSupplierToUi,
  mapProductToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'
import Modal from '../../../components/common/Modal'
import StatusBadge from '../../../components/common/StatusBadge'
import FormField from '../../../components/common/FormField'

// Local RatingStars component
const RatingStars = ({ rating }) => {
  const stars = []
  for (let i = 1; i <= 5; i++) {
    stars.push(
      <span key={i} style={{ color: i <= rating ? '#fbbf24' : '#e2e8f0' }}>★</span>
    )
  }
  return <div className="rating-stars">{stars}</div>
}

function SuppliersPage() {
  const navigate = useNavigate()

  // Data
  const [supp, setSupp] = useState([])
  const [prod, setProd] = useState([])

  // Filters
  const [f, setF] = useState({ supplierName: "", supplierStatus: "", supplierRating: "" })
  const [spf, setSpf] = useState(false)

  // Modals
  const [modSupplier, setModSupplier] = useState(false)
  const [modSupplierProducts, setModSupplierProducts] = useState(false)

  // Form
  const [es, setEs] = useState(null)
  const [sf, setSf] = useState({ name: "", contact: "", email: "", phone: "", address: "", status: "actif", rating: 4 })
  const [fe, setFe] = useState({})

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [supplierRes, productRes] = await Promise.all([
        supplierService.getAll({ limit: 200 }),
        productService.getAll({ limit: 200 }),
      ])
      setSupp(pickList(supplierRes, ['suppliers', 'data']).map(mapSupplierToUi))
      setProd(pickList(productRes, ['products', 'data']).map(mapProductToUi))
    } catch (error) {
      console.error('SuppliersPage load error:', error)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Filtered suppliers
  const fs = useMemo(() => supp.filter(s =>
    (!f.supplierName || s.name.toLowerCase().includes(f.supplierName.toLowerCase())) &&
    (!f.supplierStatus || s.status === f.supplierStatus) &&
    (!f.supplierRating || s.rating >= parseFloat(f.supplierRating))
  ), [supp, f])

  const updateFilter = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  // Validation
  const vSupp = useCallback(() => {
    const e = {}
    if (!sf.name.trim()) e.name = "Nom requis"
    if (!sf.contact.trim()) e.contact = "Contact requis"
    if (!sf.email.trim()) e.email = "Email requis"
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sf.email)) e.email = "Email invalide"
    if (!sf.phone.trim()) e.phone = "Téléphone requis"
    if (sf.rating < 1 || sf.rating > 5) e.rating = "Note entre 1 et 5"
    return e
  }, [sf])

  // Reset
  const rSupp = useCallback(() => {
    setSf({ name: "", contact: "", email: "", phone: "", address: "", status: "actif", rating: 4 })
    setEs(null)
    setFe({})
  }, [])

  // Edit
  const hdlEditSupp = (s) => {
    setEs(s)
    setSf({ name: s.name, contact: s.contact, email: s.email, phone: s.phone, address: s.address || "", status: s.status, rating: s.rating })
    setModSupplier(true)
  }

  // CRUD Remote
  const hdlAddSuppRemote = async () => {
    const e = vSupp(); if (Object.keys(e).length) return setFe(e)
    try {
      await supplierService.create(sf)
      await loadData()
      rSupp(); setModSupplier(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible d'ajouter le fournisseur"))
    }
  }

  const hdlUpdSuppRemote = async () => {
    const e = vSupp(); if (Object.keys(e).length) return setFe(e)
    try {
      await supplierService.update(es.id, sf)
      await loadData()
      rSupp(); setModSupplier(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de modifier le fournisseur"))
    }
  }

  const hdlDelSuppRemote = async (id) => {
    if (!window.confirm("Supprimer ce fournisseur ?")) return
    try {
      await supplierService.delete(id)
      await loadData()
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de supprimer le fournisseur"))
    }
  }

  return (
    <div className="suppliers-tab">
      <header className="tab-header">
        <h2>🤝 Fournisseurs</h2>
        <div className="header-buttons">
          <button className="btn-toggle-filters" onClick={() => setSpf(!spf)}>{spf ? "Masquer" : "Afficher"} filtres 🔍</button>
          <button className="btn-primary" onClick={() => { rSupp(); setModSupplier(true) }}>+ Nouveau fournisseur</button>
        </div>
      </header>

      {spf && <div className="suppliers-search-bar">
        <div className="search-row">
          <FormField label="🔍 Nom" id="search-supp-name"><input type="text" placeholder="Nom..." value={f.supplierName} onChange={e => updateFilter('supplierName', e.target.value)} className="search-input" /></FormField>
          <FormField label="📊 Statut" id="search-supp-status"><select value={f.supplierStatus} onChange={e => updateFilter('supplierStatus', e.target.value)} className="search-input"><option value="">Tous</option><option value="actif">Actif</option><option value="inactif">Inactif</option></select></FormField>
          <FormField label="⭐ Note min" id="search-supp-rating"><select value={f.supplierRating} onChange={e => updateFilter('supplierRating', e.target.value)} className="search-input"><option value="">Toutes</option><option value="5">5 étoiles</option><option value="4">4+ étoiles</option><option value="3">3+ étoiles</option></select></FormField>
          {(f.supplierName || f.supplierStatus || f.supplierRating) && <button className="btn-clear-filters" onClick={() => { updateFilter('supplierName', ''); updateFilter('supplierStatus', ''); updateFilter('supplierRating', '') }}>✖ Effacer</button>}
        </div>
        <div className="search-results-info">{fs.length} fournisseur(s)</div>
      </div>}

      <div className="suppliers-grid">
        {fs.length ? fs.map(s => <article key={s.id} className={`supplier-card ${s.status === 'inactif' ? 'inactive' : ''}`}>
          <div className="supplier-header">
            <div className="supplier-icon">{'🤝'}</div>
            <div className="supplier-status" style={{ background: s.status === 'actif' ? '#c6f6d5' : '#fed7d7', color: s.status === 'actif' ? '#22543d' : '#742a2a' }}>{s.status}</div>
          </div>
          <div className="supplier-info">
            <h3>{s.name}</h3>
            <div className="supplier-rating"><RatingStars rating={s.rating} /> <span>({s.rating})</span></div>
            <p><strong>Contact:</strong> {s.contact}</p>
            <p><strong>Email:</strong> <a href={`mailto:${s.email}`}>{s.email}</a></p>
            <p><strong>Tél:</strong> {s.phone}</p>
            {s.address && <p><strong>Adresse:</strong> {s.address}</p>}
            <p><strong>Depuis:</strong> {new Date(s.since).toLocaleDateString('fr-FR')}</p>
            <div className="supplier-products">
              {s.products ? <button className="product-count-link" onClick={() => { setEs(s); setModSupplierProducts(true) }}>📦 <strong>{s.products}</strong> produits →</button> : <span>📦 Aucun produit</span>}
            </div>
          </div>
          <div className="supplier-actions">
            <button className="btn-icon" onClick={() => hdlEditSupp(s)}>✏️</button>
            <button className="btn-icon" onClick={() => hdlDelSuppRemote(s.id)}>🗑️</button>
          </div>
        </article>) : <div className="no-data-message">Aucun fournisseur</div>}
      </div>

      {/* Supplier Modal */}
      <Modal isOpen={modSupplier} onClose={() => { setModSupplier(false); rSupp() }} title={es ? '✏️ Modifier fournisseur' : '➕ Nouveau fournisseur'} onConfirm={es ? hdlUpdSuppRemote : hdlAddSuppRemote} confirmText={es ? 'Modifier' : 'Ajouter'}>
        <FormField label="Nom entreprise" id="supp-name" error={fe.name}><input type="text" value={sf.name} onChange={e => setSf({ ...sf, name: e.target.value })} autoFocus /></FormField>
        <FormField label="Personne de contact" id="supp-contact" error={fe.contact}><input type="text" value={sf.contact} onChange={e => setSf({ ...sf, contact: e.target.value })} /></FormField>
        <div className="form-row">
          <FormField label="Email" id="supp-email" error={fe.email}><input type="email" value={sf.email} onChange={e => setSf({ ...sf, email: e.target.value })} /></FormField>
          <FormField label="Téléphone" id="supp-phone" error={fe.phone}><input type="tel" value={sf.phone} onChange={e => setSf({ ...sf, phone: e.target.value })} /></FormField>
        </div>
        <FormField label="Adresse" id="supp-address"><textarea value={sf.address} onChange={e => setSf({ ...sf, address: e.target.value })} rows="2" /></FormField>
        <div className="form-row">
          <FormField label="Statut" id="supp-status"><select value={sf.status} onChange={e => setSf({ ...sf, status: e.target.value })}><option value="actif">Actif</option><option value="inactif">Inactif</option></select></FormField>
          <FormField label="Note (1-5)" id="supp-rating" error={fe.rating}><input type="number" min="1" max="5" step="0.1" value={sf.rating} onChange={e => setSf({ ...sf, rating: e.target.value })} /></FormField>
        </div>
      </Modal>

      {/* Supplier Products Modal */}
      <Modal isOpen={modSupplierProducts} onClose={() => setModSupplierProducts(false)} title={`🤝 ${es?.name}`} showConfirm={false}>
        {es && <>
          <div className="supplier-info-header">
            <p><strong>Contact:</strong> {es.contact} | {es.email} | {es.phone}</p>
            <p><strong>Note:</strong> <RatingStars rating={es.rating} /> ({es.rating})</p>
            <p><strong>{es.products}</strong> produit(s) fourni(s)</p>
          </div>
          <div className="supplier-products-list">
            {prod.filter(p => p.supplierId === es.id).length
              ? <table className="products-table">
                <thead><tr><th>Produit</th><th>Catégorie</th><th>Stock</th><th>Prix</th><th>Statut</th></tr></thead>
                <tbody>{prod.filter(p => p.supplierId === es.id).map(p => <tr key={p.id}>
                  <td className="product-name">{p.name}</td>
                  <td>{p.category}</td>
                  <td className={p.stock === 0 ? "text-danger" : p.stock < 10 ? "text-warning" : ""}><strong>{p.stock}</strong></td>
                  <td>{p.price} €</td>
                  <td><StatusBadge status={p.status} /></td>
                </tr>)}</tbody>
              </table>
              : <div className="no-data-message">Aucun produit de ce fournisseur</div>}
          </div>
          <div className="modal-footer-extra">
            <button className="btn-primary" onClick={() => {
              setModSupplierProducts(false)
              navigate('/stock/products?supplier=' + encodeURIComponent(es.id))
            }}>Voir produits</button>
          </div>
        </>}
      </Modal>
    </div>
  )
}

export default SuppliersPage
