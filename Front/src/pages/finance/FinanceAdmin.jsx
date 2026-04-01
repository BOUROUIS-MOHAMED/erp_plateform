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
import { targetService } from "../../services/targetService";
import { moneyFlowService } from "../../services/moneyFlowService";
import { reportService } from "../../services/reportService";
import {
  extractApiErrorMessage,
  mapAccountToUi,
  mapBudgetToUi,
  mapTargetToUi,
  mapMoneyFlowToUi,
  mapReportToUi,
  mapTransactionToUi,
  pickList,
} from "../../utils/frontendApiAdapters";
import "./FinanceAdmin.css";

const COLORS = {
  success: "#48bb78", warning: "#ed8936", danger: "#f56565", muted: "#718096", info: "#4299e1",
  successBg: "#c6f6d5", warningBg: "#feebc8", dangerBg: "#fed7d7",
  mutedBg: "#edf2f7", infoBg: "#bee3f8", defaultBg: "#e2e8f0"
};
const STATUS_CONFIG = {
  // transactions
  "complété": { color: COLORS.success, bg: COLORS.successBg },
  "en attente": { color: COLORS.warning, bg: COLORS.warningBg },
  "en retard": { color: COLORS.danger, bg: COLORS.dangerBg },
  // accounts
  "actif": { color: COLORS.success, bg: COLORS.successBg },
  "inactif": { color: COLORS.muted, bg: COLORS.mutedBg },
  // budget
  "respected": { color: COLORS.success, bg: COLORS.successBg },
  "passed": { color: COLORS.danger, bg: COLORS.dangerBg },
  "desactivated": { color: COLORS.muted, bg: COLORS.mutedBg },
  // target
  "in_progress": { color: COLORS.info, bg: COLORS.infoBg },
  "reached": { color: COLORS.success, bg: COLORS.successBg },
  "failed": { color: COLORS.danger, bg: COLORS.dangerBg },
};
const STATUS_LABELS = {
  respected: "Respecté", passed: "Dépassé", desactivated: "Désactivé",
  in_progress: "En cours", reached: "Atteint", failed: "Échoué"
};
const getStatusStyle = (status) => STATUS_CONFIG[status] || { color: COLORS.muted, bg: COLORS.defaultBg };
const getStatusLabel = (status) => STATUS_LABELS[status] || status;

const FORMAT_OPTIONS = {
  currency: { style: 'currency', currency: 'EUR' },
  date: { day: '2-digit', month: '2-digit', year: 'numeric' },
  datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }
};

const today = new Date().toISOString().split('T')[0];

const EMPTY_FORMS = {
  transaction: {
    description: "", amount: "", type: "revenu", category: "Vente", account: "",
    date: today, status: "complété", notes: ""
  },
  account: { name: "", type: "Banque", number: "", iban: "", bic: "", balance: "", status: "actif", inMoneyFlow: false },
  budget: { category: "", budget: "", usedAmount: "0", startDate: "", endDate: "", notes: "", status: "respected" },
  target: { category: "", amount: "", realisedAmount: "0", startDate: "", endDate: "", notes: "", status: "in_progress" },
  moneyFlow: { category: "", amount: "", date: today, isExpense: false, note: "" },
  report: { title: "", description: "", date: today }
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

function FinanceAdmin() {
  const navigate = useNavigate();
  const { blocked, checking } = useModuleAvailability("finance");
  const [userEmail, setUserEmail] = useState("");
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
  const [targets, setTargets] = useState([]);
  const [moneyFlows, setMoneyFlows] = useState([]);
  const [moneyFlowAccounts, setMoneyFlowAccounts] = useState([]);
  const [reports, setReports] = useState([]);
  const [formData, setFormData] = useState({
    transaction: { ...EMPTY_FORMS.transaction },
    account: { ...EMPTY_FORMS.account },
    budget: { ...EMPTY_FORMS.budget },
    target: { ...EMPTY_FORMS.target },
    moneyFlow: { ...EMPTY_FORMS.moneyFlow },
    report: { ...EMPTY_FORMS.report }
  });
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
    setUserSettings({
      firstName, lastName, email: resolvedEmail,
      phone: profile?.phone || "",
      department: profile?.department || "Finance",
      role: resolvedRole,
      currentPassword: "", newPassword: "", confirmPassword: "",
    });
  };

  const loadFinanceData = async (fallbackRole = userRole, fallbackEmail = userEmail) => {
    const [profileResponse, transactionsResponse, accountsResponse, budgetsResponse, targetsResponse, moneyFlowResponse, moneyFlowAccountsResponse, reportsResponse] = await Promise.all([
      userService.getProfile(),
      transactionService.getAll({ limit: 200 }),
      accountService.getAll({ limit: 200 }),
      budgetService.getAll({ limit: 200 }),
      targetService.getAll({ limit: 200 }),
      moneyFlowService.getAll({ limit: 200 }),
      accountService.getAll({ limit: 200, inMoneyFlow: true }),
      reportService.getAll({ limit: 200 }),
    ]);

    const profile = profileResponse?.data || profileResponse;
    applyProfileState(profile, fallbackRole, fallbackEmail);
    setTransactions(pickList(transactionsResponse, ['data']).map(mapTransactionToUi));
    setAccounts(pickList(accountsResponse, ['data']).map(mapAccountToUi));
    setBudgets(pickList(budgetsResponse, ['data']).map(mapBudgetToUi));
    setTargets(pickList(targetsResponse, ['data']).map(mapTargetToUi));
    setMoneyFlows(pickList(moneyFlowResponse, ['data']).map(mapMoneyFlowToUi));
    setMoneyFlowAccounts(pickList(moneyFlowAccountsResponse, ['data']).map(mapAccountToUi));
    setReports(
      pickList(reportsResponse, ['data'])
        .filter(report => {
          if (fallbackRole === 'admin_principal' || userRole === 'admin_principal') return true;
          const tags = report.tags || [];
          return tags.length === 0 || tags.includes('source:finance');
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
        setSettingsMessage({ type: "error", text: extractApiErrorMessage(error, "Impossible de charger les donnees finance") });
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
    const changingPassword = userSettings.newPassword || userSettings.confirmPassword || userSettings.currentPassword;
    if (changingPassword) {
      if (!userSettings.currentPassword) { setSettingsMessage({ type: "error", text: "Veuillez entrer votre mot de passe actuel" }); return; }
      if (userSettings.newPassword !== userSettings.confirmPassword) { setSettingsMessage({ type: "error", text: "Les nouveaux mots de passe ne correspondent pas" }); return; }
      if (userSettings.newPassword.length < 6) { setSettingsMessage({ type: "error", text: "Le nouveau mot de passe doit contenir au moins 6 caractères" }); return; }
    }
    setUpdating(true);
    setSettingsMessage({ type: "info", text: "Mise à jour en cours..." });
    try {
      await userService.updateProfile({ firstName: userSettings.firstName, lastName: userSettings.lastName, email: userSettings.email, phone: userSettings.phone, department: userSettings.department });
      if (changingPassword) await userService.changePassword(userSettings.currentPassword, userSettings.newPassword);
      await loadFinanceData(userRole, userSettings.email);
      setSettingsMessage({ type: "success", text: "Profil mis à jour avec succès !" });
      setTimeout(() => setSettingsMessage({ type: "", text: "" }), 2000);
    } catch (error) {
      setSettingsMessage({ type: "error", text: extractApiErrorMessage(error, "Impossible de mettre a jour le profil") });
    } finally {
      setUpdating(false);
    }
  };

  const handleLogout = () => { clearAuth(); navigate("/login"); };

  const openModal = (type, mode, item = null) => {
    if (item && mode === "edit") {
      const map = {
        transaction: { ...item, amount: Math.abs(item.amount || 0).toString() },
        account: { ...item, balance: (item.capital ?? item.balance ?? 0).toString(), inMoneyFlow: Boolean(item.inMoneyFlow) },
        budget: { ...item, budget: (item.budget || 0).toString(), usedAmount: (item.usedAmount || 0).toString() },
        target: { ...item, amount: (item.amount || 0).toString(), realisedAmount: (item.realisedAmount || 0).toString() },
        moneyFlow: { ...item, amount: (item.amount || 0).toString() },
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

  const TABS = {
    TRANSACTIONS: "transactions", ACCOUNTS: "accounts",
    BUDGETS: "budgets", TARGETS: "targets", MONEYFLOW: "moneyFlow",
    REPORTS: "reports", SETTINGS: "settings"
  };

  const allDataMap = { transactions, accounts, budgets, targets, moneyFlow: moneyFlows, reports };

  const filteredData = useMemo(() => {
    const source = allDataMap[activeTab] || [];
    return source.filter(item => {
      if (filters.search) {
        const s = filters.search.toLowerCase();
        const fields = {
          transactions: [item.description, item.id],
          accounts: [item.name, item.number],
          budgets: [item.category],
          targets: [item.category],
          moneyFlow: [item.category, item.note],
          reports: [item.title, item.description]
        }[activeTab] || [];
        if (!fields.some(f => f?.toLowerCase().includes(s))) return false;
      }
      if (activeTab === "transactions") {
        if (filters.type !== "tous" && item.type !== filters.type) return false;
        if (filters.status !== "tous" && item.status !== filters.status) return false;
        if (filters.category !== "tous" && item.category !== filters.category) return false;
        if (filters.account !== "tous" && item.account !== filters.account) return false;
      }
      if (activeTab === "accounts" && filters.type !== "tous" && item.type !== filters.type) return false;
      if (["accounts", "budgets", "targets"].includes(activeTab) && filters.status !== "tous" && item.status !== filters.status) return false;
      if (activeTab === "moneyFlow" && filters.type !== "tous") {
        if (filters.type === "expense" && !item.isExpense) return false;
        if (filters.type === "revenue" && item.isExpense) return false;
      }
      if (filters.dateRange.start && item.date && item.date < filters.dateRange.start) return false;
      if (filters.dateRange.end && item.date && item.date > filters.dateRange.end) return false;
      return true;
    });
  }, [activeTab, transactions, accounts, budgets, targets, moneyFlows, reports, filters]);

  const sortedData = useMemo(() => [...filteredData].sort((a, b) => {
    let valA = a[sort.key], valB = b[sort.key];
    if (["date", "createdAt", "startDate", "endDate"].includes(sort.key)) { valA = new Date(valA || 0); valB = new Date(valB || 0); }
    if (["amount", "budget", "usedAmount", "balance", "realisedAmount"].includes(sort.key)) { valA = Number(valA) || 0; valB = Number(valB) || 0; }
    return valA < valB ? (sort.direction === "asc" ? -1 : 1) : valA > valB ? (sort.direction === "asc" ? 1 : -1) : 0;
  }), [filteredData, sort]);

  const paginatedData = sortedData.slice((pagination.currentPage - 1) * pagination.itemsPerPage, pagination.currentPage * pagination.itemsPerPage);

  const handleAddRemote = async () => {
    const form = formData[modal.type];
    try {
      if (modal.type === "transaction") {
        const amount = parseFloat(form.amount) || 0;
        const mainAcc = accounts.find(a => String(a.id) === String(form.account) || a.name === form.account);
        if (!mainAcc) throw new Error("Veuillez sélectionner un compte principal valide.");
        const mainAccId = mainAcc.backendId || mainAcc.id;
        let counterAcc = accounts.find(a => a.name.toLowerCase().includes(form.type === 'revenu' ? 'client' : 'fournisseur'));
        if (!counterAcc) counterAcc = accounts.find(a => String(a.backendId || a.id) !== String(mainAccId));
        if (!counterAcc) {
          const autoName = form.type === 'revenu' ? 'Compte Client (Auto)' : 'Compte Fournisseur (Auto)';
          await accountService.create({ name: autoName, type: form.type === 'revenu' ? 'Créance' : 'Dette', balance: 0, status: 'actif' });
          const newAccounts = await accountService.getAll({ limit: 200 });
          counterAcc = pickList(newAccounts, ['data']).map(mapAccountToUi).find(a => a.name === autoName);
          if (!counterAcc) throw new Error("Erreur critique lors de la création du compte partiel automatique.");
        }
        const counterAccId = counterAcc.backendId || counterAcc.id;
        const payload = { date: form.date, description: form.description, reference: form.notes, entries: [] };
        if (form.type === "revenu") {
          payload.entries.push({ account: mainAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: counterAccId, debit: 0, credit: amount, label: form.category });
        } else {
          payload.entries.push({ account: counterAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: mainAccId, debit: 0, credit: amount, label: form.category });
        }
        const createResult = await transactionService.create(payload);
        if (form.status === 'complété') {
          const newTxId = createResult?.data?.id || createResult?.data?._id;
          if (newTxId) { try { await transactionService.validate(newTxId); } catch (e) { console.warn('Auto-validate failed:', e); } }
        }
      } else if (modal.type === "account") {
        await accountService.create({ ...form, inMoneyFlow: Boolean(form.inMoneyFlow) });
      } else if (modal.type === "budget") {
        await budgetService.create(form);
      } else if (modal.type === "target") {
        await targetService.create(form);
      } else if (modal.type === "moneyFlow") {
        await moneyFlowService.create(form);
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
        const mainAccId = mainAcc.backendId || mainAcc.id;
        let counterAcc = accounts.find(a => a.name.toLowerCase().includes(form.type === 'revenu' ? 'client' : 'fournisseur'));
        if (!counterAcc) counterAcc = accounts.find(a => String(a.backendId || a.id) !== String(mainAccId));
        const counterAccId = counterAcc ? (counterAcc.backendId || counterAcc.id) : mainAccId;
        const payload = { description: form.description, entries: [] };
        if (form.type === "revenu") {
          payload.entries.push({ account: mainAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: counterAccId, debit: 0, credit: amount, label: form.category });
        } else {
          payload.entries.push({ account: counterAccId, debit: amount, credit: 0, label: form.category });
          payload.entries.push({ account: mainAccId, debit: 0, credit: amount, label: form.category });
        }
        await transactionService.update(targetId, payload);
        if (form.status === 'complété') { try { await transactionService.validate(targetId); } catch (e) { console.warn('Validation call failed:', e); } }
      } else if (modal.type === "account") {
        await accountService.update(targetId, { ...form, inMoneyFlow: Boolean(form.inMoneyFlow) });
      } else if (modal.type === "budget") {
        await budgetService.update(targetId, form);
      } else if (modal.type === "target") {
        await targetService.update(targetId, form);
      } else if (modal.type === "moneyFlow") {
        await moneyFlowService.update(targetId, form);
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
      if (modal.type === "transaction") await transactionService.delete(targetId);
      else if (modal.type === "account") await accountService.delete(targetId);
      else if (modal.type === "budget") await budgetService.delete(targetId);
      else if (modal.type === "target") await targetService.delete(targetId);
      else if (modal.type === "moneyFlow") await moneyFlowService.delete(targetId);
      else if (modal.type === "report") await reportService.delete(targetId);
      await loadFinanceData(userRole, userEmail);
      closeModal();
      showNotif(`${modal.type} supprimé`);
    } catch (error) {
      showNotif(extractApiErrorMessage(error, `Impossible de supprimer ${modal.type}`), "error");
    }
  };

  const exportToCSV = (data, filename) => {
    if (!data.length) return showNotif("Aucune donnée", "error");
    const csv = [Object.keys(data[0]).join(','), ...data.map(item => Object.values(item).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${filename}_${today}.csv` });
    a.click(); URL.revokeObjectURL(url);
    showNotif(`Exporté dans ${filename}.csv`);
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
    return <span className="status-badge" style={{ background: style.bg, color: style.color }}>{getStatusLabel(status)}</span>;
  };

  const NoResults = ({ onReset }) => (
    <div className="no-results"><p>Aucun résultat</p><button className="btn-reset" onClick={onReset}>Réinitialiser</button></div>
  );

  // Money Flow summary bar
  const mfTotalRevenu = moneyFlows.reduce((s, e) => s + (!e.isExpense ? e.amount : 0), 0);
  const mfTotalDepense = moneyFlows.reduce((s, e) => s + (e.isExpense ? e.amount : 0), 0);
  const mfSoldesComptes = moneyFlowAccounts.reduce((s, a) => s + (a.solde || 0), 0);
  const mfNet = mfTotalRevenu - mfTotalDepense + mfSoldesComptes;

  // Budget summary bar
  const budgetTotalBudget = filteredData.reduce((s, b) => activeTab === 'budgets' ? s + (b.budget || 0) : s, 0);
  const budgetTotalUsed = filteredData.reduce((s, b) => activeTab === 'budgets' ? s + (b.usedAmount || 0) : s, 0);

  // Target summary bar
  const targetTotalGoal = filteredData.reduce((s, t) => activeTab === 'targets' ? s + (t.amount || 0) : s, 0);
  const targetTotalRealised = filteredData.reduce((s, t) => activeTab === 'targets' ? s + (t.realisedAmount || 0) : s, 0);

  const addButtonLabel = {
    transactions: "Nouvelle transaction",
    accounts: "Nouveau compte",
    budgets: "Nouveau budget",
    targets: "Nouvel objectif",
    moneyFlow: "Nouvelle entrée",
    reports: "Créer un rapport"
  }[activeTab];

  const addButtonType = {
    transactions: "transaction", accounts: "account", budgets: "budget",
    targets: "target", moneyFlow: "moneyFlow", reports: "report"
  }[activeTab];

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
            }}>
              <span>🏠</span> Admin Principal
            </button>
          )}
          <NavItem id="dashboard" icon="📊" label="Dashboard Finance" isDashboard={true} />
          <NavItem id={TABS.TRANSACTIONS} icon="💰" label="Transactions" count={transactions.length} />
          <NavItem id={TABS.ACCOUNTS} icon="🏦" label="Comptes" count={accounts.filter(a => a.status === "actif").length} />
          <NavItem id={TABS.BUDGETS} icon="📋" label="Budgets" count={budgets.length} />
          <NavItem id={TABS.TARGETS} icon="🎯" label="Targets" count={targets.length} />
          <NavItem id={TABS.MONEYFLOW} icon="💸" label="Money Flow" count={moneyFlows.length} />
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
              {activeTab === TABS.TARGETS && "Suivez vos objectifs de revenus"}
              {activeTab === TABS.MONEYFLOW && "Flux de trésorerie"}
              {activeTab === TABS.REPORTS && "Gérez vos rapports"}
              {activeTab === TABS.SETTINGS && "Modifiez vos informations personnelles"}
            </p>
          </div>
          <div className="header-actions">
            <div className="date-box">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
            {activeTab !== TABS.SETTINGS && activeTab !== "dashboard" && addButtonType && (
              <button className="btn-primary" style={{ background: "#4299e1" }} onClick={() => openModal(addButtonType, "add")}>
                + {addButtonLabel}
              </button>
            )}
          </div>
        </div>

        {/* Filters bar — shown for most tabs */}
        {![TABS.REPORTS, TABS.SETTINGS, "dashboard"].includes(activeTab) && (
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
                  <option value="tous">Tous statuts</option><option value="respected">Respecté</option><option value="passed">Dépassé</option><option value="desactivated">Désactivé</option>
                </select>
              )}
              {activeTab === TABS.TARGETS && (
                <select className="filter-select" value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                  <option value="tous">Tous statuts</option><option value="in_progress">En cours</option><option value="reached">Atteint</option><option value="failed">Échoué</option><option value="desactivated">Désactivé</option>
                </select>
              )}
              {activeTab === TABS.MONEYFLOW && (
                <select className="filter-select" value={filters.type} onChange={e => setFilters({ ...filters, type: e.target.value })}>
                  <option value="tous">Tous types</option><option value="revenue">Revenus</option><option value="expense">Dépenses</option>
                </select>
              )}
              <button className="btn-reset-filters" onClick={resetFilters}>↻ Réinitialiser</button>
              {[TABS.TRANSACTIONS, TABS.BUDGETS, TABS.TARGETS].includes(activeTab) && (
                <button className="btn-export" onClick={() => exportToCSV(filteredData, activeTab)}>📥 Exporter</button>
              )}
            </div>
          </div>
        )}

        {/* ===== TRANSACTIONS TAB ===== */}
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

        {/* ===== ACCOUNTS TAB ===== */}
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
                    <div className="account-balance"><span>Capital</span><strong>{formatCurrency(a.capital)}</strong></div>
                    <div className="account-balance"><span>Solde</span><strong className={a.solde >= 0 ? "text-success" : "text-danger"}>{formatCurrency(a.solde)}</strong></div>
                    <div className="account-type"><span>Type</span><strong>{a.type}</strong></div>
                    {a.inMoneyFlow && <span className="status-badge" style={{ background: '#bee3f8', color: '#2b6cb0', fontSize: '0.7rem' }}>Money Flow</span>}
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

        {/* ===== BUDGETS TAB (redesigned) ===== */}
        {activeTab === TABS.BUDGETS && (
          <div className="budgets-content">
            <div className="budgets-summary">
              {[
                { label: "Budget total", value: formatCurrency(budgetTotalBudget) },
                { label: "Total utilisé", value: formatCurrency(budgetTotalUsed) },
                { label: "Variance", value: formatCurrency(budgetTotalUsed - budgetTotalBudget), className: budgetTotalUsed <= budgetTotalBudget ? "text-success" : "text-danger" },
                { label: "Taux global", value: budgetTotalBudget > 0 ? `${((budgetTotalUsed / budgetTotalBudget) * 100).toFixed(1)}%` : "0%" }
              ].map((item, i) => (
                <div key={i} className="budget-summary-card">
                  <span>{item.label}</span>
                  <strong className={item.className}>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="table-container">
              <table className="budgets-table">
                <thead><tr>
                  <th onClick={() => setSort({ key: "category", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Catégorie {sort.key === "category" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => setSort({ key: "budget", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Montant {sort.key === "budget" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Utilisé</th>
                  <th>Usage %</th>
                  <th>Statut</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {paginatedData.map(b => {
                    const percentUsed = b.budget > 0 ? ((b.usedAmount || 0) / b.budget) * 100 : 0;
                    const progressColor = percentUsed > 100 ? COLORS.danger : percentUsed > 90 ? COLORS.warning : COLORS.success;
                    return (
                      <tr key={b.id}>
                        <td className="budget-category">{b.category}{b.notes && <small className="notes-indicator" title={b.notes}>📝</small>}</td>
                        <td>{formatCurrency(b.budget)}</td>
                        <td>{formatCurrency(b.usedAmount)}</td>
                        <td>
                          <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${Math.min(percentUsed, 100)}%`, background: progressColor }}></div>
                            <span className="progress-text">{percentUsed.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td><StatusBadge status={b.status} /></td>
                        <td>{formatDate(b.startDate)}</td>
                        <td>{formatDate(b.endDate)}</td>
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
            <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />
          </div>
        )}

        {/* ===== TARGETS TAB ===== */}
        {activeTab === TABS.TARGETS && (
          <div className="budgets-content">
            <div className="budgets-summary">
              {[
                { label: "Total objectifs", value: formatCurrency(targetTotalGoal) },
                { label: "Total réalisé", value: formatCurrency(targetTotalRealised) },
                { label: "Taux de réussite", value: targetTotalGoal > 0 ? `${((targetTotalRealised / targetTotalGoal) * 100).toFixed(1)}%` : "0%" }
              ].map((item, i) => (
                <div key={i} className="budget-summary-card">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
              ))}
            </div>
            <div className="table-container">
              <table className="budgets-table">
                <thead><tr>
                  <th onClick={() => setSort({ key: "category", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Catégorie {sort.key === "category" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => setSort({ key: "amount", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Objectif {sort.key === "amount" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Réalisé</th>
                  <th>Progression %</th>
                  <th>Statut</th>
                  <th>Début</th>
                  <th>Fin</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {paginatedData.map(t => {
                    const progression = t.amount > 0 ? Math.min((t.realisedAmount / t.amount) * 100, 100) : 0;
                    const progressColor = progression >= 100 ? COLORS.success : progression > 70 ? COLORS.warning : COLORS.info;
                    return (
                      <tr key={t.id}>
                        <td className="budget-category">{t.category}{t.notes && <small className="notes-indicator" title={t.notes}>📝</small>}</td>
                        <td>{formatCurrency(t.amount)}</td>
                        <td>{formatCurrency(t.realisedAmount)}</td>
                        <td>
                          <div className="progress-bar-container">
                            <div className="progress-bar" style={{ width: `${progression}%`, background: progressColor }}></div>
                            <span className="progress-text">{progression.toFixed(1)}%</span>
                          </div>
                        </td>
                        <td><StatusBadge status={t.status} /></td>
                        <td>{formatDate(t.startDate)}</td>
                        <td>{formatDate(t.endDate)}</td>
                        <td><div className="action-buttons">
                          <button className="action-btn" onClick={() => openModal("target", "edit", t)}>✏️</button>
                          <button className="action-btn delete" onClick={() => openModal("target", "delete", t)}>🗑️</button>
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!filteredData.length && <NoResults onReset={resetFilters} />}
            </div>
            <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />
          </div>
        )}

        {/* ===== MONEY FLOW TAB ===== */}
        {activeTab === TABS.MONEYFLOW && (
          <div className="budgets-content">
            {/* Summary bar */}
            <div className="budgets-summary">
              {[
                { label: "Total revenus", value: formatCurrency(mfTotalRevenu), className: "text-success" },
                { label: "Total dépenses", value: formatCurrency(mfTotalDepense), className: "text-danger" },
                { label: "Soldes comptes", value: formatCurrency(mfSoldesComptes) },
                { label: "NET", value: formatCurrency(mfNet), className: mfNet >= 0 ? "text-success" : "text-danger" }
              ].map((item, i) => (
                <div key={i} className="budget-summary-card">
                  <span>{item.label}</span>
                  <strong className={item.className}>{item.value}</strong>
                </div>
              ))}
            </div>

            <div className="table-container">
              <table className="budgets-table">
                <thead><tr>
                  <th onClick={() => setSort({ key: "category", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Catégorie {sort.key === "category" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => setSort({ key: "amount", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Montant {sort.key === "amount" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th onClick={() => setSort({ key: "date", direction: sort.direction === "asc" ? "desc" : "asc" })}>
                    Date {sort.key === "date" && (sort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th>Type</th>
                  <th>Note</th>
                  <th>Actions</th>
                </tr></thead>
                <tbody>
                  {/* Manual MoneyFlow entries */}
                  {paginatedData.map(e => (
                    <tr key={e.id}>
                      <td className="budget-category">{e.category}</td>
                      <td className={e.isExpense ? "text-danger" : "text-success"}>
                        <strong>{e.isExpense ? "-" : "+"}{formatCurrency(e.amount)}</strong>
                      </td>
                      <td>{formatDate(e.date)}</td>
                      <td>
                        <span className="status-badge" style={{ background: e.isExpense ? COLORS.dangerBg : COLORS.successBg, color: e.isExpense ? COLORS.danger : COLORS.success }}>
                          {e.isExpense ? "Dépense" : "Revenu"}
                        </span>
                      </td>
                      <td><small>{e.note || "—"}</small></td>
                      <td><div className="action-buttons">
                        <button className="action-btn" onClick={() => openModal("moneyFlow", "edit", e)}>✏️</button>
                        <button className="action-btn delete" onClick={() => openModal("moneyFlow", "delete", e)}>🗑️</button>
                      </div></td>
                    </tr>
                  ))}
                  {/* Account balance rows (read-only) */}
                  {moneyFlowAccounts.map(a => (
                    <tr key={`acc-${a.id}`} style={{ background: "#f7fafc" }}>
                      <td className="budget-category">🏦 {a.name}</td>
                      <td className={a.solde >= 0 ? "text-success" : "text-danger"}>
                        <strong>{formatCurrency(a.solde)}</strong>
                      </td>
                      <td>—</td>
                      <td>
                        <span className="status-badge" style={{ background: COLORS.infoBg, color: COLORS.info }}>Compte</span>
                      </td>
                      <td>—</td>
                      <td>—</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!filteredData.length && moneyFlowAccounts.length === 0 && <NoResults onReset={resetFilters} />}
            </div>
            <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />
          </div>
        )}

        {/* ===== REPORTS TAB ===== */}
        {activeTab === TABS.REPORTS && (
          <div className="reports-content">
            <div className="filters-container">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input type="text" placeholder="Rechercher un rapport par titre ou description..."
                  value={filters.search}
                  onChange={e => { setFilters({ ...filters, search: e.target.value }); setPagination(p => ({ ...p, currentPage: 1 })); }}
                  className="search-input" />
                {filters.search && <button className="clear-search" onClick={() => setFilters({ ...filters, search: "" })}>×</button>}
              </div>
            </div>
            {filters.search && (
              <p style={{ margin: "0 0 12px", fontSize: "0.85rem", color: "#718096" }}>
                {filteredData.length} résultat{filteredData.length !== 1 ? "s" : ""} trouvé{filteredData.length !== 1 ? "s" : ""}
              </p>
            )}
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
                    <button className="btn-icon" title="Voir le contenu complet" onClick={() => setViewReport(r)}>👁️</button>
                    <button className="btn-icon" title="Modifier" onClick={() => openModal("report", "edit", r)}>✏️</button>
                    <button className="btn-icon" title="Télécharger en PDF" onClick={() => handleReportDownload(r)}>PDF</button>
                    <button className="btn-icon delete" title="Supprimer" onClick={() => openModal("report", "delete", r)}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>
            {!filteredData.length && <NoResults onReset={resetFilters} />}
            <Pagination total={filteredData.length} pagination={pagination} setPagination={setPagination} />
          </div>
        )}

        {/* ===== SETTINGS TAB ===== */}
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
              {modal.type === "target" && <TargetForm formData={formData} setFormData={setFormData} />}
              {modal.type === "moneyFlow" && <MoneyFlowForm formData={formData} setFormData={setFormData} />}
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
              <p>Êtes-vous sûr de vouloir supprimer cet élément ?</p>
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
        <ReportViewModal report={viewReport} onClose={() => setViewReport(null)} formatDate={formatDate} formatDateTime={formatDateTime} />
      )}
    </div>
  );
}

// ===== Sub-forms =====

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
      <div className="form-group">
        <label>Capital *</label>
        <input type="number" value={fd.balance} onChange={e => set('balance', e.target.value)} step="0.01" required />
        <small style={{ color: '#718096' }}>Le solde sera calculé : capital + transactions validées</small>
      </div>
    </div>
    <div className="form-group"><label>Numéro de compte</label><input type="text" value={fd.number} onChange={e => set('number', e.target.value)} /></div>
    <div className="form-row">
      <div className="form-group"><label>IBAN</label><input type="text" value={fd.iban} onChange={e => set('iban', e.target.value)} /></div>
      <div className="form-group"><label>BIC</label><input type="text" value={fd.bic} onChange={e => set('bic', e.target.value)} /></div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Statut</label><select value={fd.status} onChange={e => set('status', e.target.value)}>
        <option value="actif">Actif</option><option value="inactif">Inactif</option>
      </select></div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input type="checkbox" checked={Boolean(fd.inMoneyFlow)} onChange={e => set('inMoneyFlow', e.target.checked)} style={{ width: '18px', height: '18px' }} />
          Inclure dans le flux de trésorerie
        </label>
        <small style={{ color: '#718096' }}>Ce compte apparaîtra dans Money Flow</small>
      </div>
    </div>
  </>);
};

const BudgetForm = ({ formData, setFormData }) => {
  const fd = formData.budget;
  const set = (field, value) => setFormData({ ...formData, budget: { ...fd, [field]: value } });
  return (<>
    <div className="form-group">
      <label>Catégorie *</label>
      <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} placeholder="ex: salaires, loyer..." required />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Montant budget *</label>
        <input type="number" value={fd.budget} onChange={e => set('budget', e.target.value)} step="0.01" min="0" required />
      </div>
      <div className="form-group">
        <label>Montant utilisé</label>
        <input type="number" value={fd.usedAmount} onChange={e => set('usedAmount', e.target.value)} step="0.01" min="0" />
        <small style={{ color: '#718096' }}>Recalculé automatiquement par Money Flow</small>
      </div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Date début *</label><input type="date" value={fd.startDate} onChange={e => set('startDate', e.target.value)} required /></div>
      <div className="form-group"><label>Date fin *</label><input type="date" value={fd.endDate} onChange={e => set('endDate', e.target.value)} required /></div>
    </div>
    <div className="form-group">
      <label>Statut</label>
      <select value={fd.status} onChange={e => set('status', e.target.value)}>
        <option value="respected">Respecté (auto)</option>
        <option value="desactivated">Désactivé</option>
      </select>
      <small style={{ color: '#718096' }}>Seul "Désactivé" peut être défini manuellement — les autres sont calculés automatiquement</small>
    </div>
    <div className="form-group"><label>Notes</label><textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="3" /></div>
  </>);
};

const TargetForm = ({ formData, setFormData }) => {
  const fd = formData.target;
  const set = (field, value) => setFormData({ ...formData, target: { ...fd, [field]: value } });
  return (<>
    <div className="form-group">
      <label>Catégorie *</label>
      <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} placeholder="ex: ventes, abonnements..." required />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Objectif (montant) *</label>
        <input type="number" value={fd.amount} onChange={e => set('amount', e.target.value)} step="0.01" min="0" required />
      </div>
      <div className="form-group">
        <label>Réalisé</label>
        <input type="number" value={fd.realisedAmount} onChange={e => set('realisedAmount', e.target.value)} step="0.01" min="0" />
        <small style={{ color: '#718096' }}>Recalculé automatiquement par Money Flow</small>
      </div>
    </div>
    <div className="form-row">
      <div className="form-group"><label>Date début *</label><input type="date" value={fd.startDate} onChange={e => set('startDate', e.target.value)} required /></div>
      <div className="form-group"><label>Date fin *</label><input type="date" value={fd.endDate} onChange={e => set('endDate', e.target.value)} required /></div>
    </div>
    <div className="form-group">
      <label>Statut</label>
      <select value={fd.status} onChange={e => set('status', e.target.value)}>
        <option value="in_progress">En cours (auto)</option>
        <option value="desactivated">Désactivé</option>
      </select>
      <small style={{ color: '#718096' }}>Seul "Désactivé" peut être défini manuellement</small>
    </div>
    <div className="form-group"><label>Notes</label><textarea value={fd.notes} onChange={e => set('notes', e.target.value)} rows="3" /></div>
  </>);
};

const MoneyFlowForm = ({ formData, setFormData }) => {
  const fd = formData.moneyFlow;
  const set = (field, value) => setFormData({ ...formData, moneyFlow: { ...fd, [field]: value } });
  return (<>
    <div className="form-group">
      <label>Catégorie *</label>
      <input type="text" value={fd.category} onChange={e => set('category', e.target.value)} placeholder="ex: salaires, ventes..." required />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Montant *</label>
        <input type="number" value={fd.amount} onChange={e => set('amount', e.target.value)} step="0.01" min="0" required />
      </div>
      <div className="form-group"><label>Date *</label><input type="date" value={fd.date} onChange={e => set('date', e.target.value)} required /></div>
    </div>
    <div className="form-group">
      <label>Type *</label>
      <select value={fd.isExpense ? "expense" : "revenue"} onChange={e => set('isExpense', e.target.value === "expense")}>
        <option value="revenue">Revenu</option>
        <option value="expense">Dépense</option>
      </select>
    </div>
    <div className="form-group"><label>Note</label><textarea value={fd.note} onChange={e => set('note', e.target.value)} rows="3" /></div>
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
