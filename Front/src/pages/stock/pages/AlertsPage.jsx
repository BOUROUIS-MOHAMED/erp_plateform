import { useState, useEffect, useCallback } from 'react'
import productService from '../../../services/productService'
import supplierService from '../../../services/supplierService'
import {
  mapProductToUi,
  mapSupplierToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'

const STATUS = { IN_STOCK: "en stock", LOW_STOCK: "stock faible", OUT_OF_STOCK: "rupture" }

function AlertsPage() {
  const [prod, setProd] = useState([])
  const [supp, setSupp] = useState([])

  // Alerts read state (localStorage)
  const [readAlerts, setReadAlerts] = useState(() => {
    try {
      const s = localStorage.getItem('erp_stock_alerts_read')
      return s ? JSON.parse(s) : {}
    } catch { return {} }
  })

  const toggleAlertRead = (type, productId) => {
    setReadAlerts(prev => {
      const cur = prev[type] || []
      const next = cur.includes(productId) ? cur.filter(i => i !== productId) : [...cur, productId]
      const upd = { ...prev, [type]: next }
      localStorage.setItem('erp_stock_alerts_read', JSON.stringify(upd))
      return upd
    })
  }

  // Load data
  const loadData = useCallback(async () => {
    try {
      const [productRes, supplierRes] = await Promise.all([
        productService.getAll({ limit: 200 }),
        supplierService.getAll({ limit: 200 }),
      ])
      setProd(pickList(productRes, ['products', 'data']).map(mapProductToUi))
      setSupp(pickList(supplierRes, ['suppliers', 'data']).map(mapSupplierToUi))
    } catch (error) {
      console.error('AlertsPage load error:', error)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  return (
    <div className="alerts-tab">
      <h2>⚠️ Alertes stock</h2>
      <div className="alerts-container">
        {[
          { title: "Stock faible", key: "faible", products: prod.filter(p => p.stock > 0 && p.stock < 5), icon: "⚠️", action: "Réapprovisionner", cls: "warning" },
          { title: "Rupture", key: "rupture", products: prod.filter(p => p.stock >= 5 && p.stock <= 10), icon: "❌", action: "Commander", cls: "danger" }
        ].map(s => (
          <section key={s.title} className="alerts-section">
            <h3>{s.title}</h3>
            <div className="alerts-list">
              {s.products.length
                ? s.products.map(p => {
                  const isRead = (readAlerts[s.key] || []).includes(p.id)
                  return (
                    <article key={p.id} className={`alert-item ${s.cls}${isRead ? ' alert-read' : ''}`} style={isRead ? { opacity: 0.5 } : {}}>
                      <div className="alert-icon">{s.icon}</div>
                      <div className="alert-content">
                        <strong>{p.name}</strong>
                        <span>Stock: {p.stock}</span>
                        <small>Fournisseur: {supp.find(sup => sup.id === p.supplierId)?.name || '-'}</small>
                      </div>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <button className="btn-small" style={{ background: isRead ? '#718096' : '#48bb78', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.75rem' }} onClick={() => toggleAlertRead(s.key, p.id)}>{isRead ? 'Non lu' : 'Lu'}</button>
                      </div>
                    </article>
                  )
                })
                : <p className="no-alerts">Aucun</p>
              }
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default AlertsPage
