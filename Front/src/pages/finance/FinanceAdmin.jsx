// src/pages/finance/FinanceAdmin.jsx
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, getUserEmail, getUserRole, isAuthenticated } from "../../utils/auth";
import ModuleDisabledView from "../../components/ModuleDisabledView";
import { useModuleAvailability } from "../../hooks/useModuleAvailability";
import userService from "../../services/userService";
import { accountService } from "../../services/accountService";
import { transactionService } from "../../services/transactionService";
import { budgetService } from "../../services/budgetService";
import { reportService } from "../../services/reportService";
import {
  extractApiErrorMessage,
  mapAccountToUi,
  mapBudgetToUi,
  mapReportToUi,
  mapTransactionToUi,
  pickList,
} from "../../utils/frontendApiAdapters";
import "./FinanceAdmin.css";

const COLORS = {
  success: "#48bb78", warning: "#ed8936", danger: "#f56565", muted: "#718096",
  successBg: "#c6f6d5", warningBg: "#feebc8", dangerBg: "#fed7d7",
  mutedBg: "#edf2f7", defaultBg: "#e2e8f0"
};
const STATUS_CONFIG = {
  "complété": { color: COLORS.success, bg: COLORS.successBg },
  "en attente": { color: COLORS.warning, bg: COLORS.warningBg },
  "en retard": { color: COLORS.danger, bg: COLORS.dangerBg },
  "respecté": { color: COLORS.success, bg: COLORS.successBg },
  "dépassé": { color: COLORS.danger, bg: COLORS.dangerBg },
  "actif": { color: COLORS.success, bg: COLORS.successBg },
  "inactif": { color: COLORS.muted, bg: COLORS.mutedBg }
};
const getStatusStyle = (status) => STATUS_CONFIG[status] || { color: COLORS.muted, bg: COLORS.defaultBg };
const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
};

const INITIAL_DATA = {
  transactions: [
    { id: "TRX-2026-001", date: "2026-02-10", description: "Vente SARL Dupont", category: "Vente", amount: 1250.00, type: "revenu", status: "complété", account: "Compte courant" },
    { id: "TRX-2026-002", date: "2026-02-10", description: "Achat fournitures bureau", category: "Achat", amount: -450.00, type: "dépense", status: "complété", account: "Compte courant" },
    { id: "TRX-2026-003", date: "2026-02-11", description: "Facture EURL Martin", category: "Vente", amount: 890.50, type: "revenu", status: "en attente", account: "Compte client" },
    { id: "TRX-2026-004", date: "2026-02-11", description: "Loyer local", category: "Loyer", amount: -1200.00, type: "dépense", status: "complété", account: "Compte courant" },
    { id: "TRX-2026-005", date: "2026-02-12", description: "Facture SAS Tech", category: "Vente", amount: 2340.00, type: "revenu", status: "complété", account: "Compte courant" },
    { id: "TRX-2026-006", date: "2026-02-12", description: "Salaires", category: "Salaires", amount: -8500.00, type: "dépense", status: "complété", account: "Compte paie" },
    { id: "TRX-2026-007", date: "2026-02-13", description: "Facture Restaurant Le Chef", category: "Vente", amount: 1890.75, type: "revenu", status: "en retard", account: "Compte client" },
    { id: "TRX-2026-008", date: "2026-02-13", description: "Fournisseur électricité", category: "Utilities", amount: -320.00, type: "dépense", status: "complété", account: "Compte courant" },
    { id: "TRX-2026-009", date: "2026-02-14", description: "Facture Cabinet Médical", category: "Vente", amount: 1500.00, type: "revenu", status: "en attente", account: "Compte client" },
    { id: "TRX-2026-010", date: "2026-02-14", description: "Maintenance informatique", category: "Services", amount: -650.00, type: "dépense", status: "complété", account: "Compte courant" },
  ],
  accounts: [
    { id: 1, name: "Compte courant", balance: 45230.50, type: "Banque", number: "FR76 1234 5678 9012 3456", status: "actif", iban: "FR76 1234 5678 9012 3456 7890 123", bic: "CMCIFR2A" },
    { id: 2, name: "Compte épargne", balance: 25000.00, type: "Épargne", number: "FR76 2345 6789 0123 4567", status: "actif", iban: "FR76 2345 6789 0123 4567 8901 234", bic: "CMCIFR2A" },
    { id: 3, name: "Compte client", balance: 12780.25, type: "Créance", number: "CLI-001", status: "actif", iban: "", bic: "" },
    { id: 4, name: "Compte fournisseur", balance: -3450.00, type: "Dette", number: "FR76 3456 7890 1234 5678", status: "actif", iban: "FR76 3456 7890 1234 5678 9012 345", bic: "BNPAFRPP" },
    { id: 5, name: "Compte paie", balance: 15000.00, type: "Banque", number: "FR76 4567 8901 2345 6789", status: "actif", iban: "FR76 4567 8901 2345 6789 0123 456", bic: "SOGEFRPP" },
  ],
  budgets: [
    { id: 1, category: "Salaires", budget: 8500.00, actual: 8500.00, month: "2026-02", status: "respecté", notes: "Budget mensuel salaires" },
    { id: 2, category: "Loyer", budget: 1200.00, actual: 1200.00, month: "2026-02", status: "respecté", notes: "Loyer local commercial" },
    { id: 3, category: "Fournitures", budget: 500.00, actual: 450.00, month: "2026-02", status: "respecté", notes: "Fournitures de bureau" },
    { id: 4, category: "Marketing", budget: 800.00, actual: 950.00, month: "2026-02", status: "dépassé", notes: "Campagne publicitaire" },
    { id: 5, category: "Utilities", budget: 400.00, actual: 320.00, month: "2026-02", status: "respecté", notes: "Électricité, eau, internet" },
  ],
  reports: [
    { id: 1, title: "Rapport financier Février 2026", description: "Analyse complète des performances financières du mois de février", date: "2026-02-28", createdAt: "2026-02-28T10:30:00" },
    { id: 2, title: "Bilan annuel 2025", description: "Résumé des activités et résultats de l'année 2025", date: "2026-01-15", createdAt: "2026-01-15T14:20:00" },
    { id: 3, title: "Prévisions trimestrielles Q2 2026", description: "Projections financières pour le deuxième trimestre 2026", date: "2026-03-01", createdAt: "2026-03-01T09:15:00" },
  ]
};

const EMPTY_FORMS = {
  transaction: {
    description: "", amount: "", type: "revenu", category: "Vente", account: "",
    date: new Date().toISOString().split('T')[0], status: "complété", notes: ""
  },
  account: { name: "", type: "Banque", number: "", iban: "", bic: "", balance: "", status: "actif" },
  budget: { category: "", budget: "", month: new Date().toISOString().slice(0, 7), notes: "" },
  report: { title: "", description: "", date: new Date().toISOString().split('T')[0] }
};

const Pagination = ({ total, pagination, setPagination }) => {
  const totalPages = Math.ceil(total / pagination.itemsPerPage);
  const start = total > 0 ? (pagination.currentPage - 1) * pagination.itemsPerPage + 1 : 0;
  const end = Math.min(pagination.currentPage * pagination.itemsPerPage, total);
  return (
    <div className="pagination">
      <span className="pagination-info">{total > 0 ? `${start}-${end} sur ${total}` : "0 élément"}</span>
      <div className="pagination-controls">
        <button className="pagination-btn" onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}
          disabled={pagination.currentPage === 1}>←</button>
        {[...Array(totalPages)].map((_, i) => {
          const page = i + 1;
          const show = page === 1 || page === totalPages || (page >= pagination.currentPage - 2 && page <= pagination.currentPage + 2);
          if (show) return (
            <button key={page} className={`pagination-btn ${pagination.currentPage === page ? "active" : ""}`}
              onClick={() => setPagination(p => ({ ...p, currentPage: page }))}>{page}</button>
          );
          if (page === pagination.currentPage - 3 || page === pagination.currentPage + 3)
            return <span key={page} className="pagination-dots">...</span>;
          return null;
        })}
        <button className="pagination-btn" onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(totalPages, p.currentPage + 1) }))}
          disabled={pagination.currentPage === totalPages || total === 0}>→</button>
      </div>
      <select className="pagination-limit" value={pagination.itemsPerPage}
        onChange={(e) => setPagination({ currentPage: 1, itemsPerPage: Number(e.target.value) })}>
        {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v} par page</option>)}
      </select>
    </div>
  );
};

const BudgetSummary = ({ budgets, formatCurrency }) => {
  const totalBudget = budgets.reduce((acc, b) => acc + (b.budget || 0), 0);
  const totalActual = budgets.reduce((acc, b) => acc + (b.actual || 0), 0);
  const variance = totalActual - totalBudget;
  const percentUsed = totalBudget > 0 ? (totalActual / totalBudget) * 100 : 0;
  return (
    <div className="budgets-summary">
      {[
        { label: "Budget total", value: formatCurrency(totalBudget) },
        { label: "Réalisé", value: formatCurrency(totalActual) },
        { label: "Écart", value: formatCurrency(variance), className: variance <= 0 ? "text-success" : "text-danger" },
        { label: "Taux d'exécution", value: `${percentUsed.toFixed(1)}%` }
      ].map((item, i) => (
        <div key={i} className="budget-summary-card">
          <span>{item.label}</span>
          <strong className={item.className}>{item.value}</strong>
        </div>
      ))}
    </div>
  );
};

// Report View Modal
const ReportViewModal = ({ report, onClose, formatDate, formatDateTime }) => {
  if (!report) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: "600px" }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>👁️ Contenu du rapport</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontWeight: 600, color: "#4a5568", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Titre</label>
            <p style={{ fontSize: "1.1rem", fontWeight: 700, color: "#2d3748", margin: "4px 0 0" }}>{report.title}</p>
          </div>
          <div style={{ marginBottom: "16px" }}>
            <label style={{ fontWeight: 600, color: "#4a5568", fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Description</label>
            <p style={{ color: "#4a5568", margin: "4px 0 0", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{report.description || <em style={{ color: "#a0aec0" }}>Aucune description</em>}</p>
          </div>
          <div style={{ display: "flex", gap: "24px", padding: "12px", background: "#f7fafc", borderRadius: "8px" }}>
            <div>
              <label style={{ fontWeight: 600, color: "#4a5568", fontSize: "0.75rem", textTransform: "uppercase" }}>Date du rapport</label>
              <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{formatDate(report.date)}</p>
            </div>
            <div>
              <label style={{ fontWeight: 600, color: "#4a5568", fontSize: "0.75rem", textTransform: "uppercase" }}>Créé le</label>
              <p style={{ margin: "2px 0 0", fontWeight: 600 }}>{formatDateTime(report.createdAt)}</p>
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
};

// PDF Export Helper
const exportReportToPDF = (report, formatDate, formatDateTime) => {
  // Build a minimal printable HTML page and use the browser's print-to-PDF
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8"/>
  <title>${report.title}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 720px; margin: 40px auto; color: #2d3748; }
    h1 { font-size: 1.6rem; border-bottom: 2px solid #4299e1; padding-bottom: 10px; color: #2b6cb0; }
    .meta { display: flex; gap: 32px; margin: 16px 0 24px; padding: 12px; background: #f7fafc; border-radius: 8px; }
    .meta div label { font-size: 0.75rem; text-transform: uppercase; color: #718096; font-weight: 600; }
    .meta div p { margin: 2px 0 0; font-weight: 700; }
    .description-label { font-size: 0.8rem; text-transform: uppercase; color: #718096; font-weight: 600; }
    .description { margin-top: 8px; line-height: 1.7; white-space: pre-wrap; }
    .footer { margin-top: 40px; border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 0.8rem; color: #a0aec0; }
  </style>
</head>
<body>
  <h1>📄 ${report.title}</h1>
  <div class="meta">
    <div><label>Date du rapport</label><p>${formatDate(report.date)}</p></div>
    <div><label>Créé le</label><p>${formatDateTime(report.createdAt)}</p></div>
  </div>
  <div class="description-label">Description</div>
  <div class="description">${report.description || "Aucune description fournie."}</div>
  <div class="footer">Exporté depuis ERP Finance — ${new Date().toLocaleDateString('fr-FR')}</div>
  <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
};

function FinanceAdmin() {
  const navigate = useNavigate();
  const { blocked, checking } = useModuleAvailability("finance");
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userRole, setUserRole] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transactions");
  const [modal, setModal] = useState({ isOpen: false, type: "", item: null, mode: "add" });
  const [filters, setFilters] = useState({ search: "", type: "tous", status: "tous", category: "tous", account: "tous", dateRange: { start: "", end: "" } });
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 10 });
  const [sort, setSort] = useState({ key: "date", direction: "desc" });
  const [notification, setNotification] = useState({ show: false, message: "", type: "" });
  const [userSettings, setUserSettings] = useState({
    firstName: '', lastName: '', email: '', phone: '', department: '', role: '',
    currentPassword: '', newPassword: '', confirmPassword: ''
  });
  const [settingsMessage, setSettingsMessage] = useState({ type: "", text: "" });
  const [updating, setUpdating] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [reports, setReports] = useState([]);
  const [formData, setFormData] = useState({
    transaction: { ...EMPTY_FORMS.transaction },
    account: { ...EMPTY_FORMS.account },
    budget: { ...EMPTY_FORMS.budget },
    report: { ...EMPTY_FORMS.report }
  });

  // Report view state
  const [viewReport, setViewReport] = useState(null);

  const showNotif = (message, type = "success") => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: "", type: "" }), 3000);
  };
  const resetFilters = () => {
    setFilters({ search: "", type: "tous", status: "tous", category: "tous", account: "tous", dateRange: { start: "", end: "" } });
    setPagination(p => ({ ...p, currentPage: 1 }));
  };
  const resetForm = (type) => setFormData(p => ({ ...p, [type]: { ...EMPTY_FORMS[type] } }));
  const formatCurrency = (amount) => (amount || 0).toLocaleString('fr-FR', FORMAT_OPTIONS.currency);
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('fr-FR', FORMAT_OPTIONS.date) : "";
  const formatDateTime = (d) => d ? new Date(d).toLocaleString('fr-FR', FORMAT_OPTIONS.datetime) : "";

  const applyProfileState = (profile, fallbackRole, fallbackEmail) => {
    const resolvedEmail = profile?.email || fallbackEmail || "";
    const resolvedRole = profile?.role || fallbackRole || "admin_finance";
    const firstName = profile?.firstName || "Gestionnaire";
    const lastName = profile?.lastName || "Finance";

    setUserEmail(resolvedEmail);
    setUserName(firstName || resolvedEmail?.split('@')[0] || "Finance");
    setUserSettings({
      firstName,
      lastName,
      email: resolvedEmail,
      phone: profile?.phone || "",
      department: profile?.department || "Finance",
      role: resolvedRole,
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });
  };

  const loadFinanceData = async (fallbackRole = userRole, fallbackEmail = userEmail) => {
    const [profileResponse, transactionsResponse, accountsResponse, budgetsResponse, reportsResponse] = await Promise.all([
      userService.getProfile(),
      transactionService.getAll({ limit: 200 }),
      accountService.getAll({ limit: 200 }),
      budgetService.getAll({ limit: 200 }),
      reportService.getAll({ limit: 200 }),
    ]);

    const profile = profileResponse?.data || profileResponse;
    applyProfileState(profile, fallbackRole, fallbackEmail);
    setTransactions(pickList(transactionsResponse, ['data']).map(mapTransactionToUi));
    setAccounts(pickList(accountsResponse, ['data']).map(mapAccountToUi));
    setBudgets(pickList(budgetsResponse, ['data']).map(mapBudgetToUi));
    setReports(
      pickList(reportsResponse, ['data'])
        .filter(report => {
          const tags = report.tags || []
          return tags.length === 0 || tags.includes('source:finance')
        })
        .map((report) => mapReportToUi(report, "📄"))
    );
  };

  useEffect(() => {
    const role = getUserRole();
    const email = getUserEmail();
    const allowedRoles = ["admin_finance", "admin_principal"];
    if (!isAuthenticated() || !allowedRoles.includes(role)) {
      navigate("/login");
      return;
    }

    setUserRole(role);

    const init = async () => {
      try {
        await loadFinanceData(role, email);
      } catch (error) {
        setSettingsMessage({
          type: "error",
          text: extractApiErrorMessage(error, "Impossible de charger les donnees finance")
        });
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  const handleDashboardClick = () => navigate("/finance/dashboard");
  const handleRouterClick = () => {
    if (userRole === 'admin_principal') navigate('/admin');
    else window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleSettingsChange = (e) => setUserSettings({ ...userSettings, [e.target.name]: e.target.value });

  const handleSaveSettings = async () => {
    if (!userSettings.firstName || !userSettings.lastName || !userSettings.email) {
      setSettingsMessage({ type: "error", text: "Champs obligatoires manquants" }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userSettings.email)) {
      setSettingsMessage({ type: "error", text: "Format d'email invalide" }); return;
    }
    if (userSettings.phone && !/^[0-9+\-\s]+$/.test(userSettings.phone)) {
      setSettingsMessage({ type: "error", text: "Format de téléphone invalide" }); return;
    }
    const changingPassword = userSettings.newPassword || userSettings.confirmPassword || userSettings.currentPassword;
    if (changingPassword) {
      if (!userSettings.currentPassword) {
        setSettingsMessage({ type: "error", text: "Veuillez entrer votre mot de passe actuel" }); return;
      }
      if (userSettings.newPassword !== userSettings.confirmPassword) {
        setSettingsMessage({ type: "error", text: "Les nouveaux mots de passe ne correspondent pas" }); return;
      }
      if (userSettings.newPassword.length < 6) {
        setSettingsMessage({ type: "error", text: "Le nouveau mot de passe doit contenir au moins 6 caractères" }); return;
      }
    }
    setUpdating(true);
    setSettingsMessage({ type: "info", text: "Mise à jour en cours..." });
    try {
      await userService.updateProfile({
        firstName: userSettings.firstName,
        lastName: userSettings.lastName,
        email: userSettings.email,
        phone: userSettings.phone,
        department: userSettings.department
      });
      if (changingPassword) {
        await userService.changePassword(userSettings.currentPassword, userSettings.newPassword);
      }

      await loadFinanceData(userRole, userSettings.email);
      setSettingsMessage({ type: "success", text: "Profil mis à jour avec succès !" });
      setTimeout(() => setSettingsMessage({ type: "", text: "" }), 2000);
    } catch (error) {
      setSettingsMessage({
        type: "error",
        text: extractApiErrorMessage(error, "Impossible de mettre a jour le profil")
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => { clearAuth(); navigate("/login"); };

  const openModal = (type, mode, item = null) => {
    if (item && mode === "edit") {
      const map = {
        transaction: { ...item, amount: Math.abs(item.amount || 0).toString() },
        account: { ...item, balance: (item.balance || 0).toString() },
        budget: { ...item, budget: (item.budget || 0).toString() },
        report: { ...item }
      };
      setFormData(p => ({ ...p, [type]: map[type] }));
    } else if (mode === "add") resetForm(type);
    setModal({ isOpen: true, type, item, mode });
  };

  const closeModal = () => {
    setModal({ isOpen: false, type: "", item: null, mode: "add" });
    if (modal.type) resetForm(modal.type);
  };

  const filteredData = useMemo(() => {
    const dataMap = { transactions, accounts, budgets, reports };
    return (dataMap[activeTab] || []).filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const fields = {
          transactions: [item.description, item.id],
          accounts: [item.name, item.number],
          budgets: [item.category],
          reports: [item.title, item.description]
        }[activeTab];
        if (!fields.some(f => f?.toLowerCase().includes(s))) return false;
      }
      if (activeTab === "transactions") {
        if (filters.type !== "tous" && item.type !== filters.type) return false;
        if (filters.status !== "tous" && item.status !== filters.status) return false;
        if (filters.category !== "tous" && item.category !== filters.category) return false;
        if (filters.account !== "tous" && item.account !== filters.account) return false;
      }
      if (activeTab === "accounts" && filters.type !== "tous" && item.type !== filters.type) return false;
      if (activeTab !== "reports" && filters.status !== "tous" && item.status !== filters.status) return false;
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start) return false;
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end) return false;
      return true;
    });
  }, [activeTab, transactions, accounts, budgets, reports, filters]);

  const sortedData = useMemo(() => [...filteredData].sort((a, b) => {
    let valA = a[sort.key], valB = b[sort.key];
    if (["date", "createdAt"].includes(sort.key)) { valA = new Date(valA || 0); valB = new Date(valB || 0); }
    if (["amount", "budget", "actual", "balance"].includes(sort.key)) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
    return valA < valB ? (sort.direction === "asc" ? -1 : 1) : valA > valB ? (sort.direction === "asc" ? 1 : -1) : 0;
  }), [filteredData, sort]);

  const paginatedData = sortedData.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage);

  const dataMap = {
    transaction: { data: transactions, setter: setTransactions },
    account: { data: accounts, setter: setAccounts },
    budget: { data: budgets, setter: setBudgets },
    report: { data: reports, setter: setReports }
  };

  const handleAdd = () => {
    const { data, setter } = dataMap[modal.type];
    const form = formData[modal.type];
    let newItem = { ...form };
    if (modal.type === "transaction") {
      const amount = parseFloat(form.amount) || 0;
      newItem = { ...form, id: `TRX-${new Date().getFullYear()}-${String(data.length + 1).padStart(3, '0')}`, amount: form.type === "dépense" ? -Math.abs(amount) : Math.abs(amount) };
    } else if (modal.type === "account") newItem = { ...form, id: data.length + 1, balance: parseFloat(form.balance) || 0 };
    else if (modal.type === "budget") newItem = { ...form, id: data.length + 1, budget: parseFloat(form.budget) || 0, actual: 0, status: "respecté" };
    else if (modal.type === "report") newItem = { ...form, id: data.length + 1, createdAt: new Date().toISOString() };
    setter([newItem, ...data]);
    closeModal();
    showNotif(`${modal.type} ajouté`);
  };

  const handleUpdate = () => {
    const { data, setter } = dataMap[modal.type];
    const form = formData[modal.type];
    let updatedItem = { ...form, id: modal.item.id };
    if (modal.type === "transaction") {
      const amount = parseFloat(form.amount) || 0;
      updatedItem.amount = form.type === "dépense" ? -Math.abs(amount) : Math.abs(amount);
    } else if (modal.type === "account") updatedItem.balance = parseFloat(form.balance) || 0;
    else if (modal.type === "budget") updatedItem.budget = parseFloat(form.budget) || 0;
    setter(data.map(item => item.id === modal.item.id ? updatedItem : item));
    closeModal();
    showNotif(`${modal.type} modifié`);
  };

  const handleDelete = () => {
    const { data, setter } = dataMap[modal.type];
    setter(data.filter(item => item.id !== modal.item.id));
    setModal({ isOpen: false, type: "", item: null, mode: "add" });
    showNotif(`${modal.type} supprimé`);
  };

  const exportToCSV = (data, filename) => {
    if (!data.length) return showNotif("Aucune donnée", "error");
    const csv = [Object.keys(data[0]).join(','), ...data.map(item => Object.values(item).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${filename}_${new Date().toISOString().split('T')[0]}.csv` });
    a.click(); URL.revokeObjectURL(url);
    showNotif(`Exporté dans ${filename}.csv`);
  };

  const handleAddRemote = async () => {
    const form = formData[modal.type];

    try {
      if (modal.type === "transaction") {
        const amount = parseFloat(form.amount) || 0;
        const mainAcc = accounts.find(a => String(a.id) === String(form.account) || a.name === form.account);
        if (!mainAcc) throw new Error("Veuillez sélectionner un compte principal valide.");
        const mainAccId = mainAcc.backendId || mainAcc.id || mainAcc._id;

        // Astuce : Trouver le compte de contre-partie automatiquement pour avoir une transaction équilibrée
        let counterAcc = accounts.find(a => a.name.toLowerCase().includes(form.type === 'revenu' ? 'client' : 'fournisseur'));
        if (!counterAcc) counterAcc = accounts.find(a => String(a.backendId || a.id) !== String(mainAccId));
        if (!counterAcc) {
          const autoName = form.type === 'revenu' ? 'Compte Client (Auto)' : 'Compte Fournisseur (Auto)';
          await accountService.create({ name: autoName, type: form.type === 'revenu' ? 'Créance' : 'Dette', balance: 0, status: 'actif' });
          const newAccounts = await accountService.getAll({ limit: 200 });
          const updatedAccounts = pickList(newAccounts, ['data']).map(mapAccountToUi);
          counterAcc = updatedAccounts.find(a => a.name === autoName);
          if (!counterAcc) throw new Error("Erreur critique lors de la création du compte partiel automatique.");
        }
        const counterAccId = counterAcc.backendId || counterAcc.id || counterAcc._id;

        const payload = {
          date: form.date,
          description: form.description,
          reference: form.notes,
          entries: []
        };

        if (form.type === "revenu") {
          payload.entries.push({ account: mainAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: counterAccId, debit: 0, credit: amount, label: form.category });
        } else {
          payload.entries.push({ account: counterAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: mainAccId, debit: 0, credit: amount, label: form.category });
        }

        await transactionService.create(payload);
      } else if (modal.type === "account") {
        await accountService.create(form);
      } else if (modal.type === "budget") {
        await budgetService.create(form);
      } else if (modal.type === "report") {
        await reportService.create({ ...form, tags: ['source:finance'] });
      }

      await loadFinanceData(userRole, userEmail);
      closeModal();
      showNotif(`${modal.type} ajouté`);
    } catch (error) {
      showNotif(extractApiErrorMessage(error, `Impossible d'ajouter ${modal.type}`), "error");
    }
  };

  const handleUpdateRemote = async () => {
    const form = formData[modal.type];
    const targetId = modal.item?.backendId || modal.item?.id;

    try {
      if (modal.type === "transaction") {
        const amount = parseFloat(form.amount) || 0;
        const mainAcc = accounts.find(a => String(a.id) === String(form.account) || String(a.backendId) === String(form.account) || a.name === form.account);
        if (!mainAcc) throw new Error("Veuillez sélectionner un compte principal valide.");
        const mainAccId = mainAcc.backendId || mainAcc.id || mainAcc._id;

        let counterAcc = accounts.find(a => a.name.toLowerCase().includes(form.type === 'revenu' ? 'client' : 'fournisseur'));
        if (!counterAcc) counterAcc = accounts.find(a => String(a.backendId || a.id) !== String(mainAccId));
        if (!counterAcc) {
          const autoName = form.type === 'revenu' ? 'Compte Client (Auto)' : 'Compte Fournisseur (Auto)';
          await accountService.create({ name: autoName, type: form.type === 'revenu' ? 'Créance' : 'Dette', balance: 0, status: 'actif' });
          const newAccounts = await accountService.getAll({ limit: 200 });
          const updatedAccounts = pickList(newAccounts, ['data']).map(mapAccountToUi);
          counterAcc = updatedAccounts.find(a => a.name === autoName);
          if (!counterAcc) throw new Error("Erreur critique lors de la création du compte partiel automatique pour la modification.");
        }
        const counterAccId = counterAcc.backendId || counterAcc.id || counterAcc._id;

        const payload = {
          description: form.description,
          entries: []
        };

        if (form.type === "revenu") {
          payload.entries.push({ account: mainAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: counterAccId, debit: 0, credit: amount, label: form.category });
        } else {
          payload.entries.push({ account: counterAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: mainAccId, debit: 0, credit: amount, label: form.category });
        }

        await transactionService.update(targetId, payload);
      } else if (modal.type === "account") {
        await accountService.update(targetId, form);
      } else if (modal.type === "budget") {
        await budgetService.update(targetId, form);
      } else if (modal.type === "report") {
        await reportService.update(targetId, form);
      }

      await loadFinanceData(userRole, userEmail);
      closeModal();
      showNotif(`${modal.type} modifié`);
    } catch (error) {
      showNotif(extractApiErrorMessage(error, `Impossible de modifier ${modal.type}`), "error");
    }
  };

  const handleDeleteRemote = async () => {
    const targetId = modal.item?.backendId || modal.item?.id;

    try {
      if (modal.type === "transaction") {
        await transactionService.delete(targetId);
      } else if (modal.type === "account") {
        await accountService.delete(targetId);
      } else if (modal.type === "budget") {
        await budgetService.delete(targetId);
      } else if (modal.type === "report") {
        await reportService.delete(targetId);
      }

      await loadFinanceData(userRole, userEmail);
      closeModal();
      showNotif(`${modal.type} supprimé`);
    } catch (error) {
      showNotif(extractApiErrorMessage(error, `Impossible de supprimer ${modal.type}`), "error");
    }
  };

  const handleReportDownload = async (report) => {
    try {
      await reportService.generatePdf(report.id);
    } catch (error) {
      showNotif(extractApiErrorMessage(error, "Impossible de télécharger le rapport"), "error");
    }
  };

  if (loading || checking) return <div className="finance-loading"><div className="spinner"></div><p>Chargement...</p></div>;
  if (blocked) return <ModuleDisabledView accentColor="#4299e1" moduleLabel="Finance" />;

  const TABS = { TRANSACTIONS: "transactions", ACCOUNTS: "accounts", BUDGETS: "budgets", REPORTS: "reports", SETTINGS: "settings" };

  const NavItem = ({ id, icon, label, count, isDashboard }) => (
    <button className={`nav-item ${activeTab === id ? "active" : ""}`} onClick={() => {
      if (isDashboard) handleDashboardClick();
      else { setActiveTab(id); resetFilters(); }
    }}>
      <span className="nav-icon">{icon}</span>{label}{count !== undefined && <span className="nav-count">{count}</span>}
    </button>
  );

  const StatusBadge = ({ status }) => {
    const style = getStatusStyle(status);
    return <span className="status-badge" style={{ background: style.bg, color: style.color }}>{status}</span>;
  };

  const NoResults = ({ onReset }) => (
    <div className="no-results"><p>Aucun résultat</p><button className="btn-reset" onClick={onReset}>Réinitialiser</button></div>
  );

  return (
    <div className="finance-container">
      {notification.show && <div className={`notification notification-${notification.type}`}>{notification.message}</div>}

      <div className="finance-sidebar">
        <div className="sidebar-header">
          <div className="logo-container">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <rect width="40" height="40" rx="10" fill="#4299e1" />
              <path d="M12 20L18 26L28 14" stroke="white" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div><h1>ERP</h1><p>Finance</p></div>
          </div>
          <span className="role-badge" style={{ background: "#4299e1" }}>ADMIN FINANCE</span>
        </div>
        <div className="user-profile">
          <div className="avatar" style={{ background: "linear-gradient(135deg, #4299e1, #2b6cb0)" }}>
            {userSettings.firstName?.charAt(0).toUpperCase() || "F"}
          </div>
          <div className="user-info">
            <div className="user-name">{userSettings.firstName} {userSettings.lastName}</div>
            <div className="user-email">{userSettings.email || "finance@erp.com"}</div>
            {userSettings.department && <div className="user-department" style={{ fontSize: "0.7rem", color: "#a0aec0" }}>{userSettings.department}</div>}
          </div>
        </div>
        <nav className="sidebar-nav">
          {userRole === 'admin_principal' && (
            <button className="router-button" onClick={handleRouterClick} style={{
              background: '#4299e1', color: 'white', border: 'none', borderRadius: '5px',
              padding: '8px 12px', margin: '0 15px 10px 15px', cursor: 'pointer', fontSize: '0.9rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: 'calc(100% - 30px)'
            }} title="Retour à l'administration">
              <span>🏠</span> Admin Principal
            </button>
          )}
          <NavItem id="dashboard" icon="📊" label="Dashboard Finance" isDashboard={true} />
          <NavItem id={TABS.TRANSACTIONS} icon="💰" label="Transactions" count={transactions.length} />
          <NavItem id={TABS.ACCOUNTS} icon="🏦" label="Comptes" count={accounts.filter(a => a.status === "actif").length} />
          <NavItem id={TABS.BUDGETS} icon="📋" label="Budgets" />
          <NavItem id={TABS.REPORTS} icon="📑" label="Rapports" count={reports.length} />
          <NavItem id={TABS.SETTINGS} icon="⚙️" label="Paramètres" />
        </nav>
        <div className="sidebar-footer">
          <button onClick={handleLogout} className="logout-btn"><span className="nav-icon">🚪</span> Déconnexion</button>
        </div>
      </div>

      <div className="finance-main">
        <div className="main-header">
          <div>
            <h1 className="welcome-title">💰 Bonjour, <span style={{ color: "#4299e1" }}>{userSettings.firstName || "Gestionnaire"}</span></h1>
            <p className="welcome-subtitle">
              {activeTab === TABS.TRANSACTIONS && "Gérez vos transactions"}
              {activeTab === TABS.ACCOUNTS && "Gérez vos comptes"}
              {activeTab === TABS.BUDGETS && "Suivez vos budgets"}
              {activeTab === TABS.REPORTS && "Gérez vos rapports"}
              {activeTab === TABS.SETTINGS && "Modifiez vos informations personnelles"}
            </p>
          </div>
          <div className="header-actions">
            <div className="date-box">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            {activeTab !== TABS.SETTINGS && (
              <button className="btn-primary" style={{ background: "#4299e1" }} onClick={() => {
                const type = activeTab === TABS.TRANSACTIONS ? "transaction" : activeTab === TABS.ACCOUNTS ? "account" : activeTab === TABS.BUDGETS ? "budget" : "report";
                openModal(type, "add");
              }}>
                + {activeTab === TABS.TRANSACTIONS ? "Nouvelle transaction" : activeTab === TABS.ACCOUNTS ? "Nouveau compte" : activeTab === TABS.BUDGETS ? "Nouveau budget" : "Créer un rapport"}
              </button>
            )}
          </div>
        </div>

        {activeTab !== TABS.REPORTS && activeTab !== TABS.SETTINGS && activeTab !== "dashboard" && (
          <div className="filters-container">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input type="text" placeholder="Rechercher..." value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="search-input" />
              {filters.search && <button className="clear-search" onClick={() => setFilters({ ...filters, search: "" })}>×</button>}
            </div>
            <div className="filter-group">
              {activeTab === TABS.TRANSACTIONS && (
                <>
                  <select className="filter-select" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                    <option value="tous">Tous types</option><option value="revenu">Revenus</option><option value="dépense">Dépenses</option>
                  </select>
                  <select className="filter-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                    <option value="tous">Tous statuts</option><option value="complété">Complété</option><option value="en attente">En attente</option><option value="en retard">En retard</option>
                  </select>
                  <select className="filter-select" value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
                    <option value="tous">Toutes catégories</option><option value="Vente">Vente</option><option value="Achat">Achat</option><option value="Salaires">Salaires</option><option value="Loyer">Loyer</option><option value="Utilities">Utilities</option><option value="Services">Services</option>
                  </select>
                  <select className="filter-select" value={filters.account} onChange={e => setFilters({ ...filters, account: e.target.value })}>
                    <option value="tous">Tous comptes</option>{accounts.map(acc => <option key={acc.id} value={acc.name}>{acc.name}</option>)}
                  </select>
                </>
              )}
              {activeTab === TABS.ACCOUNTS && (
                <>
                  <select className="filter-select" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                    <option value="tous">Tous types</option><option value="Banque">Banque</option><option value="Épargne">Épargne</option><option value="Créance">Créance</option><option value="Dette">Dette</option>
                  </select>
                  <select className="filter-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                    <option value="tous">Tous statuts</option><option value="actif">Actif</option><option value="inactif">Inactif</option>
                  </select>
                </>
              )}
              {activeTab === TABS.BUDGETS && (
                <select className="filter-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                  <option value="tous">Tous statuts</option><option value="respecté">Respecté</option><option value="dépassé">Dépassé</option>
                </select>
              )}
              <button className="btn-reset-filters" onClick={resetFilters}>↻ Réinitialiser</button>
              {(activeTab === TABS.TRANSACTIONS || activeTab === TABS.BUDGETS) && (
                <button className="btn-export" onClick={() => exportToCSV(filteredData, activeTab)}>📥 Exporter</button>
              )}
            </div>
          </div>
        )}

        {activeTab === TABS.TRANSACTIONS && (
          <div className="transactions-content">
            <div className="table-container">
              <table className="transactions-full-table">
                <thead><tr>
                  {["N°", "Date", "Description", "Catégorie", "Compte", "Montant", "Statut", "Actions"].map(col => {
                    const keyMap = { "N°": "id", "Date": "date", "Montant": "amount" };
                    const sortKey = keyMap[col];
                    return <th key={col} onClick={() => sortKey && setSort({ key: sortKey, direction: sort.direction === "asc" ? "desc" : "asc" })}>
                      {col} {sort.key === sortKey && (sort.direction === "asc" ? "↑" : "↓")}
                    </th>;
                  })}
                </tr></thead>
                <tbody>
                  {paginatedData.map(t => (
                    <tr key={t.id}>
                      <td className="transaction-number">{t.id}</td>
                      <td>{formatDate(t.date)}</td>
                      <td className="transaction-desc">{t.description}{t.notes && <small className="notes-indicator">📝</small>}</td>
                      <td><span className="category-badge">{t.category}</span></td>
                      <td>{t.account}</td>
                      <td className={t.type === "revenu" ? "text-success" : "text-danger"}>
                        <strong>{t.type === "revenu" ? "+" : "-"}{formatCurrency(Math.abs(t.amount))}</strong>
                      </td>
                      <td><StatusBadge status={t.status} /></td>
                      <td><div className="action-buttons">
                        <button className="action-btn" onClick={() => openModal("transaction", "edit", t)}>✏️</button>
                        <button className="action-btn delete" onClick={() => openModal("transaction", "delete", t)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredData.length && <NoResults onReset={resetFilters} />}
            </div>
            <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />
          </div>
        )}

        {activeTab === TABS.ACCOUNTS && (
          <div className="accounts-content">
            <div className="accounts-grid">
              {paginatedData.map(a => (
                <div key={a.id} className="account-card">
                  <div className="account-card-header">
                    <div className="account-icon" style={{ background: "#4299e115", color: "#4299e1" }}>
                      {a.type === "Banque" ? "🏦" : a.type === "Épargne" ? "💰" : "📋"}
                    </div>
                    <div className="account-info"><h4>{a.name}</h4><p className="account-number">{a.number}</p></div>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="account-card-body">
                    <div className="account-balance"><span>Solde</span><strong className={a.balance >= 0 ? "text-success" : "text-danger"}>{formatCurrency(a.balance)}</strong></div>
                    <div className="account-type"><span>Type</span><strong>{a.type}</strong></div>
                    {a.iban && <div className="account-iban"><span>IBAN</span><small>{a.iban}</small></div>}
                  </div>
                  <div className="account-card-footer">
                    <button className="btn-small" onClick={() => { setFilters({ ...filters, account: a.name }); setActiveTab(TABS.TRANSACTIONS); }}>Voir transactions</button>
                    <button className="btn-icon" onClick={() => openModal("account", "edit", a)}>✏️</button>
                    <button className="btn-icon" onClick={() => openModal("account", "delete", a)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
            {!filteredData.length && <NoResults onReset={resetFilters} />}
          </div>
        )}

        {activeTab === TABS.BUDGETS && (
          <div className="budgets-content">
            <BudgetSummary budgets={filteredData} formatCurrency={formatCurrency} />
            <div className="table-container">
              <table className="budgets-table">
                <thead><tr>
                  <th onClick={() => setSort({ key: "category", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Catégorie {sort.key === "category" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => setSort({ key: "budget", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Budget {sort.key === "budget" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Réalisé</th><th>Écart</th><th>Progression</th><th>Statut</th><th>Actions</th>
                </tr></thead>
                <tbody>
                  {paginatedData.map(b => {
                    const variance = (b.actual || 0) - (b.budget || 0);
                    const percentUsed = b.budget > 0 ? ((b.actual || 0) / b.budget) * 100 : 0;
                    const progressColor = percentUsed > 100 ? COLORS.danger : percentUsed > 90 ? COLORS.warning : COLORS.success;
                    return (
                      <tr key={b.id}>
                        <td className="budget-category">{b.category}{b.notes && <small className="notes-indicator" title={b.notes}>📝</small>}</td>
                        <td>{formatCurrency(b.budget)}</td><td>{formatCurrency(b.actual)}</td>
                        <td className={variance <= 0 ? "text-success" : "text-danger"}>{variance > 0 ? "+" : ""}{formatCurrency(variance)}</td>
                        <td><div className="progress-bar-container">
                          <div className="progress-bar" style={{ width: `${Math.min(percentUsed, 100)}%`, background: progressColor }}></div>
                          <span className="progress-text">{percentUsed.toFixed(1)}%</span>
                        </div></td>
                        <td><StatusBadge status={b.status} /></td>
                        <td><div className="action-buttons">
                          <button className="action-btn" onClick={() => openModal("budget", "edit", b)}>✏️</button>
                          <button className="action-btn delete" onClick={() => openModal("budget", "delete", b)}>🗑️</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredData.length && <NoResults onReset={resetFilters} />}
            </div>
          </div>
        )}

        {/* Reports tab */}
        {activeTab === TABS.REPORTS && (
          <div className="reports-content">

            {/* Search  filters */}
            <div className="filters-container">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Rechercher un rapport par titre ou description..."
                  value={filters.search}
                  onChange={e => { setFilters({ ...filters, search: e.target.value }); setPagination(p => ({ ...p, currentPage: 1 })); }}
                  className="search-input"
                />
                {filters.search && (
                  <button className="clear-search" onClick={() => setFilters({ ...filters, search: "" })}>×</button>
                )}
              </div>

            </div>

            {/* Result count */}
            {filters.search || filters.dateRange.start || filters.dateRange.end ? (
              <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#718096" }}>
                {filteredData.length} résultat{filteredData.length !== 1 ? "s" : ""} trouvé{filteredData.length !== 1 ? "s" : ""}
              </p>
            ) : null}

            {/* Report cards */}
            <div className="reports-grid">
              {paginatedData.map(r => (
                <div key={r.id} className="report-card">
                  <div className="report-icon" style={{ background: "#4299e115", color: "#4299e1" }}>📄</div>
                  <div className="report-info">
                    <h4>{r.title}</h4>
                    <p className="report-description">{r.description}</p>
                    <p className="report-date">
                      <span>Date : {formatDate(r.date)}</span>
                      <span className="report-created">Créé le : {formatDateTime(r.createdAt)}</span>
                    </p>
                  </div>
                  <div className="report-actions">
                    {/* View full content */}
                    <button
                      className="btn-icon"
                      title="Voir le contenu complet"
                      onClick={() => setViewReport(r)}
                    >👁️</button>

                    {/* Edit */}
                    <button
                      className="btn-icon"
                      title="Modifier"
                      onClick={() => openModal("report", "edit", r)}
                    >✏️</button>

                    {/* Download PDF */}
                    <button
                      className="btn-icon"
                      title="Télécharger en PDF"
                      onClick={() => handleReportDownload(r)}
                      data-pdf-status="idle"
                      data-pdf-source="backend"
                    >PDF</button>

                    {/* Delete */}
                    <button
                      className="btn-icon delete"
                      title="Supprimer"
                      onClick={() => openModal("report", "delete", r)}
                    >🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            {!filteredData.length && <NoResults onReset={resetFilters} />}
            <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />
          </div>
        )}
        {/* Settings separator */}

        {activeTab === TABS.SETTINGS && (
          <div className="settings-tab">
            <h2>⚙️ Paramètres du profil</h2>
            {settingsMessage.text && <div className={`settings-message ${settingsMessage.type}`}>{settingsMessage.text}</div>}
            <div className="settings-form">
              <div className="settings-section">
                <h3>Informations personnelles</h3>
                <div className="settings-row">
                  <div className="settings-group"><label>Prénom</label><input type="text" name="firstName" value={userSettings.firstName} onChange={handleSettingsChange} /></div>
                  <div className="settings-group"><label>Nom</label><input type="text" name="lastName" value={userSettings.lastName} onChange={handleSettingsChange} /></div>
                </div>
                <div className="settings-row">
                  <div className="settings-group"><label>Email</label><input type="email" name="email" value={userSettings.email} onChange={handleSettingsChange} /></div>
                  <div className="settings-group"><label>Téléphone</label><input type="tel" name="phone" value={userSettings.phone} onChange={handleSettingsChange} /></div>
                </div>
              </div>
              <div className="settings-section">
                <h3>Informations professionnelles</h3>
                <div className="settings-row">
                  <div className="settings-group"><label>Département</label><input type="text" name="department" value={userSettings.department} onChange={handleSettingsChange} /></div>
                  <div className="settings-group"><label>Rôle</label><input type="text" value={userSettings.role} disabled style={{ backgroundColor: "#f7fafc", cursor: "not-allowed" }} /><small>Le rôle ne peut pas être modifié</small></div>
                </div>
              </div>
              <div className="settings-section">
                <h3>Changer le mot de passe</h3>
                <p className="settings-hint">Laissez vide si vous ne souhaitez pas changer votre mot de passe</p>
                <div className="settings-group"><label>Mot de passe actuel</label><input type="password" name="currentPassword" value={userSettings.currentPassword} onChange={handleSettingsChange} /></div>
                <div className="settings-row">
                  <div className="settings-group"><label>Nouveau mot de passe</label><input type="password" name="newPassword" value={userSettings.newPassword} onChange={handleSettingsChange} /></div>
                  <div className="settings-group"><label>Confirmer</label><input type="password" name="confirmPassword" value={userSettings.confirmPassword} onChange={handleSettingsChange} /></div>
                </div>
                <small>Minimum 6 caractères</small>
              </div>
              <div className="settings-actions">
                <button className="btn-primary" onClick={handleSaveSettings} disabled={updating} style={{ width: '100%', background: "#4299e1" }}>
                  {updating ? "Mise à jour en cours..." : "Enregistrer les modifications"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modal.isOpen && modal.mode !== "delete" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modal.mode === "add" ? "➕ Nouveau" : "✏️ Modifier"} {modal.type}</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {modal.type === "transaction" && <TransactionForm formData={formData} setFormData={setFormData} accounts={accounts} />}
              {modal.type === "account" && <AccountForm formData={formData} setFormData={setFormData} />}
              {modal.type === "budget" && <BudgetForm formData={formData} setFormData={setFormData} />}
              {modal.type === "report" && <ReportForm formData={formData} setFormData={setFormData} />}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-primary" style={{ background: "#4299e1" }}
                onClick={modal.mode === "add" ? handleAddRemote : handleUpdateRemote}>
                {modal.mode === "add" ? "Ajouter" : "Modifier"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {modal.isOpen && modal.mode === "delete" && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content modal-small" onClick={e => e.stopPropagation()}>
            <div className="modal-header"><h3>⚠️ Confirmation</h3><button className="modal-close" onClick={closeModal}>×</button></div>
            <div className="modal-body">
              <p>Êtes-vous sûr de vouloir supprimer {modal.type === "account" ? "ce compte" : "cet élément"} ?</p>
              {modal.type === "account" && modal.item?.balance !== 0 && (
                <p className="text-warning">⚠️ Attention : Ce compte a un solde de {formatCurrency(modal.item.balance)}.</p>
              )}
              <p className="text-danger">Cette action est irréversible.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Annuler</button>
              <button className="btn-danger" onClick={handleDeleteRemote}>Supprimer</button>
            </div>
          </div>
        </div>
      )}

      {/* Report View modal */}
      {viewReport && (
        <ReportViewModal
          report={viewReport}
          onClose={() => setViewReport(null)}
          formatDate={formatDate}
          formatDateTime={formatDateTime}
        />
      )}
    </div>
  );
}
// Sub-forms
const TransactionForm = ({ formData, setFormData, accounts }) => {
  const fd = formData.transaction;
  const set = (field, value) => setFormData({ ...formData, transaction: { ...fd, [field]: value } });
  return (<>
    <div className="form-group"><label>Description *</label><input type="text" value={fd.description} onChange={e => set('description', e.target.value)} required /></div>
    <div className="form-row">
      <div className="form-group"><label>Montant *</label><input type="number" value={fd.amount} onChange={e => set('amount', e.target.value)} step="0.01" required /></div>
      <div className="form-group"><label>Type *</label><select value={fd.type} onChange={e => set('type', e.target.value)}><option value="revenu">Revenu</option><option value="dépense">Dépense</option></select></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Catégorie *</label><select value={fd.category} onChange={e => set('category', e.target.value)}>
        <option value="Vente">Vente</option><option value="Achat">Achat</option><option value="Salaires">Salaires</option><option value="Loyer">Loyer</option>
      </select></div>
      <div className="form-group"><label>Compte *</label><select value={fd.account || ""} onChange={e => set('account', e.target.value)}>
        <option value="" disabled>-- Sélectionnez un compte --</option>
        {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
      </select></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Date *</label><input type="date" value={fd.date} onChange={e => set('date', e.target.value)} required /></div>
      <div className="form-group"><label>Statut *</label><select value={fd.status} onChange={e => set('status', e.target.value)}>
        <option value="complété">Complété</option><option value="en attente">En attente</option><option value="en retard">En retard</option>
      </select></div>
    </div>
    <div className="form-group"><label>Notes</label><textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="3" /></div>
  </>);
};

const AccountForm = ({ formData, setFormData }) => {
  const fd = formData.account;
  const set = (field, value) => setFormData({ ...formData, account: { ...fd, [field]: value } });
  return (<>
    <div className="form-group"><label>Nom *</label><input type="text" value={fd.name} onChange={e => set('name', e.target.value)} required /></div>
    <div className="form-row">
      <div className="form-group"><label>Type *</label><select value={fd.type} onChange={e => set('type', e.target.value)}>
        <option value="Banque">Banque</option><option value="Épargne">Épargne</option><option value="Créance">Créance</option><option value="Dette">Dette</option>
      </select></div>
      <div className="form-group"><label>Solde initial *</label><input type="number" value={fd.balance} onChange={e => set('balance', e.target.value)} step="0.01" required /></div>
    </div>
    <div className="form-group"><label>Numéro de compte</label><input type="text" value={fd.number} onChange={e => set('number', e.target.value)} /></div>
    <div className="form-row">
      <div className="form-group"><label>IBAN</label><input type="text" value={fd.iban} onChange={e => set('iban', e.target.value)} /></div>
      <div className="form-group"><label>BIC</label><input type="text" value={fd.bic} onChange={e => set('bic', e.target.value)} /></div>
    </div>
    <div className="form-group"><label>Statut</label><select value={fd.status} onChange={e => set('status', e.target.value)}>
      <option value="actif">Actif</option><option value="inactif">Inactif</option>
    </select></div>
  </>);
};

const BudgetForm = ({ formData, setFormData }) => {
  const fd = formData.budget;
  const set = (field, value) => setFormData({ ...formData, budget: { ...fd, [field]: value } });
  return (<>
    <div className="form-group"><label>Catégorie *</label><input type="text" value={fd.category} onChange={e => set('category', e.target.value)} required /></div>
    <div className="form-row">
      <div className="form-group"><label>Montant budget *</label><input type="number" value={fd.budget} onChange={e => set('budget', e.target.value)} step="0.01" required /></div>
      <div className="form-group"><label>Mois *</label><input type="month" value={fd.month} onChange={e => set('month', e.target.value)} required /></div>
    </div>
    <div className="form-group"><label>Notes</label><textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="3" /></div>
  </>);
};

const ReportForm = ({ formData, setFormData }) => {
  const fd = formData.report;
  const set = (field, value) => setFormData({ ...formData, report: { ...fd, [field]: value } });
  return (<>
    <div className="form-group"><label>Titre *</label><input type="text" value={fd.title} onChange={e => set('title', e.target.value)} required /></div>
    <div className="form-group"><label>Description</label><textarea value={fd.description} onChange={e => set('description', e.target.value)} rows="4" /></div>
    <div className="form-group"><label>Date *</label><input type="date" value={fd.date} onChange={e => set('date', e.target.value)} required /></div>
  </>);
};

export default FinanceAdmin;
