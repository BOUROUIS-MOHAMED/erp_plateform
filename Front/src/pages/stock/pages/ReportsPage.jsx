import { useState, useEffect, useMemo, useCallback } from 'react'
import { reportService } from '../../../services/reportService'
import {
  extractApiErrorMessage,
  mapReportToUi,
  pickList,
} from '../../../utils/frontendApiAdapters'
import { getUserRole } from '../../../utils/auth'
import Modal from '../../../components/common/Modal'
import FormField from '../../../components/common/FormField'

const getReportIcon = (type = "custom") => ({
  stocks: "📦",
  fournisseurs: "🤝",
  mouvements: "🔄",
  alertes: "⚠️",
  valeur: "💰",
  custom: "📄"
}[type] || "📄")

function ReportsPage() {
  const [reports, setReports] = useState([])
  const [ur] = useState(() => getUserRole())

  // Filters
  const [f, setF] = useState({ reportSearch: "" })

  // Modals
  const [modReport, setModReport] = useState(false)
  const [modReportView, setModReportView] = useState(false)

  // Form
  const [er, setEr] = useState(null)
  const [vr, setVr] = useState(null)
  const [rf, setRf] = useState({ title: "", description: "", icon: "📄", type: "custom" })
  const [fe, setFe] = useState({})

  // Load data
  const loadData = useCallback(async () => {
    try {
      const reportRes = await reportService.getAll({ limit: 200 })
      setReports(
        pickList(reportRes, ['data'])
          .filter(report => {
            if (ur === 'admin_principal') return true
            const tags = report.tags || []
            return tags.length === 0 || tags.includes('source:stock')
          })
          .map(report => mapReportToUi(report, getReportIcon(report.type)))
      )
    } catch (error) {
      console.error('ReportsPage load error:', error)
    }
  }, [ur])

  useEffect(() => { loadData() }, [loadData])

  // Filtered reports
  const fr = useMemo(() => reports.filter(r =>
    !f.reportSearch || r.title.toLowerCase().includes(f.reportSearch.toLowerCase()) || r.description.toLowerCase().includes(f.reportSearch.toLowerCase())
  ), [reports, f.reportSearch])

  const updateFilter = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  // Validation
  const vReport = useCallback(() => {
    const e = {}
    if (!rf.title.trim()) e.title = "Titre requis"
    else if (rf.title.length > 100) e.title = "Max 100 caractères"
    if (!rf.description.trim()) e.description = "Description requise"
    else if (rf.description.length > 500) e.description = "Max 500 caractères"
    return e
  }, [rf])

  // Reset
  const rReport = useCallback(() => {
    setRf({ title: "", description: "", icon: "📄", type: "custom" })
    setEr(null)
    setFe({})
  }, [])

  // Edit / View
  const hdlEditReport = (report) => {
    setEr(report)
    setRf({ title: report.title, description: report.description, icon: report.icon || "📄", type: report.type || "custom" })
    setModReport(true)
  }

  const hdlViewReport = (report) => {
    setVr(report)
    setModReportView(true)
  }

  // CRUD Remote
  const hdlAddReportRemote = async () => {
    const e = vReport(); if (Object.keys(e).length) return setFe(e)
    try {
      await reportService.create({ title: rf.title.trim(), description: rf.description.trim(), type: rf.type || "custom", tags: ['source:stock'] })
      await loadData()
      rReport(); setModReport(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible d'ajouter le rapport"))
    }
  }

  const hdlUpdReportRemote = async () => {
    const e = vReport(); if (Object.keys(e).length) return setFe(e)
    try {
      await reportService.update(er.id, { title: rf.title.trim(), description: rf.description.trim(), type: rf.type || er.type || "custom" })
      await loadData()
      rReport(); setModReport(false)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de modifier le rapport"))
    }
  }

  const hdlDelReportRemote = async (id) => {
    if (!window.confirm("Supprimer ce rapport ?")) return
    try {
      await reportService.delete(id)
      await loadData()
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de supprimer le rapport"))
    }
  }

  const hdlDownloadReportRemote = async (report) => {
    try {
      await reportService.generatePdf(report.id)
    } catch (error) {
      window.alert(extractApiErrorMessage(error, "Impossible de telecharger le rapport"))
    }
  }

  return (
    <div className="reports-tab">
      <header className="tab-header">
        <h2>📊 Rapports</h2>
        <button className="btn-primary" onClick={() => { rReport(); setModReport(true) }}>+ Nouveau rapport</button>
      </header>

      {/* Search bar */}
      <div className="reports-search-bar" style={{ marginBottom: "1.5rem" }}>
        <div className="search-row">
          <FormField label="🔍 Rechercher un rapport" id="search-report">
            <input
              type="text"
              placeholder="Titre ou description..."
              value={f.reportSearch}
              onChange={e => updateFilter('reportSearch', e.target.value)}
              className="search-input"
            />
          </FormField>
          {f.reportSearch && <button className="btn-clear-filters" onClick={() => updateFilter('reportSearch', '')}>✖ Effacer</button>}
        </div>
        <div className="search-results-info">{fr.length} rapport(s)</div>
      </div>

      <div className="reports-grid">
        {fr.length
          ? fr.map(r => <article key={r.id} className="report-card">
            <div className="report-icon">{r.icon}</div>
            <div className="report-content">
              <h3>{r.title}</h3>
              <p>{r.description}</p>
              <small style={{ color: "#a0aec0", display: "block", marginBottom: "12px" }}>
                Créé le {new Date(r.createdAt).toLocaleDateString('fr-FR')}
              </small>
              <div className="report-actions" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button className="btn-outline" title="Voir le contenu" onClick={() => hdlViewReport(r)}>👁️ Voir</button>
                <button className="btn-outline" title="Modifier" onClick={() => hdlEditReport(r)}>✏️ Modifier</button>
                <button className="btn-outline" title="Télécharger PDF" onClick={() => hdlDownloadReportRemote(r)}>📥 PDF</button>
                <button className="btn-outline btn-danger-outline" title="Supprimer" onClick={() => hdlDelReportRemote(r.id)}>🗑️ Supprimer</button>
              </div>
            </div>
          </article>)
          : <div className="no-data-message">Aucun rapport trouvé</div>}
      </div>

      {/* Report Create/Edit Modal */}
      <Modal
        isOpen={modReport}
        onClose={() => { setModReport(false); rReport() }}
        title={er ? '✏️ Modifier le rapport' : '➕ Nouveau rapport'}
        onConfirm={er ? hdlUpdReportRemote : hdlAddReportRemote}
        confirmText={er ? 'Modifier' : 'Créer'}
      >
        <FormField label="Titre" id="report-title" error={fe.title}>
          <input type="text" value={rf.title} onChange={e => setRf({ ...rf, title: e.target.value })} placeholder="Titre du rapport" autoFocus />
        </FormField>
        <FormField label="Description" id="report-desc" error={fe.description}>
          <textarea value={rf.description} onChange={e => setRf({ ...rf, description: e.target.value })} rows="4" placeholder="Description détaillée du rapport..." />
        </FormField>
      </Modal>

      {/* Report View Modal */}
      <Modal
        isOpen={modReportView}
        onClose={() => { setModReportView(false); setVr(null) }}
        title={vr ? `${vr.icon} ${vr.title}` : 'Rapport'}
        showConfirm={false}
      >
        {vr && <div className="report-view-content">
          <div style={{ background: "#f7fafc", padding: "16px", borderRadius: "8px", borderLeft: "4px solid #48bb78", marginBottom: "16px" }}>
            <p style={{ color: "#4a5568", lineHeight: "1.7", margin: 0 }}>{vr.description}</p>
          </div>
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", color: "#a0aec0", fontSize: ".85rem" }}>
            <span>📅 Créé le {new Date(vr.createdAt).toLocaleDateString('fr-FR')}</span>
          </div>
        </div>}
      </Modal>
    </div>
  )
}

export default ReportsPage
