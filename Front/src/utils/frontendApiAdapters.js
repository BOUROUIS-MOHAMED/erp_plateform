const ORDER_STATUS_MAP = {
  en_attente: 'en attente',
  confirmee: 'confirmee',
  confirmee_ascii: 'confirmee',
  'confirmée': 'confirmée',
  'préparée': 'en préparation',
  preparee: 'en préparation',
  expédiée: 'expédiée',
  expediee: 'expédiée',
  livree: 'livrée',
  'livrée': 'livrée',
  annulee: 'annulée',
  'annulée': 'annulée',
};

const PAYMENT_STATUS_MAP = {
  impaye: 'non payée',
  'impayé': 'non payée',
  partiel: 'en attente',
  paye: 'payée',
  'payée': 'payée',
  en_attente: 'en attente',
};

const INVOICE_STATUS_MAP = {
  brouillon: 'brouillon',
  envoyee: 'envoyée',
  'envoyée': 'envoyée',
  validee: 'envoyée',
  validée: 'envoyée',
  payee: 'payée',
  'payée': 'payée',
  partiellement_payee: 'en attente',
  partiellement_payée: 'en attente',
  en_retard: 'en retard',
  annulee: 'annulée',
  'annulée': 'annulée',
  avoir: 'avoir',
};

const ACCOUNT_TYPE_LABELS = {
  banque: 'Banque',
  caisse: 'Banque',
  client: 'Créance',
  fournisseur: 'Dette',
  investissement: 'Épargne',
  actif: 'Créance',
  passif: 'Dette',
  tresorerie: 'Banque',
};

const toAsciiKey = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();

export const toIsoDate = (value) => {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
};

export const extractApiErrorMessage = (error, fallback = 'Une erreur est survenue') => {
  return (
    error?.data?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
};

export const pickList = (response, keys = []) => {
  for (const key of keys) {
    const value = response?.[key];
    if (Array.isArray(value)) {
      return value;
    }
  }

  if (Array.isArray(response?.data)) {
    return response.data;
  }

  return [];
};

export const pickTotal = (response) => {
  return (
    response?.pagination?.total ??
    response?.totals?.count ??
    response?.total ??
    pickList(response).length
  );
};

export const formatCustomerDisplayName = (customer = {}) => {
  return (
    customer.company ||
    [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim() ||
    customer.name ||
    customer.email ||
    'Client'
  );
};

export const splitDisplayName = (value = '') => {
  const parts = String(value).trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: 'Client' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

export const parseAddressString = (value = '') => {
  const raw = String(value).trim();
  const match = raw.match(/^(.*?)(?:,\s*(\d{4,5})\s+(.+))?$/);

  return {
    street: match?.[1]?.trim() || raw || 'Adresse non renseignée',
    postalCode: match?.[2]?.trim() || '00000',
    city: match?.[3]?.trim() || 'Ville non renseignée',
    country: 'France',
  };
};

export const formatAddressString = (address = {}) => {
  if (typeof address === 'string') {
    return address;
  }

  const cityLine = [address.postalCode, address.city].filter(Boolean).join(' ');

  return [address.street, cityLine, address.country].filter(Boolean).join(', ');
};

export const mapUserToAdminAccount = (user = {}) => ({
  id: user.id || user._id,
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  email: user.email || '',
  role: user.role || 'user',
  department: user.department || 'Général',
  active: user.isActive !== false,
  createdAt: toIsoDate(user.createdAt) || '-',
  lastLogin: toIsoDate(user.lastLogin) || '-',
  backend: user,
});

export const mapCustomerToUi = (customer = {}) => ({
  id: customer.id || customer._id,
  name: formatCustomerDisplayName(customer),
  email: customer.email || '',
  phone: customer.phone || customer.mobile || '',
  address: formatAddressString(customer.address),
  siret: customer.siret || '',
  totalOrders: customer.totalOrders ?? customer.invoiceCount ?? 0,
  totalSpent: customer.totalSpent ?? customer.totalPaid ?? 0,
  lastOrder: toIsoDate(customer.lastOrderDate),
  status: customer.isActive === false ? 'inactif' : 'actif',
  backend: customer,
});

export const buildCustomerPayload = (form = {}, existing = null) => {
  const parsedName = splitDisplayName(form.name);
  const address = parseAddressString(form.address);

  return {
    type: existing?.backend?.type || 'professionnel',
    civility: existing?.backend?.civility || 'Société',
    firstName: parsedName.firstName || existing?.backend?.firstName || form.name?.trim() || 'Client',
    lastName: parsedName.lastName || existing?.backend?.lastName || 'Client',
    company: form.name?.trim() || existing?.backend?.company || '',
    email: form.email?.trim()?.toLowerCase() || '',
    phone: form.phone?.trim() || '',
    address,
    siret: form.siret?.trim() || '',
    isActive: form.status !== 'inactif',
  };
};

export const mapOrderToUi = (order = {}, invoiceByOrderId = new Map()) => {
  const orderNumber = order.orderNumber || order.id || order._id;
  const invoice = invoiceByOrderId.get(orderNumber);

  return {
    id: orderNumber,
    backendId: order.id || order._id,
    date: toIsoDate(order.date || order.createdAt),
    client: formatCustomerDisplayName(order.customer || {}),
    customerId: order.customer?._id || order.customer?.id || order.customer,
    items: Array.isArray(order.items)
      ? order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0)
      : 0,
    total: Number(order.totalTTC || order.total || 0),
    status: ORDER_STATUS_MAP[toAsciiKey(order.status)] || String(order.status || 'en attente'),
    paymentStatus:
      PAYMENT_STATUS_MAP[toAsciiKey(order.paymentStatus)] ||
      String(order.paymentStatus || 'en attente'),
    invoiceId: invoice?.id || '',
    backend: order,
  };
};

export const mapInvoiceToUi = (invoice = {}) => ({
  id: invoice.invoiceNumber || invoice.id || invoice._id,
  backendId: invoice.id || invoice._id,
  date: toIsoDate(invoice.date || invoice.createdAt),
  orderId: invoice.orderId || '',
  customerId: invoice.customer?._id || invoice.customer?.id || invoice.customer,
  client: formatCustomerDisplayName(invoice.customer || {}),
  amount: Number(invoice.totalTTC || invoice.amount || 0),
  status: INVOICE_STATUS_MAP[toAsciiKey(invoice.status)] || String(invoice.status || 'brouillon'),
  dueDate: toIsoDate(invoice.dueDate),
  archived: false,
  backend: invoice,
});

export const mapReportToUi = (report = {}, icon = '📄') => ({
  id: report.id || report._id,
  title: report.title || '',
  description: report.description || '',
  type: report.type || 'analytique',
  date: toIsoDate(report.date || report.createdAt),
  createdAt: report.createdAt || report.generatedAt || report.date,
  author: report.author || '',
  icon,
  stats: report.stats || null,
  backend: report,
});

export const mapCategoryToUi = (category = {}) => ({
  id: category.id || category._id,
  name: category.name || '',
  code: category.code || '',
  description: category.description || '',
  productCount: Number(category.productCount || 0),
  backend: category,
});

export const mapProductToUi = (product = {}) => ({
  id: product.id || product._id,
  name: product.name || '',
  code: product.code || product.sku || '',
  category: product.category || '',
  stock: Number(product.stock || 0),
  price: Number(product.price || 0),
  status: product.status || 'en stock',
  supplierId: product.supplierId || product.supplier?.id || '',
  backend: product,
});

export const mapSupplierToUi = (supplier = {}) => ({
  id: supplier.id || supplier._id,
  name: supplier.name || '',
  code: supplier.code || '',
  contact: supplier.contact || '',
  email: supplier.email || '',
  phone: supplier.phone || '',
  address: supplier.address || '',
  products: Number(supplier.products || 0),
  status: supplier.status || 'actif',
  since: toIsoDate(supplier.since || supplier.createdAt),
  rating: Number(supplier.rating || 0),
  backend: supplier,
});

export const mapMovementToUi = (movement = {}) => ({
  id: movement.id || movement._id,
  date: toIsoDate(movement.date || movement.createdAt),
  product: movement.product || movement.productDetails?.name || '',
  productId: movement.productId || movement.product?._id || '',
  supplierId: movement.supplierId || movement.productDetails?.supplierId || '',
  type: movement.type || 'entrée',
  quantity: Number(movement.quantity || 0),
  user: movement.user || '',
  userId: movement.userId || movement.createdBy?._id || movement.createdBy || '',
  note: movement.note || '',
  backend: movement,
});

export const mapAccountToUi = (account = {}) => {
  const key = toAsciiKey(account.category || account.type);
  const label = ACCOUNT_TYPE_LABELS[key] || account.type || 'Banque';

  return {
    id: account.id || account._id,
    backendId: account.id || account._id,
    name: account.name || '',
    balance: Number(account.balance ?? account.solde ?? 0),
    capital: Number(account.capital ?? account.balance ?? 0),
    solde: Number(account.solde ?? account.balance ?? 0),
    inMoneyFlow: Boolean(account.inMoneyFlow ?? account.inBudget),
    type: label,
    number: account.number || account.code || '',
    status: account.status || (account.isActive === false ? 'inactif' : 'actif'),
    iban: account.iban || '',
    bic: account.bic || '',
    backend: account,
  };
};

const inferTransactionType = (transaction = {}) => {
  const entries = Array.isArray(transaction.entries) ? transaction.entries : [];
  const revenueEntry = entries.find(
    (entry) => entry?.account?.type === 'produit' && Number(entry.credit) > 0
  );
  const expenseEntry = entries.find(
    (entry) => entry?.account?.type === 'charge' && Number(entry.debit) > 0
  );

  if (revenueEntry) {
    return {
      type: 'revenu',
      amount: Number(revenueEntry.credit || 0),
      account: revenueEntry.account?.name || '',
    };
  }

  if (expenseEntry) {
    return {
      type: 'depense',
      amount: Number(expenseEntry.debit || 0),
      account: expenseEntry.account?.name || '',
    };
  }

  return {
    type: 'revenu',
    amount: Number(transaction.totalCredit || transaction.totalDebit || 0),
    account: entries[0]?.account?.name || '',
  };
};

const inferTransactionCategory = (transaction = {}) => {
  const haystack = [
    transaction.description,
    ...(transaction.entries || []).map((entry) => entry?.account?.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (haystack.includes('sala')) return 'Salaires';
  if (haystack.includes('loyer')) return 'Loyer';
  if (haystack.includes('util') || haystack.includes('électric') || haystack.includes('electric')) return 'Utilities';
  if (haystack.includes('service') || haystack.includes('maintenance')) return 'Services';
  if (haystack.includes('achat') || haystack.includes('fournisseur')) return 'Achat';
  return 'Vente';
};

export const mapTransactionToUi = (transaction = {}) => {
  const inferred = inferTransactionType(transaction);

  return {
    id: transaction.transactionNumber || transaction.id || transaction._id,
    backendId: transaction.id || transaction._id,
    date: toIsoDate(transaction.date || transaction.createdAt),
    description: transaction.description || '',
    amount: inferred.amount,
    montant: inferred.amount,
    type: inferred.type,
    account: inferred.account,
    category: inferTransactionCategory(transaction),
    status:
      transaction.status === 'validé'
        ? 'complété'
        : transaction.status === 'brouillon'
          ? 'en attente'
          : String(transaction.status || 'en attente').replace(/_/g, ' '),
    notes: transaction.reference || '',
    backend: transaction,
  };
};

export const mapTargetToUi = (target = {}) => ({
  id: target.id || target._id,
  category: target.category || '',
  amount: Number(target.amount || 0),
  realisedAmount: Number(target.realisedAmount || 0),
  progression: Number(target.progression || 0),
  startDate: toIsoDate(target.startDate),
  endDate: toIsoDate(target.endDate),
  status: target.status || 'in_progress',
  notes: target.notes || '',
  backend: target,
});

export const mapMoneyFlowToUi = (entry = {}) => ({
  id: entry.id || entry._id,
  category: entry.category || '',
  amount: Number(entry.amount || 0),
  date: toIsoDate(entry.date || entry.createdAt),
  isExpense: Boolean(entry.isExpense),
  note: entry.note || '',
  backend: entry,
});
