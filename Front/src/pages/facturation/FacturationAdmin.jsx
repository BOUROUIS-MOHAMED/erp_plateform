// src/pages/dashboard/facturation/FacturationAdmin.jsx
import { useEffect, useState, useCallback, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { clearAuth, getUserEmail, getUserRole, isAuthenticated } from "../../utils/auth"
import ModuleDisabledView from "../../components/ModuleDisabledView"
import { useModuleAvailability } from "../../hooks/useModuleAvailability"
import userService from "../../services/userService"
import { clientService } from "../../services/clientService"
import { orderService } from "../../services/orderService"
import { invoiceService } from "../../services/invoiceService"
import { reportService } from "../../services/reportService"
import productService from "../../services/productService"
import {
  buildCustomerPayload,
  extractApiErrorMessage,
  mapCustomerToUi,
  mapInvoiceToUi,
  mapOrderToUi,
  mapReportToUi,
  mapProductToUi,
  pickList,
} from "../../utils/frontendApiAdapters"
import "./FacturationAdmin.css"

// ===== CONSTANTES =====
const C = {
  DATE_OPTIONS: { weekday:'long', day:'numeric', month:'long', year:'numeric' },
  STATUS: { "payée":"#10b981","en attente":"#f59e0b","envoyée":"#3b82f6",brouillon:"#6b7280","en retard":"#ef4444","livrée":"#10b981","expédiée":"#3b82f6","en préparation":"#8b5cf6","confirmée":"#8b5cf6","non payée":"#ef4444",actif:"#10b981",inactif:"#6b7280","archivée":"#6b7280" },
  STATUS_BG: { "payée":"#d1fae5","en attente":"#fef3c7","envoyée":"#dbeafe",brouillon:"#f3f4f6","en retard":"#fee2e2","livrée":"#d1fae5","expédiée":"#dbeafe","en préparation":"#ede9fe","confirmée":"#ede9fe","non payée":"#fee2e2",actif:"#d1fae5",inactif:"#f3f4f6","archivée":"#e5e7eb" },
  ORDER_STATUSES: ["en attente","confirmée","en préparation","expédiée","livrée"],
  PAYMENT_STATUSES: ["non payée","en attente","payée"],
  CLIENT_STATUSES: ["actif","inactif"],
  REPORT_TYPES: ["financier","clients","commandes","analytique"],
  ARCHIVE_REASONS: ["Période fiscale clôturée", "Exercice comptable terminé", "Facture soldée", "Archivage manuel"],
  TABS: { ORDERS:"orders", CLIENTS:"clients", INVOICES:"invoices", REPORTS:"reports", ARCHIVE:"archive", SETTINGS:"settings" }
}

// ===== DONNÉES DE DÉMONSTRATION =====
const DATA = {
  clients: Array.from({length:10},(_,i)=>(
    {id:i+1,name:["SARL Dupont","EURL Martin","SAS Tech","Boulangerie Paris","Restaurant Le Chef","Garage Auto","Cabinet Médical","École Privée","Pharmacie Centrale","Coiffure Moderne"][i],
     email:[`contact@dupont.fr`,`martin@eurl.fr`,`factures@tech.fr`,`compta@boulangerie.fr`,`compta@lechef.fr`,`factures@garage.fr`,`compta@medical.fr`,`facturation@ecole.fr`,`compta@pharmacie.fr`,`contact@coiffure.fr`][i],
     phone:`01 ${String(Math.floor(Math.random()*90+10)).padStart(2,'0')} ${String(Math.floor(Math.random()*90+10)).padStart(2,'0')} ${String(Math.floor(Math.random()*90+10)).padStart(2,'0')} ${String(Math.floor(Math.random()*90+10)).padStart(2,'0')}`,
     address:`${Math.floor(Math.random()*100)} Rue Example, 7500${i} Paris`,siret:`${i}${i}${i} ${i}${i}${i} ${i}${i}${i} 000${i}${i}`,
     totalOrders:Math.floor(Math.random()*15),totalSpent:Math.random()*20000,lastOrder:`2026-02-${String(Math.floor(Math.random()*10+10)).padStart(2,'0')}`,status:i%3?"actif":"inactif"})),
  orders: Array.from({length:12},(_,i)=>(
    {id:`CMD-2026-${String(i+1).padStart(3,'0')}`,date:`2026-02-${String(Math.floor(Math.random()*10+10)).padStart(2,'0')}`,
     client:["SARL Dupont","EURL Martin","SAS Tech","Boulangerie Paris","Coiffure Moderne","Restaurant Le Chef","Garage Auto","Cabinet Médical","École Privée","Pharmacie Centrale","SAS Tech","SARL Dupont"][i],
     items:Math.floor(Math.random()*10+1),total:Math.random()*2000+100,status:C.ORDER_STATUSES[Math.floor(Math.random()*C.ORDER_STATUSES.length)],
     paymentStatus:C.PAYMENT_STATUSES[Math.floor(Math.random()*C.PAYMENT_STATUSES.length)],invoiceId:Math.random()>0.5?`FACT-2026-${String(i+1).padStart(3,'0')}`:null})),
  invoices: Array.from({length:10},(_,i)=>(
    {id:`FACT-2026-${String(i+1).padStart(3,'0')}`,date:`2026-02-${String(Math.floor(Math.random()*10+10)).padStart(2,'0')}`,
     orderId:`CMD-2026-${String(i+1).padStart(3,'0')}`,client:["SARL Dupont","EURL Martin","SAS Tech","Boulangerie Paris","Coiffure Moderne","Restaurant Le Chef","Garage Auto","Cabinet Médical","École Privée","Pharmacie Centrale"][i],
     amount:Math.random()*2000+100,status:["payée","envoyée","brouillon","en retard","payée"][Math.floor(Math.random()*5)],
     dueDate:`2026-03-${String(Math.floor(Math.random()*20+10)).padStart(2,'0')}`,archived:false})),
  reports: Array.from({length:6},(_,i)=>(
    {id:i+1,
     title:["Rapport financier mensuel","Top 10 clients","Analyse des commandes","Prévisions financières","Analyse de rentabilité","Statistiques de paiement"][i],
     description:["Analyse détaillée des revenus et dépenses du mois","Classement des meilleurs clients par chiffre d'affaires","Étude des tendances de commandes sur 6 mois","Projections financières pour le prochain trimestre","Marge bénéficiaire par catégorie de produit","Taux de recouvrement et délais de paiement"][i],
     type:C.REPORT_TYPES[i%4],
     date:`2026-02-${28-i}`,
     author:"admin_facture",
     stats: {
       totalRevenue: Math.random() * 50000,
       totalInvoices: Math.floor(Math.random() * 100),
       paidRatio: Math.random(),
       topClient: { name: "SARL Dupont", amount: Math.random() * 10000 },
       avgOrderValue: Math.random() * 500 + 100,
       latePayments: Math.floor(Math.random() * 20)
     }
    })),
  archiveLog: [{id:1,invoiceId:"FACT-2026-001",date:"2026-03-15",reason:"Période fiscale clôturée",archivedBy:"admin_facture",reference:"ARCH-2026-001"}]
}

// ===== FONCTIONS UTILITAIRES =====
const utils = {
  formatCurrency: a => a.toLocaleString('fr-FR',{style:'currency',currency:'EUR'}),
  formatDate: d => d?new Date(d).toLocaleDateString('fr-FR'):"",
  formatPercentage: p => `${(p * 100).toFixed(1)}%`,
  generateId: (p,items) => `${p}-${String(Math.max(...items.map(i=>+i.id.split('-').pop()||0),0)+1).padStart(3,'0')}`,
  updateClientStats: (c,n,t,op='add') => c.map(c=>c.name===n?{...c,totalOrders:Math.max(0,c.totalOrders+(op==='add'?1:-1)),totalSpent:Math.max(0,c.totalSpent+(op==='add'?t:-t)),lastOrder:op==='add'?new Date().toISOString().split('T')[0]:c.lastOrder}:c),
  generateArchiveRef: () => `ARCH-${new Date().getFullYear()}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`,
  calculateRetentionDate: (date,years=10) => {const d=new Date(date);d.setFullYear(d.getFullYear()+years);return d.toISOString().split('T')[0];}
}

// ===== COMPOSANTS RÉUTILISABLES =====
const StatusBadge = ({status}) => (
  <span className="status-badge" style={{background:C.STATUS_BG[status]||"#f3f4f6",color:C.STATUS[status]||"#6b7280"}}>{status}</span>
)

const Table = ({h,r,rn}) => (
  <div className="table-container"><table className="data-table"><thead><tr>{h.map((v,i)=><th key={i}>{v}</th>)}</tr></thead><tbody>{r.map(rn)}</tbody></table></div>
)

const SearchBar = ({v,o,p}) => (
  <div className="search-box large"><span className="search-icon">🔍</span><input type="text" placeholder={p} className="search-input" value={v} onChange={e=>o(e.target.value)}/></div>
)

const useNotification = () => {
  const [n,setN] = useState({show:false,message:"",type:""})
  const show = useCallback((m,t)=>{setN({show:true,message:m,type:t});setTimeout(()=>setN({show:false,message:"",type:""}),3000)},[])
  return {notification:n,showNotification:show}
}

// ===== COMPOSANT PRINCIPAL =====
export default function FacturationAdmin() {
  const nav = useNavigate()
  const { blocked, checking } = useModuleAvailability("facturation")
  
  // ===== ÉTATS =====
  const [email,setEmail] = useState("")
  const [userRole,setUserRole] = useState("")
  const [loading,setLoading] = useState(true)
  const [userSettings, setUserSettings] = useState({ firstName:'', lastName:'', email:'', phone:'', department:'', role:'', currentPassword:'', newPassword:'', confirmPassword:'' })
  const [settingsMessage, setSettingsMessage] = useState({ type:"", text:"" })
  const [updating, setUpdating] = useState(false)
  const [tab,setTab] = useState(C.TABS.ORDERS)
  const [clients,setClients] = useState([])
  const [orders,setOrders] = useState([])
  const [products,setProducts] = useState([])
  const [invoices,setInvoices] = useState([])
  const [reports,setReports] = useState([])
  const [archiveLog,setArchiveLog] = useState(() => { try { return JSON.parse(localStorage.getItem('erp_facturation_archives') || '[]') } catch { return [] } })
  const [showArchive,setShowArchive] = useState(false)
  const [archiveModal,setArchiveModal] = useState({show:false,invoice:null})
  const [archiveFilters,setArchiveFilters] = useState({search:"",year:"all"})
  const [modal,setModal] = useState({client:false,order:false,report:false})
  const [edit,setEdit] = useState({type:null,data:null})
  const [cForm,setCForm] = useState({name:"",email:"",phone:"",address:"",siret:"",status:"actif"})
  const [oForm,setOForm] = useState({client:"", items: [{product:"", quantity:1, unitPrice:0}], status:"en attente", paymentStatus:"non payée", expectedDate:"", notes:""})
  const [rForm,setRForm] = useState({title:"",description:"",type:"financier"})
  const [filters,setFilters] = useState({date:{start:"",end:""},search:""})
  const {notification,showNotification} = useNotification()
  const [selectedReport, setSelectedReport] = useState(null)
  const [reportModal, setReportModal] = useState({ show: false, report: null })

  const getReportIcon = (type="analytique") => ({
    financier: "💰",
    clients: "👥",
    commandes: "📦",
    analytique: "📊"
  }[type] || "📈")

  const applyProfileState = (profile, fallbackRole, fallbackEmail) => {
    const resolvedEmail = profile?.email || fallbackEmail || ""
    const resolvedRole = profile?.role || fallbackRole || "admin_facture"
    const firstName = profile?.firstName || (resolvedRole==="admin_principal" ? "Admin" : "Gestionnaire")
    const lastName = profile?.lastName || (resolvedRole==="admin_principal" ? "Principal" : "Facturation")

    setEmail(resolvedEmail)
    setUserSettings({
      firstName,
      lastName,
      email: resolvedEmail,
      phone: profile?.phone || "",
      department: profile?.department || "Comptabilite",
      role: resolvedRole,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    })
  }

  const loadFacturationData = async (fallbackRole = userRole, fallbackEmail = email) => {
    const [profileResponse, clientsResponse, ordersResponse, invoicesResponse, reportsResponse, productsResponse] = await Promise.all([
      userService.getProfile(),
      clientService.getAll({ limit: 200 }),
      orderService.getAll({ limit: 200 }),
      invoiceService.getAll({ limit: 200 }),
      reportService.getAll({ limit: 200 }),
      productService.getAll({ limit: 200 })
    ])

    const profile = profileResponse?.data || profileResponse
    const invoiceItems = pickList(invoicesResponse, ['data']).map(mapInvoiceToUi)
    const invoiceByOrderId = new Map(invoiceItems.filter(invoice => invoice.orderId).map(invoice => [invoice.orderId, invoice]))

    applyProfileState(profile, fallbackRole, fallbackEmail)
    setClients(pickList(clientsResponse, ['data']).map(mapCustomerToUi))
    setInvoices(invoiceItems)
    setOrders(pickList(ordersResponse, ['data']).map(order => mapOrderToUi(order, invoiceByOrderId)))
    const role = fallbackRole || getUserRole()
    setReports(
      pickList(reportsResponse, ['data'])
        .filter(report => {
          if (role === 'admin_principal') return true
          const tags = report.tags || []
          return tags.length === 0 || tags.includes('source:facturation')
        })
        .map(report => mapReportToUi(report, getReportIcon(report.type)))
    )
    setProducts(pickList(productsResponse, ['products', 'data']).map(mapProductToUi))
    try { setArchiveLog(JSON.parse(localStorage.getItem('erp_facturation_archives') || '[]')) } catch { setArchiveLog([]) }
  }

  // ===== EFFETS =====
  useEffect(() => {
    const role = getUserRole()
    const e = getUserEmail()
    if (!isAuthenticated() || (role!=="admin_facture" && role!=="admin_principal")) {
      nav("/login")
      return
    }
    let active = true
    ;(async () => {
      try {
        setUserRole(role)
        setEmail(e)
        await loadFacturationData(role, e)
      } catch (error) {
        if (!active) return
        setSettingsMessage({
          type: "error",
          text: extractApiErrorMessage(error, "Impossible de charger les données de facturation")
        })
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [nav])

  // ===== STATISTIQUES =====
  const stats = useMemo(() => ({
    totalOrders:orders.length,totalInvoices:invoices.length,totalAmount:invoices.reduce((a,i)=>a+i.amount,0),
    paidAmount:invoices.filter(i=>i.status==="payée").reduce((a,i)=>a+i.amount,0),
    pendingAmount:invoices.filter(i=>["en attente","envoyée"].includes(i.status)).reduce((a,i)=>a+i.amount,0),
    overdueAmount:invoices.filter(i=>i.status==="en retard").reduce((a,i)=>a+i.amount,0),
    totalClients:clients.length,activeClients:clients.filter(c=>c.status==="actif").length,
    ordersToInvoice:orders.filter(o=>!o.invoiceId).length,paidInvoices:invoices.filter(i=>i.status==="payée").length,
    totalReports:reports.length,archivedInvoices:archiveLog.length,totalArchiveEntries:archiveLog.length
  }),[orders,invoices,clients,reports,archiveLog])

  // ===== GESTION DES PARAMÈTRES =====
  const handleSettingsChange = (e) => {
    const { name, value } = e.target
    setUserSettings({ ...userSettings, [name]: value })
  }

  const handleSaveSettings = async () => {
    if (!userSettings.firstName || !userSettings.lastName || !userSettings.email) {
      setSettingsMessage({ type: "error", text: "Prénom, nom et email sont requis" })
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userSettings.email)) {
      setSettingsMessage({ type: "error", text: "Format d'email invalide" })
      return
    }

    if (userSettings.phone && !/^[0-9+\-\s]+$/.test(userSettings.phone)) {
      setSettingsMessage({ type: "error", text: "Format de téléphone invalide" })
      return
    }

    if (userSettings.newPassword || userSettings.confirmPassword || userSettings.currentPassword) {
      if (!userSettings.currentPassword) {
        setSettingsMessage({ type: "error", text: "Mot de passe actuel requis" })
        return
      }
      if (userSettings.newPassword !== userSettings.confirmPassword) {
        setSettingsMessage({ type: "error", text: "Les nouveaux mots de passe ne correspondent pas" })
        return
      }
      if (userSettings.newPassword.length < 6) {
        setSettingsMessage({ type: "error", text: "Le nouveau mot de passe doit contenir au moins 6 caractères" })
        return
      }
    }

    setUpdating(true)
    setSettingsMessage({ type: "info", text: "Mise à jour en cours..." })

    try {
      await userService.updateProfile({
        firstName: userSettings.firstName,
        lastName: userSettings.lastName,
        email: userSettings.email,
      
        phone: userSettings.phone,
        department: userSettings.department
      })
      if (userSettings.newPassword) {
        await userService.changePassword(userSettings.currentPassword, userSettings.newPassword)
      }
      await loadFacturationData(userRole, userSettings.email)
      setSettingsMessage({ type: "success", text: "Profil mis à jour avec succès !" })
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Impossible de mettre ? jour le profil")
      })
    } finally {
      setUpdating(false)
    }
  }

  // ===== GESTION DES MODALES =====
  const openModal = (type,item=null) => {
    if(item) {
      setEdit({type,data:item})
      type==='client' ? setCForm(item) : 
      type==='order' ? setOForm({client: item.customerId || item.client, items: item.backend?.items?.map(i => ({ product: typeof i.product === 'object' ? i.product._id : i.product, quantity: i.quantity, unitPrice: i.unitPrice })) || [{product: '', quantity: 1, unitPrice: 0}], status: item.status, paymentStatus: item.paymentStatus, expectedDate: item.backend?.expectedDate ? item.backend.expectedDate.split('T')[0] : '', notes: item.backend?.notes || '' }) : 
      setRForm({title:item.title, description:item.description, type:item.type})
    }
    setModal(p=>({...p,[type]:true}))
  }

  const closeModal = type => {
    setModal(p=>({...p,[type]:false}))
    setEdit({type:null,data:null})
    type==='client' ? setCForm({name:"",email:"",phone:"",address:"",siret:"",status:"actif"}) :
    type==='order' ? setOForm({client:"", items:[{product:"", quantity:1, unitPrice:0}], status:"en attente", paymentStatus:"non payée", expectedDate:"", notes:""}) :
    setRForm({title:"",description:"",type:"financier"})
  }

  // ===== CRUD CLIENTS =====
  const handleAddClient = () => { if(!cForm.name.trim()) return; setClients([...clients,{id:clients.length+1,...cForm,totalOrders:0,totalSpent:0,lastOrder:new Date().toISOString().split('T')[0]}]); closeModal('client'); showNotification("Client ajouté","success") }
  const handleUpdateClient = () => { if(!cForm.name.trim()) return; setClients(clients.map(c=>c.id===edit.data.id?{...c,...cForm}:c)); if(edit.data.name!==cForm.name) { setOrders(orders.map(o=>o.client===edit.data.name?{...o,client:cForm.name}:o)); setInvoices(invoices.map(i=>i.client===edit.data.name?{...i,client:cForm.name}:i)) } closeModal('client'); showNotification("Client modifié","success") }
  const handleDeleteClient = (id,name) => { if(window.confirm(orders.filter(o=>o.client===name).length?"Ce client a des commandes. Supprimer ?":"Supprimer ce client ?")) { setClients(clients.filter(c=>c.id!==id)); showNotification("Client supprimé","warning") } }

  // ===== CRUD COMMANDES =====
  const handleAddOrder = () => { if(!oForm.client||!oForm.total) return; const newOrder={id:utils.generateId('CMD-2026',orders),date:new Date().toISOString().split('T')[0],client:oForm.client,items:parseInt(oForm.items)||1,total:parseFloat(oForm.total),status:oForm.status,paymentStatus:oForm.paymentStatus,invoiceId:null}; setOrders([newOrder,...orders]); setClients(utils.updateClientStats(clients,oForm.client,parseFloat(oForm.total),'add')); closeModal('order'); showNotification("Commande créée","success") }
  const handleUpdateOrder = () => { if(!oForm.client||!oForm.total) return; const old=orders.find(o=>o.id===edit.data.id); setOrders(orders.map(o=>o.id===edit.data.id?{...o,client:oForm.client,items:parseInt(oForm.items)||1,total:parseFloat(oForm.total),status:oForm.status,paymentStatus:oForm.paymentStatus}:o)); if(old.client!==oForm.client||old.total!==parseFloat(oForm.total)) { setClients(utils.updateClientStats(clients,old.client,old.total,'remove')); setClients(utils.updateClientStats(clients,oForm.client,parseFloat(oForm.total),'add')) } closeModal('order'); showNotification("Commande modifiée","success") }
  const handleDeleteOrder = (id,client,total) => { if(window.confirm("Supprimer cette commande ?")) { setOrders(orders.filter(o=>o.id!==id)); setClients(utils.updateClientStats(clients,client,total,'remove')); showNotification("Commande supprimée","warning") } }

  // ===== CRUD RAPPORTS =====
  const handleAddReport = () => { 
    if(!rForm.title.trim()||!rForm.description.trim()) return; 
    const newReport = {
      id:reports.length+1,
      title:rForm.title,
      description:rForm.description,
      type:rForm.type,
      date:new Date().toISOString().split('T')[0],
      author:userSettings.firstName||"admin_facture",
      stats: {
        totalRevenue: Math.random() * 50000,
        totalInvoices: Math.floor(Math.random() * 100),
        paidRatio: Math.random(),
        topClient: { name: "Nouveau client", amount: Math.random() * 10000 },
        avgOrderValue: Math.random() * 500 + 100,
        latePayments: Math.floor(Math.random() * 20)
      }
    };
    setReports([newReport, ...reports]); 
    closeModal('report'); 
    showNotification("Rapport ajouté","success") 
  }
  
  const handleUpdateReport = () => { 
    if(!rForm.title.trim()||!rForm.description.trim()) return; 
    setReports(reports.map(r=>r.id===edit.data.id?{...r,title:rForm.title,description:rForm.description,type:rForm.type}:r)); 
    closeModal('report'); 
    showNotification("Rapport modifié","success") 
  }
  
  const handleDeleteReport = (id,title) => { 
    if(window.confirm(`Supprimer le rapport "${title}" ?`)) { 
      setReports(reports.filter(r=>r.id!==id)); 
      showNotification("Rapport supprimé","warning") 
    } 
  }
  
  const handleViewReport = (report) => {
    setReportModal({ show: true, report: report })
  }

  const handleDownloadReport = (report) => {
    const htmlContent = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${report.title}</title>
      <style>
        body {
          font-family: 'Segoe UI', Arial, sans-serif;
          padding: 40px;
          max-width: 1000px;
          margin: 0 auto;
          background: #f9fafb;
        }
        .report-header {
          background: linear-gradient(135deg, #f59e0b, #d97706);
          color: white;
          padding: 30px;
          border-radius: 12px;
          margin-bottom: 30px;
        }
        h1 { margin: 0 0 10px 0; font-size: 28px; }
        .report-meta {
          color: rgba(255,255,255,0.9);
          font-size: 14px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .stat-card {
          background: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid #f59e0b;
        }
        .stat-card h3 {
          margin: 0 0 10px 0;
          color: #4a5568;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }
        .stat-value {
          font-size: 28px;
          font-weight: bold;
          color: #2d3748;
        }
        .description {
          background: white;
          padding: 20px;
          border-radius: 10px;
          margin-bottom: 30px;
          line-height: 1.6;
          color: #4a5568;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #a0aec0;
          font-size: 12px;
          border-top: 1px solid #e2e8f0;
          margin-top: 30px;
        }
      </style>
    </head>
    <body>
      <div class="report-header">
        <h1>${report.icon || '📈'} ${report.title}</h1>
        <div class="report-meta">
          Créé le : ${utils.formatDate(report.date)} | Type : ${report.type} | Auteur : ${report.author}
        </div>
      </div>
      
      <div class="stats-grid">
        <div class="stat-card">
          <h3>Chiffre d'affaires total</h3>
          <div class="stat-value">${utils.formatCurrency(report.stats?.totalRevenue || 0)}</div>
        </div>
        <div class="stat-card">
          <h3>Nombre de factures</h3>
          <div class="stat-value">${report.stats?.totalInvoices || 0}</div>
        </div>
        <div class="stat-card">
          <h3>Taux de recouvrement</h3>
          <div class="stat-value">${utils.formatPercentage(report.stats?.paidRatio || 0)}</div>
        </div>
        <div class="stat-card">
          <h3>Meilleur client</h3>
          <div class="stat-value">${report.stats?.topClient?.name || '-'}</div>
          <div style="font-size: 14px; color: #718096;">${utils.formatCurrency(report.stats?.topClient?.amount || 0)}</div>
        </div>
        <div class="stat-card">
          <h3>Panier moyen</h3>
          <div class="stat-value">${utils.formatCurrency(report.stats?.avgOrderValue || 0)}</div>
        </div>
        <div class="stat-card">
          <h3>Paiements en retard</h3>
          <div class="stat-value">${report.stats?.latePayments || 0}</div>
        </div>
      </div>
      
      <div class="description">
        <h3 style="margin-top: 0;">Description du rapport</h3>
        <p>${report.description}</p>
      </div>
      
      <div class="footer">
        Rapport généré par ERP Facturation - ${new Date().toLocaleString('fr-FR')}
      </div>
    </body>
    </html>`
    
    const blob = new Blob([htmlContent], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rapport-${report.title.toLowerCase().replace(/\s+/g, '-')}.html`
    a.click()
    URL.revokeObjectURL(url)
    showNotification("Rapport téléchargé", "success")
  }

  // ===== GESTION DES FACTURES =====
  const handleGenerateInvoice = order => { if(order.invoiceId) { alert("Facture déjà associée !"); return } const newInv={id:utils.generateId('FACT-2026',invoices),date:new Date().toISOString().split('T')[0],orderId:order.id,client:order.client,amount:order.total,status:"envoyée",dueDate:new Date(Date.now()+30*24*60*60*1000).toISOString().split('T')[0],archived:false}; setInvoices([newInv,...invoices]); setOrders(orders.map(o=>o.id===order.id?{...o,invoiceId:newInv.id,paymentStatus:"en attente"}:o)); showNotification(`Facture ${newInv.id} générée`,"success") }
  const handleMarkAsPaid = id => { setInvoices(invoices.map(i=>i.id===id?{...i,status:"payée"}:i)); const inv=invoices.find(i=>i.id===id); if(inv) setOrders(orders.map(o=>o.id===inv.orderId?{...o,paymentStatus:"payée"}:o)); showNotification("Facture marquée payée","success") }
  const handleRestoreInvoice = invoiceId => { setInvoices(invoices.map(i=>i.id===invoiceId?{...i,status:"payée",archived:false,archivedDate:null,archiveRef:null,retentionDate:null}:i)); setArchiveLog(archiveLog.filter(e=>e.invoiceId!==invoiceId)); showNotification(`Facture ${invoiceId} restaurée`,"success") }
  
  const handleArchiveInvoice = (invoice,reason="Archivage manuel") => { 
    if(invoice.status!=="payée") { 
      showNotification("Seules les factures payées peuvent être archivées","error"); 
      return; 
    } 
    const ref=utils.generateArchiveRef(); 
    const ret=utils.calculateRetentionDate(new Date().toISOString().split('T')[0],10); 
    setInvoices(invoices.map(i=>i.id===invoice.id?{...i,status:"archivée",archived:true,archivedDate:new Date().toISOString().split('T')[0],archiveRef:ref,retentionDate:ret}:i)); 
    setArchiveLog([{id:archiveLog.length+1,invoiceId:invoice.id,date:new Date().toISOString().split('T')[0],reason,archivedBy:userSettings.firstName||"admin_facture",reference:ref,retentionDate:ret,amount:invoice.amount,client:invoice.client},...archiveLog]); 
    showNotification(`Facture ${invoice.id} archivée (Réf: ${ref})`,"success");
  }

  const handleAddClientRemote = async () => {
    if (!cForm.name.trim()) return
    if (cForm.siret && !/^\d{14}$/.test(cForm.siret)) {
      showNotification("Le SIRET doit contenir exactement 14 chiffres", "error")
      return
    }

    try {
      await clientService.create(buildCustomerPayload(cForm))
      await loadFacturationData(userRole, userSettings.email || email)
      closeModal('client')
      showNotification("Client ajouté", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible d'ajouter le client"), "error")
    }
  }

  const handleUpdateClientRemote = async () => {
    if (!cForm.name.trim() || !edit.data?.id) return
    if (cForm.siret && !/^\d{14}$/.test(cForm.siret)) {
      showNotification("Le SIRET doit contenir exactement 14 chiffres", "error")
      return
    }

    try {
      await clientService.update(edit.data.id, buildCustomerPayload(cForm, edit.data))
      await loadFacturationData(userRole, userSettings.email || email)
      closeModal('client')
      showNotification("Client modifié", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de modifier le client"), "error")
    }
  }

  const handleDeleteClientRemote = async (id, name) => {
    if (!window.confirm(orders.filter(o => o.client === name).length ? "Ce client a des commandes. Supprimer ?" : "Supprimer ce client ?")) {
      return
    }

    try {
      await clientService.delete(id)
      await loadFacturationData(userRole, userSettings.email || email)
      showNotification("Client supprim?", "warning")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de supprimer le client"), "error")
    }
  }

  const handleAddOrderRemote = async () => {
    if (!oForm.client || oForm.items.some(i => !i.product)) {
      showNotification("Veuillez sélectionner un client et au moins un produit", "error")
      return;
    }
    try {
      const orderPayload = {
        type: 'vente',
        customer: oForm.client,
        items: oForm.items.map(i => ({
          product: i.product,
          quantity: parseInt(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || 0
        })),
        expectedDate: oForm.expectedDate || null,
        notes: oForm.notes || ""
      }
      await orderService.create(orderPayload)
      await loadFacturationData(userRole, userSettings.email || email)
      closeModal('order')
      showNotification("Commande créée avec succès", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de créer la commande"), "error")
    }
  }

  const handleUpdateOrderRemote = async () => {
    if (!oForm.client || oForm.items.some(i => !i.product) || !edit.data?.id) {
      showNotification("Veuillez sélectionner un client et au moins un produit", "error")
      return;
    }
    try {
      const orderPayload = {
        expectedDate: oForm.expectedDate || null,
        notes: oForm.notes || "",
        items: oForm.items.map(i => ({
          product: i.product,
          quantity: parseInt(i.quantity) || 1,
          unitPrice: parseFloat(i.unitPrice) || 0
        }))
      }
      await orderService.update(edit.data.backendId || edit.data.id, orderPayload)
      await loadFacturationData(userRole, userSettings.email || email)
      closeModal('order')
      showNotification("Commande modifiée avec succès", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de modifier la commande"), "error")
    }
  }

  const handleDeleteOrderRemote = async (order) => {
    if (!order || !window.confirm("Supprimer cette commande ?")) return

    try {
      await orderService.delete(order.backendId || order.id)
      await loadFacturationData(userRole, userSettings.email || email)
      showNotification("Commande supprim?e", "warning")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de supprimer la commande"), "error")
    }
  }

  const handleAddReportRemote = async () => {
    if (!rForm.title.trim() || !rForm.description.trim()) return

    try {
      await reportService.create({
        title: rForm.title,
        description: rForm.description,
        type: rForm.type,
        tags: ['source:facturation']
      })
      await loadFacturationData(userRole, userSettings.email || email)
      closeModal('report')
      showNotification("Rapport ajout?", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible d'ajouter le rapport"), "error")
    }
  }

  const handleUpdateReportRemote = async () => {
    if (!rForm.title.trim() || !rForm.description.trim() || !edit.data?.id) return

    try {
      await reportService.update(edit.data.id, {
        title: rForm.title,
        description: rForm.description,
        type: rForm.type
      })
      await loadFacturationData(userRole, userSettings.email || email)
      closeModal('report')
      showNotification("Rapport modifi?", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de modifier le rapport"), "error")
    }
  }

  const handleDeleteReportRemote = async (id, title) => {
    if (!window.confirm(`Supprimer le rapport "${title}" ?`)) return

    try {
      await reportService.delete(id)
      await loadFacturationData(userRole, userSettings.email || email)
      showNotification("Rapport supprim?", "warning")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de supprimer le rapport"), "error")
    }
  }

  const handleDownloadReportRemote = async (report) => {
    try {
      await reportService.generatePdf(report.id || report.backend?._id)
      showNotification("Rapport t?l?charg?", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de t?l?charger le rapport"), "error")
    }
  }

  const handleGenerateInvoiceRemote = async (order) => {
    if (!order?.customerId) {
      showNotification("Impossible de générer : client introuvable sur cette commande", "error")
      return
    }
    const backendItems = order?.backend?.items
    if (!Array.isArray(backendItems) || backendItems.length === 0) {
      showNotification("Impossible de générer : la commande ne contient aucun article", "error")
      return
    }
    try {
      const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      const items = backendItems.map(item => ({
        product: item.product?._id || item.product,
        description: item.description || item.product?.name || 'Article',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: item.taxRate || 20,
        discount: item.discount || 0
      }))
      await invoiceService.create({
        customer: order.customerId,
        items,
        dueDate,
        orderId: order.id,
        notes: `Facture générée depuis la commande ${order.id}`
      })
      await loadFacturationData(userRole, userSettings.email || email)
      showNotification(`Facture créée pour la commande ${order.id}`, "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de générer la facture"), "error")
    }
  }

  const handleMarkAsPaidRemote = async (invoice) => {
    try {
      await invoiceService.markAsPaid(invoice.backendId || invoice.id, {
        paymentMethod: "virement",
        amount: Number(invoice.amount) || 0,
        reference: `UI-${invoice.id}`
      })
      await loadFacturationData(userRole, userSettings.email || email)
      showNotification("Facture marqu?e pay?e", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de marquer la facture comme pay?e"), "error")
    }
  }

  const ARCHIVE_LS_KEY = 'erp_facturation_archives'
  const getArchivedInvoices = () => { try { return JSON.parse(localStorage.getItem(ARCHIVE_LS_KEY) || '[]') } catch { return [] } }
  const saveArchivedInvoices = (archives) => localStorage.setItem(ARCHIVE_LS_KEY, JSON.stringify(archives))

  const handleArchiveInvoiceRemote = async (invoice) => {
    if (!invoice) return
    const archives = getArchivedInvoices()
    const entry = {
      id: Date.now(),
      invoiceId: invoice.id,
      backendId: invoice.backendId,
      client: invoice.client,
      amount: invoice.amount,
      date: invoice.date,
      archivedDate: new Date().toISOString(),
      archivedBy: userSettings.firstName || 'admin_facture',
      reason: 'Archivage manuel',
      reference: `ARCH-${new Date().getFullYear()}-${String(Math.floor(Math.random()*1000)).padStart(3,'0')}`
    }
    archives.unshift(entry)
    saveArchivedInvoices(archives)
    setArchiveLog(archives)
    await loadFacturationData(userRole, userSettings.email || email)
    showNotification(`Facture ${invoice.id} archivée`, "success")
  }

  const handleRestoreInvoiceRemote = async (entry) => {
    const archivedDate = new Date(entry.archivedDate)
    const now = new Date()
    const daysSince = Math.floor((now - archivedDate) / (1000 * 60 * 60 * 24))
    if (daysSince > 7) {
      showNotification(`Restauration impossible : archivée depuis ${daysSince} jours (max 7 jours)`, "error")
      return
    }
    const archives = getArchivedInvoices().filter(a => a.id !== entry.id)
    saveArchivedInvoices(archives)
    setArchiveLog(archives)
    showNotification(`Facture ${entry.invoiceId} restaurée`, "success")
  }

  const handleDownloadInvoiceRemote = async (invoice) => {
    try {
      await invoiceService.downloadPdf(invoice.backendId || invoice.id)
      showNotification("Facture telechargé", "success")
    } catch (error) {
      showNotification(extractApiErrorMessage(error, "Impossible de t?l?charger la facture"), "error")
    }
  }

  // ===== FILTRES =====
  const filteredOrders = useMemo(()=>orders.filter(o=>(!filters.date.start||o.date>=filters.date.start)&&(!filters.date.end||o.date<=filters.date.end)&&(!filters.search||o.id.toLowerCase().includes(filters.search.toLowerCase())||o.client.toLowerCase().includes(filters.search.toLowerCase()))),[orders,filters])
  const filteredClients = useMemo(()=>clients.filter(c=>!filters.search||c.name.toLowerCase().includes(filters.search.toLowerCase())||c.email.toLowerCase().includes(filters.search.toLowerCase())||c.siret.includes(filters.search)),[clients,filters.search])
  const archivedInvoiceIds = useMemo(()=>new Set(archiveLog.map(a=>a.invoiceId)),[archiveLog])
  const filteredInvoices = useMemo(()=>invoices.filter(i=>!archivedInvoiceIds.has(i.id)&&(!filters.search||i.id.toLowerCase().includes(filters.search.toLowerCase())||i.client.toLowerCase().includes(filters.search.toLowerCase())||i.orderId.toLowerCase().includes(filters.search.toLowerCase()))).sort((a,b)=>new Date(b.date)-new Date(a.date)),[invoices,filters.search,archivedInvoiceIds])
  const filteredReports = useMemo(()=>reports.filter(r=>!filters.search||r.title.toLowerCase().includes(filters.search.toLowerCase())).sort((a,b)=>new Date(b.date)-new Date(a.date)),[reports,filters.search])
  const filteredArchiveLog = useMemo(()=>archiveLog.filter(e=>(!archiveFilters.search||(e.invoiceId||'').toLowerCase().includes(archiveFilters.search.toLowerCase())||(e.client||'').toLowerCase().includes(archiveFilters.search.toLowerCase())||(e.reference||'').toLowerCase().includes(archiveFilters.search.toLowerCase()))&&(archiveFilters.year==="all"||(e.archivedDate||'').startsWith(archiveFilters.year))).sort((a,b)=>new Date(b.archivedDate||0)-new Date(a.archivedDate||0)),[archiveLog,archiveFilters])

  // ===== COMPOSANT INTERNE =====
  const NavItem = ({k,i,l,c}) => (
    <button className={`nav-item ${tab===k?"active":""}`} onClick={()=>{setTab(k); setFilters(p=>({...p,search:""})); setShowArchive(false)}}>
      <span className="nav-icon">{i}</span><span>{l}</span>{c!==undefined&&<span className="nav-count">{c}</span>}
    </button>
  )

  if(loading || checking) return <div className="facture-loading"><div className="spinner"></div><p>Chargement...</p></div>
  if(blocked) return <ModuleDisabledView accentColor="#f59e0b" moduleLabel="Facturation" />

  // ===== RENDU PRINCIPAL =====
  return (
    <div className="facture-container">
      {notification.show&&<div className={`notification ${notification.type}`}>{notification.message}</div>}
      
      <div className="facture-sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <div className="logo-icon"><svg width="32" height="32" viewBox="0 0 32 32" fill="none"><rect width="32" height="32" rx="8" fill="#f59e0b"/><path d="M8 16L12 20L20 12" stroke="white" strokeWidth="3" strokeLinecap="round"/></svg></div>
            <div><h1>ERP FACTURE</h1><p>Gestion comptable</p></div>
          </div>
          <span className="role-badge">COMPTABLE</span>
        </div>

        <div className="user-profile">
          <div className="avatar">{userSettings.firstName?.charAt(0).toUpperCase() || "C"}</div>
          <div className="user-info">
            <div className="user-name">{userSettings.firstName} {userSettings.lastName}</div>
            <div className="user-email">{userSettings.email || "compta@erp.com"}</div>
            {userSettings.department && <div className="user-department" style={{fontSize:"0.7rem",color:"#a0aec0"}}>{userSettings.department}</div>}
          </div>
        </div>

        <nav className="sidebar-nav">
          {userRole==='admin_principal' && <button className="router-button" onClick={()=>nav('/admin')} style={{background:'#f59e0b',color:'white',border:'none',borderRadius:'5px',padding:'8px 12px',margin:'0 15px 10px 15px',cursor:'pointer',display:'flex',alignItems:'center',gap:'8px',width:'calc(100% - 30px)'}}><span>👑</span> Admin Principal</button>}
          <button className="nav-item" onClick={()=>nav("/facturation/dashboard")}><span className="nav-icon">📊</span><span>Dashboard Facturation</span></button>
          <NavItem k={C.TABS.ORDERS} i="📦" l="Commandes" c={stats.totalOrders} />
          <NavItem k={C.TABS.CLIENTS} i="👥" l="Clients" c={stats.totalClients} />
          <NavItem k={C.TABS.INVOICES} i="📄" l="Factures" c={stats.totalInvoices} />
          <NavItem k={C.TABS.REPORTS} i="📈" l="Rapports" c={stats.totalReports} />
          <button className={`nav-item ${tab===C.TABS.ARCHIVE?"active":""}`} onClick={()=>{setTab(C.TABS.ARCHIVE); setArchiveFilters({search:"",year:"all"})}}>
            <span className="nav-icon">📦</span><span>Archive comptable</span><span className="nav-count">{stats.archivedInvoices}</span>
          </button>
          <NavItem k={C.TABS.SETTINGS} i="⚙️" l="Paramètres" />
        </nav>

        <div className="sidebar-footer">
          <button onClick={()=>{clearAuth(); nav("/login")}} className="logout-btn"><span className="nav-icon">🚪</span><span>Déconnexion</span></button>
        </div>
      </div>

      <div className="facture-main">
        <div className="main-header">
          <div>
            <h1 className="welcome-title">Bonjour, <span style={{color:"#f59e0b"}}>{userSettings.firstName || "Comptable"}</span></h1>
            <p className="welcome-subtitle">
              {tab===C.TABS.ORDERS && "Gérez les commandes"}
              {tab===C.TABS.CLIENTS && "Gérez les clients"}
              {tab===C.TABS.INVOICES && "Gérez les factures"}
              {tab===C.TABS.REPORTS && "Créez et gérez vos rapports avec analyses détaillées"}
              {tab===C.TABS.ARCHIVE && "Archive comptable professionnelle"}
              {tab===C.TABS.SETTINGS && "Modifiez vos informations personnelles"}
            </p>
          </div>
          <div className="header-actions">
            <div className="date-box"><span className="date-icon">📅</span>{new Date().toLocaleDateString('fr-FR',C.DATE_OPTIONS)}</div>
            {tab===C.TABS.ORDERS && tab!==C.TABS.SETTINGS && <button className="btn-primary" onClick={()=>openModal('order')}><span>+</span> Nouvelle commande</button>}
            {tab===C.TABS.CLIENTS && tab!==C.TABS.SETTINGS && <button className="btn-primary" onClick={()=>openModal('client')}><span>+</span> Nouveau client</button>}
            {tab===C.TABS.REPORTS && tab!==C.TABS.SETTINGS && <button className="btn-primary" onClick={()=>openModal('report')}><span>+</span> Nouveau rapport</button>}
          </div>
        </div>

        {tab===C.TABS.ORDERS && <div className="orders-content">
          <div className="content-header"><div className="header-left"><h2>📦 Commandes</h2><span className="header-count">{filteredOrders.length}</span></div></div>
          <div className="filters-bar">
            <SearchBar v={filters.search} o={v=>setFilters(p=>({...p,search:v}))} p="Rechercher par N° commande ou client..."/>
            <div className="filter-group"><div className="date-filter"><input type="date" value={filters.date.start} onChange={e=>setFilters(p=>({...p,date:{...p.date,start:e.target.value}}))}/><span>à</span><input type="date" value={filters.date.end} onChange={e=>setFilters(p=>({...p,date:{...p.date,end:e.target.value}}))}/></div></div>
          </div>
          <Table h={["N°","Date","Client","Art.","Total","Statut","Paiement","Facture","Actions"]} r={filteredOrders} rn={o=><tr key={o.id}><td className="order-number">{o.id}</td><td>{utils.formatDate(o.date)}</td><td className="client-name">{o.client}</td><td>{o.items}</td><td className="amount">{utils.formatCurrency(o.total)}</td><td><StatusBadge status={o.status}/></td><td><StatusBadge status={o.paymentStatus}/></td><td>{o.invoiceId?<span className="invoice-linked">✅ {o.invoiceId}</span>:<button className="btn-small btn-warning" onClick={()=>handleGenerateInvoiceRemote(o)}>Générer</button>}</td><td><div className="action-buttons"><button className="action-btn" onClick={()=>openModal('order',o)}>✏️</button><button className="action-btn" onClick={()=>handleDeleteOrderRemote(o)}>🗑️</button></div></td></tr>}/>
        </div>}

        {tab===C.TABS.CLIENTS && <div className="clients-content">
          <div className="content-header"><div className="header-left"><h2>👥 Clients</h2><span className="header-count">{filteredClients.length}</span></div></div>
          <div className="search-section"><SearchBar v={filters.search} o={v=>setFilters(p=>({...p,search:v}))} p="Rechercher par nom, email ou SIRET..."/></div>
          <div className="clients-grid">{filteredClients.map(c=><div key={c.id} className="client-card"><div className="client-card-header"><div className="client-avatar">{c.name.charAt(0)}</div><div className="client-basic-info"><h4>{c.name}</h4><p className="client-siret">{c.siret}</p></div><StatusBadge status={c.status}/></div><div className="client-card-body"><div className="client-contact"><p><span>📧</span>{c.email}</p><p><span>📞</span>{c.phone}</p><p><span>📍</span>{c.address}</p></div><div className="client-stats"><div className="client-stat"><span>Cmd</span><strong>{c.totalOrders}</strong></div><div className="client-stat"><span>Total</span><strong>{utils.formatCurrency(c.totalSpent)}</strong></div><div className="client-stat"><span>Dernière</span><strong>{utils.formatDate(c.lastOrder)}</strong></div></div></div><div className="client-card-footer"><button className="btn-outline" onClick={()=>{setFilters(p=>({...p,search:c.name})); setTab(C.TABS.ORDERS)}}>Voir commandes</button><button className="btn-icon" onClick={()=>openModal('client',c)}>✏️</button><button className="btn-icon" onClick={()=>handleDeleteClientRemote(c.id,c.name)}>🗑️</button></div></div>)}</div>
        </div>}

        {tab===C.TABS.INVOICES && <div className="invoices-content">
          <div className="content-header"><div className="header-left"><h2>📄 Factures</h2><span className="header-count">{filteredInvoices.length}</span></div></div>
          <div className="search-section"><SearchBar v={filters.search} o={v=>setFilters(p=>({...p,search:v}))} p="Rechercher par N° facture, client ou commande..."/></div>
          <Table h={["N°","Date","Commande","Client","Montant","Statut","Échéance","Archive","Actions"]} r={filteredInvoices} rn={i=><tr key={i.id} className={i.archived?"archived-row":""}><td className="invoice-number">{i.id}</td><td>{utils.formatDate(i.date)}</td><td className="order-id">{i.orderId}</td><td className="client-name">{i.client}</td><td className="amount">{utils.formatCurrency(i.amount)}</td><td><StatusBadge status={i.status}/></td><td className={new Date(i.dueDate)<new Date()&&i.status!=="payée"&&i.status!=="archivée"?"text-danger":""}>{utils.formatDate(i.dueDate)}{i.archived&&i.retentionDate&&<small className="retention-info">(Conservée jusqu'au {utils.formatDate(i.retentionDate)})</small>}</td><td>{i.archived?<span className="archived-badge" title={`Réf: ${i.archiveRef}`}>📦 Archivée{i.archiveRef&&<small>{i.archiveRef}</small>}</span>:i.status==="payée"&&<button className="btn-small btn-archive" onClick={()=>setArchiveModal({show:true,invoice:i})} title="Archiver">📦 Archiver</button>}</td><td><div className="action-buttons">{i.archived?<button className="action-btn" onClick={()=>handleRestoreInvoiceRemote(i)} title="Restaurer">↩️</button>:i.status!=="payée"&&<button className="action-btn success" onClick={()=>handleMarkAsPaidRemote(i)} title="Marquer payée">💰</button>}<button className="action-btn" title="Télécharger" onClick={()=>handleDownloadInvoiceRemote(i)}>📥</button></div></td></tr>}/>
        </div>}

        {tab===C.TABS.REPORTS && <div className="reports-content">
          <div className="content-header">
            <div className="header-left"><h2>📈 Rapports</h2><span className="header-count">{filteredReports.length}</span></div>
          </div>
          <div className="search-section">
            <SearchBar v={filters.search} o={v=>setFilters(p=>({...p,search:v}))} p="Rechercher par titre..."/>
          </div>
          <div className="reports-grid">
            {filteredReports.map(r=>{
              // Déterminer l'icône en fonction du type
              const getIcon = () => {
                switch(r.type) {
                  case 'financier': return '💰'
                  case 'clients': return '👥'
                  case 'commandes': return '📦'
                  case 'analytique': return '📊'
                  default: return '📈'
                }
              }
              
              return (
                <div key={r.id} className="report-card detailed">
                  <div className="report-card-header">
                    <div className="report-icon-large">{getIcon()}</div>
                    <div className="report-info">
                      <h3>{r.title}</h3>
                      <p className="report-meta">
                        <span className="report-type">{r.type}</span>
                        <span className="report-date">📅 {utils.formatDate(r.date)}</span>
                        <span className="report-author">👤 {r.author}</span>
                      </p>
                    </div>
                  </div>
                  <div className="report-card-body">
                    <p className="report-description">{r.description}</p>
                    {r.stats && (
                      <div className="report-stats-preview">
                        <div className="stat-item">
                          <span className="stat-label">CA Total:</span>
                          <span className="stat-value-small">{utils.formatCurrency(r.stats.totalRevenue)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Taux recouvrement:</span>
                          <span className="stat-value-small">{utils.formatPercentage(r.stats.paidRatio)}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Meilleur client:</span>
                          <span className="stat-value-small">{r.stats.topClient?.name}</span>
                        </div>
                        <div className="stat-item">
                          <span className="stat-label">Paiements retard:</span>
                          <span className="stat-value-small">{r.stats.latePayments}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="report-card-footer">
                    <button className="btn-outline" onClick={()=>handleViewReport(r)}>👁️ Voir détails</button>
                    <button className="btn-outline" onClick={()=>handleDownloadReportRemote(r)}>📥 Télécharger</button>
                    <button className="btn-icon" onClick={()=>openModal('report',r)}>✏️</button>
                    <button className="btn-icon" onClick={()=>handleDeleteReportRemote(r.id,r.title)}>🗑️</button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>}

        {tab===C.TABS.ARCHIVE && <div className="archive-content">
          <div className="archive-header"><h2>📦 Archive comptable</h2></div>
          <div className="archive-filters">
            <SearchBar v={archiveFilters.search} o={v=>setArchiveFilters({...archiveFilters,search:v})} p="Rechercher par facture, client ou référence..."/>
            <select className="archive-year-filter" value={archiveFilters.year} onChange={e=>setArchiveFilters({...archiveFilters,year:e.target.value})}>
              <option value="all">Toutes les années</option>
              {[...new Set(archiveLog.map(e=>e.date.substring(0,4)))].sort().reverse().map(y=><option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="archive-log">
            <h3>Journal des archives</h3>
            <table className="archive-table">
              <thead>
                <tr><th>Référence</th><th>Facture</th><th>Date archivage</th><th>Client</th><th>Montant</th><th>Motif</th><th>Archivé par</th><th>Actions</th></tr>
              </thead>
              <tbody>{filteredArchiveLog.map(e=>{
                const daysSince=Math.floor((new Date()-new Date(e.archivedDate))/(1000*60*60*24))
                const canRestore=daysSince<=7
                return <tr key={e.id}><td><span className="archive-ref">{e.reference}</span></td><td>{e.invoiceId}</td><td>{utils.formatDate(e.archivedDate)}</td><td>{e.client||"-"}</td><td>{utils.formatCurrency(e.amount||0)}</td><td>{e.reason}</td><td>{e.archivedBy}</td><td>{canRestore?<button className="btn-icon" onClick={()=>handleRestoreInvoiceRemote(e)} title="Restaurer (encore possible)">↩️</button>:<span style={{color:'var(--gray-500)',fontSize:'0.8rem'}}>Verrouillé ({daysSince}j)</span>}</td></tr>
              })}</tbody>
            </table>
          </div>
        </div>}

        {tab===C.TABS.SETTINGS && (
          <div className="settings-tab">
            <h2>⚙️ Paramètres du profil</h2>
            
            {settingsMessage.text && <div className={`settings-message ${settingsMessage.type}`}>{settingsMessage.text}</div>}

            <div className="settings-form">
              <div className="settings-section">
                <h3>Informations personnelles</h3>
                <div className="settings-row">
                  <div className="settings-group"><label>Prénom</label><input type="text" name="firstName" value={userSettings.firstName} onChange={handleSettingsChange} placeholder="Votre prénom"/></div>
                  <div className="settings-group"><label>Nom</label><input type="text" name="lastName" value={userSettings.lastName} onChange={handleSettingsChange} placeholder="Votre nom"/></div>
                </div>
                <div className="settings-row">
                  <div className="settings-group"><label>Email</label><input type="email" name="email" value={userSettings.email} onChange={handleSettingsChange} placeholder="votre@email.com"/></div>
                  <div className="settings-group"><label>Téléphone</label><input type="tel" name="phone" value={userSettings.phone} onChange={handleSettingsChange} placeholder=""/></div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Informations professionnelles</h3>
                <div className="settings-row">
                  <div className="settings-group"><label>Département</label><input type="text" name="department" value={userSettings.department} onChange={handleSettingsChange} placeholder="Votre département"/></div>
                  <div className="settings-group"><label>Rôle</label><input type="text" value={userSettings.role} disabled style={{backgroundColor:'#f7fafc',cursor:'not-allowed'}}/><small>Le rôle ne peut pas être modifié</small></div>
                </div>
              </div>

              <div className="settings-section">
                <h3>Changer le mot de passe</h3>
                <p className="settings-hint">Laissez vide si vous ne souhaitez pas changer votre mot de passe</p>
                <div className="settings-group"><label>Mot de passe actuel</label><input type="password" name="currentPassword" value={userSettings.currentPassword} onChange={handleSettingsChange} placeholder=""/></div>
                <div className="settings-row">
                  <div className="settings-group"><label>Nouveau mot de passe</label><input type="password" name="newPassword" value={userSettings.newPassword} onChange={handleSettingsChange} placeholder=""/></div>
                  <div className="settings-group"><label>Confirmer</label><input type="password" name="confirmPassword" value={userSettings.confirmPassword} onChange={handleSettingsChange} placeholder=""/></div>
                </div>
                <small>Minimum 6 caractères</small>
              </div>

              <div className="settings-actions">
                <button className="btn-primary" onClick={handleSaveSettings} disabled={updating} style={{width:'100%',background:"#f59e0b"}}>
                  {updating ? "Mise à jour en cours..." : "Enregistrer les modifications"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modale de visualisation de rapport */}
      {reportModal.show && reportModal.report && (
        <div className="modal-overlay" onClick={()=>setReportModal({ show: false, report: null })}>
          <div className="modal-content modal-large" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h3>{reportModal.report.icon || '📈'} {reportModal.report.title}</h3>
              <button className="modal-close" onClick={()=>setReportModal({ show: false, report: null })}>×</button>
            </div>
            <div className="modal-body">
              <div className="report-view-header">
                <div className="report-meta-info">
                  <span>📅 {utils.formatDate(reportModal.report.date)}</span>
                  <span>📊 Type: {reportModal.report.type}</span>
                  <span>👤 Auteur: {reportModal.report.author}</span>
                </div>
              </div>
              
              <div className="report-description-full">
                <p>{reportModal.report.description}</p>
              </div>
              
              {reportModal.report.stats && (
                <div className="report-stats-detailed">
                  <h4>Indicateurs clés</h4>
                  <div className="stats-detailed-grid">
                    <div className="stat-detailed-card">
                      <div className="stat-detailed-label">Chiffre d'affaires total</div>
                      <div className="stat-detailed-value">{utils.formatCurrency(reportModal.report.stats.totalRevenue)}</div>
                    </div>
                    <div className="stat-detailed-card">
                      <div className="stat-detailed-label">Nombre de factures</div>
                      <div className="stat-detailed-value">{reportModal.report.stats.totalInvoices}</div>
                    </div>
                    <div className="stat-detailed-card">
                      <div className="stat-detailed-label">Taux de recouvrement</div>
                      <div className="stat-detailed-value">{utils.formatPercentage(reportModal.report.stats.paidRatio)}</div>
                    </div>
                    <div className="stat-detailed-card">
                      <div className="stat-detailed-label">Meilleur client</div>
                      <div className="stat-detailed-value">{reportModal.report.stats.topClient?.name}</div>
                      <div className="stat-detailed-sub">{utils.formatCurrency(reportModal.report.stats.topClient?.amount)}</div>
                    </div>
                    <div className="stat-detailed-card">
                      <div className="stat-detailed-label">Panier moyen</div>
                      <div className="stat-detailed-value">{utils.formatCurrency(reportModal.report.stats.avgOrderValue)}</div>
                    </div>
                    <div className="stat-detailed-card">
                      <div className="stat-detailed-label">Paiements en retard</div>
                      <div className="stat-detailed-value">{reportModal.report.stats.latePayments}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={()=>setReportModal({ show: false, report: null })}>Fermer</button>
              <button className="btn-primary" onClick={()=>handleDownloadReportRemote(reportModal.report)}>📥 Télécharger PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'archivage avec simple confirmation - UNE SEULE ÉTAPE */}
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
              <button className="btn-secondary" onClick={()=>setArchiveModal({show:false,invoice:null})}>
                Annuler
              </button>
              <button 
                className="btn-primary" 
                onClick={() => {
                  handleArchiveInvoiceRemote(archiveModal.invoice, "Archivage manuel")
                  setArchiveModal({show:false,invoice:null})
                }}
              >
                Archiver
              </button>
            </div>
          </div>
        </div>
      )}

      {modal.client&&<div className="modal-overlay" onClick={()=>closeModal('client')}><div className="modal-content" onClick={e=>e.stopPropagation()}><div className="modal-header"><h3>{edit.type==='client'?'✏️ Modifier':'➕ Nouveau'} client</h3><button className="modal-close" onClick={()=>closeModal('client')}>×</button></div><div className="modal-body"><div className="form-group"><label>Nom *</label><input type="text" value={cForm.name} onChange={e=>setCForm({...cForm,name:e.target.value})}/></div><div className="form-row"><div className="form-group"><label>Email</label><input type="email" value={cForm.email} onChange={e=>setCForm({...cForm,email:e.target.value})}/></div><div className="form-group"><label>Tél</label><input type="tel" value={cForm.phone} onChange={e=>setCForm({...cForm,phone:e.target.value})}/></div></div><div className="form-group"><label>Adresse</label><input type="text" value={cForm.address} onChange={e=>setCForm({...cForm,address:e.target.value})}/></div><div className="form-row"><div className="form-group"><label>SIRET</label><input type="text" value={cForm.siret} maxLength="14" onChange={e=>setCForm({...cForm,siret:e.target.value})}/><small style={{display:'block',marginTop:'4px',color:'var(--gray-500)',fontSize:'0.75rem'}}>14 chiffres requis</small></div><div className="form-group"><label>Statut</label><select value={cForm.status} onChange={e=>setCForm({...cForm,status:e.target.value})}>{C.CLIENT_STATUSES.map(s=><option key={s} value={s}>{s}</option>)}</select></div></div></div><div className="modal-footer"><button className="btn-secondary" onClick={()=>closeModal('client')}>Annuler</button><button className="btn-primary" onClick={edit.type==='client'?handleUpdateClientRemote:handleAddClientRemote}>{edit.type==='client'?'Modifier':'Créer'}</button></div></div></div>}

      {modal.order&&<div className="modal-overlay" onClick={()=>closeModal('order')}>
        <div className="modal-content modal-large" onClick={e=>e.stopPropagation()}>
          <div className="modal-header">
            <h3>{edit.type==='order'?'✏️ Modifier':'➕ Nouvelle'} commande</h3>
            <button className="modal-close" onClick={()=>closeModal('order')}>×</button>
          </div>
          <div className="modal-body" style={{maxHeight:'65vh', overflowY:'auto'}}>
            <div className="form-group">
              <label>Client *</label>
              {edit.type==='order' ? (
                <input type="text" value={clients.find(c=>String(c.id)===String(oForm.client))?.name || (typeof oForm.client === 'string' ? oForm.client : 'Client...')} disabled />
              ) : (
                <select value={oForm.client} onChange={e=>setOForm({...oForm,client:e.target.value})}>
                  <option value="">Sélectionner un client</option>
                  {clients.filter(c=>c.status==="actif").map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              )}
            </div>

            <div className="form-group">
              <label>Articles *</label>
              <div style={{border:'1px solid var(--gray-200)', borderRadius:'var(--radius)', overflow:'hidden'}}>
                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'0.9rem'}}>
                  <thead>
                    <tr style={{background:'var(--gray-50)'}}>
                      <th style={{padding:'10px 12px', textAlign:'left', fontWeight:600, fontSize:'0.8rem', color:'var(--gray-500)'}}>Produit</th>
                      <th style={{padding:'10px 12px', textAlign:'center', fontWeight:600, fontSize:'0.8rem', color:'var(--gray-500)', width:'80px'}}>Qté</th>
                      <th style={{padding:'10px 12px', textAlign:'center', fontWeight:600, fontSize:'0.8rem', color:'var(--gray-500)', width:'110px'}}>Prix U.</th>
                      <th style={{padding:'10px 12px', textAlign:'right', fontWeight:600, fontSize:'0.8rem', color:'var(--gray-500)', width:'100px'}}>Sous-total</th>
                      <th style={{width:'40px'}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {oForm.items.map((item, idx) => (
                      <tr key={idx} style={{borderTop:'1px solid var(--gray-200)'}}>
                        <td style={{padding:'8px 12px'}}>
                          <select value={item.product} onChange={e=>{const prod=products.find(p=>String(p.id)===e.target.value);const ni=[...oForm.items];ni[idx]={...ni[idx],product:e.target.value,unitPrice:prod?prod.price:item.unitPrice};setOForm({...oForm,items:ni})}} style={{width:'100%', padding:'8px', border:'1px solid var(--gray-200)', borderRadius:'var(--radius)', fontSize:'0.85rem'}}>
                            <option value="">Choisir...</option>
                            {products.filter(p=>p.status!=='inactif').map(p=><option key={p.id} value={p.id}>{p.name} ({p.stock})</option>)}
                          </select>
                        </td>
                        <td style={{padding:'8px 6px', textAlign:'center'}}>
                          <input type="number" min="1" value={item.quantity} onChange={e=>{const ni=[...oForm.items];ni[idx].quantity=e.target.value;setOForm({...oForm,items:ni})}} style={{width:'100%', padding:'8px', border:'1px solid var(--gray-200)', borderRadius:'var(--radius)', textAlign:'center', fontSize:'0.85rem'}}/>
                        </td>
                        <td style={{padding:'8px 6px', textAlign:'center'}}>
                          <input type="number" step="0.01" value={item.unitPrice} onChange={e=>{const ni=[...oForm.items];ni[idx].unitPrice=e.target.value;setOForm({...oForm,items:ni})}} style={{width:'100%', padding:'8px', border:'1px solid var(--gray-200)', borderRadius:'var(--radius)', textAlign:'right', fontSize:'0.85rem'}}/>
                        </td>
                        <td style={{padding:'8px 12px', textAlign:'right', fontWeight:600, fontSize:'0.85rem'}}>
                          {utils.formatCurrency((parseFloat(item.quantity)||0)*(parseFloat(item.unitPrice)||0))}
                        </td>
                        <td style={{padding:'8px 6px', textAlign:'center'}}>
                          {oForm.items.length>1&&<button onClick={e=>{e.preventDefault();setOForm({...oForm,items:oForm.items.filter((_,i)=>i!==idx)})}} style={{background:'none', border:'none', cursor:'pointer', color:'var(--danger)', fontSize:'1rem', padding:'4px'}}>🗑️</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{padding:'10px 12px', borderTop:'1px solid var(--gray-200)', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <button className="btn-outline" onClick={e=>{e.preventDefault();setOForm({...oForm,items:[...oForm.items,{product:"",quantity:1,unitPrice:0}]})}} style={{fontSize:'0.8rem', padding:'6px 12px'}}>+ Ajouter un produit</button>
                  <div style={{fontWeight:700, fontSize:'1rem'}}>Total TTC : <span style={{color:'var(--success)'}}>{utils.formatCurrency(oForm.items.reduce((s,i)=>s+((parseFloat(i.quantity)||0)*(parseFloat(i.unitPrice)||0)),0)*1.2)}</span></div>
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
              <textarea rows="2" value={oForm.notes} onChange={e=>setOForm({...oForm,notes:e.target.value})} placeholder="Instructions spéciales pour la commande..."></textarea>
            </div>
          </div>
          <div className="modal-footer">
            <button className="btn-secondary" onClick={()=>closeModal('order')}>Annuler</button>
            <button className="btn-primary" onClick={edit.type==='order'?handleUpdateOrderRemote:handleAddOrderRemote}>{edit.type==='order'?'Modifier':'Créer'}</button>
          </div>
        </div>
      </div>}

      {modal.report&&<div className="modal-overlay" onClick={()=>closeModal('report')}><div className="modal-content" onClick={e=>e.stopPropagation()}><div className="modal-header"><h3>{edit.type==='report'?'✏️ Modifier':'➕ Nouveau'} rapport</h3><button className="modal-close" onClick={()=>closeModal('report')}>×</button></div><div className="modal-body"><div className="form-group"><label>Titre *</label><input type="text" value={rForm.title} onChange={e=>setRForm({...rForm,title:e.target.value})} placeholder="Ex: Rapport financier mensuel"/></div><div className="form-group"><label>Description *</label><textarea value={rForm.description} onChange={e=>setRForm({...rForm,description:e.target.value})} placeholder="Description détaillée..." rows="4"/></div><div className="form-group"><label>Type</label><select value={rForm.type} onChange={e=>setRForm({...rForm,type:e.target.value})}>{C.REPORT_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div></div><div className="modal-footer"><button className="btn-secondary" onClick={()=>closeModal('report')}>Annuler</button><button className="btn-primary" onClick={edit.type==='report'?handleUpdateReportRemote:handleAddReportRemote} disabled={!rForm.title.trim()||!rForm.description.trim()}>{edit.type==='report'?'Modifier':'Créer'}</button></div></div></div>}
    </div>
  )
}





