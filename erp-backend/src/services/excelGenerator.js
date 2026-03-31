const ExcelJS = require('exceljs');

class ExcelGenerator {
  // Exporter la liste des produits
  static async exportProducts(products) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Produits');

    // En-têtes
    worksheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Nom', key: 'name', width: 30 },
      { header: 'Catégorie', key: 'category', width: 20 },
      { header: 'Prix Achat', key: 'purchasePrice', width: 15 },
      { header: 'Prix Vente', key: 'sellingPrice', width: 15 },
      { header: 'Stock', key: 'currentStock', width: 10 },
      { header: 'Seuil Alerte', key: 'alertThreshold', width: 10 },
      { header: 'Unité', key: 'unit', width: 10 }
    ];

    // Style des en-têtes
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    // Ajouter les données
    products.forEach(product => {
      worksheet.addRow({
        sku: product.sku,
        name: product.name,
        category: product.category,
        purchasePrice: product.purchasePrice,
        sellingPrice: product.sellingPrice,
        currentStock: product.currentStock,
        alertThreshold: product.alertThreshold,
        unit: product.unit
      });
    });

    return workbook;
  }

  // Exporter les factures
  static async exportInvoices(invoices) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Factures');

    worksheet.columns = [
      { header: 'N° Facture', key: 'invoiceNumber', width: 20 },
      { header: 'Client', key: 'customer', width: 30 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Montant', key: 'total', width: 15 },
      { header: 'Statut', key: 'status', width: 15 },
      { header: 'Échéance', key: 'dueDate', width: 15 }
    ];

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    invoices.forEach(invoice => {
      worksheet.addRow({
        invoiceNumber: invoice.invoiceNumber,
        customer: invoice.customer?.name || 'N/A',
        date: new Date(invoice.createdAt).toLocaleDateString(),
        total: invoice.total,
        status: invoice.status,
        dueDate: new Date(invoice.dueDate).toLocaleDateString()
      });
    });

    return workbook;
  }
}

module.exports = ExcelGenerator;