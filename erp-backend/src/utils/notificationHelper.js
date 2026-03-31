const { createNotification } = require('../controllers/notificationController');

// Notification stock faible
const notifyLowStock = async (product, currentStock) => {
  const users = await User.find({ 
    role: { $in: ['admin_stock', 'admin_principal'] } 
  });
  
  for (const user of users) {
    await createNotification(
      user._id,
      'stock_faible',
      '⚠️ Stock faible',
      `Le produit "${product.name}" a un stock critique (${currentStock} unités)`,
      { productId: product._id, productName: product.name, stock: currentStock },
      'haute'
    );
  }
};

// Notification facture impayée
const notifyUnpaidInvoice = async (invoice) => {
  const users = await User.find({ 
    role: { $in: ['admin_facture', 'admin_principal'] } 
  });
  
  for (const user of users) {
    await createNotification(
      user._id,
      'facture_impayee',
      '💰 Facture impayée',
      `La facture ${invoice.invoiceNumber} est impayée depuis le ${new Date(invoice.dueDate).toLocaleDateString()}`,
      { invoiceId: invoice._id, invoiceNumber: invoice.invoiceNumber, amount: invoice.total },
      'moyenne'
    );
  }
};

module.exports = {
  notifyLowStock,
  notifyUnpaidInvoice
};