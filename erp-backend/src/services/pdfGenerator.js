const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

class PDFGenerator {
  // Méthode utilitaire pour gérer les sauts de page
  static _checkPageBreak(doc, y, margin = 100) {
    if (y > doc.page.height - margin) {
      doc.addPage();
      return 50; // Nouvelle position y
    }
    return y;
  }

  // Générer une facture PDF
  static async generateInvoice(invoice, customer, items) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        // Logo (si disponible)
        // doc.image('path/to/logo.png', 50, 45, { width: 50 });

        // En-tête
        doc.fontSize(20).text('FACTURE', { align: 'center' });
        doc.moveDown();
        
        // Informations société
        doc.fontSize(8).font('Helvetica');
        doc.text('ERP System', 50, 45);
        doc.text('123 Rue de l\'ERP', 50, 60);
        doc.text('1000 Tunis, Tunisie', 50, 75);
        doc.text('Tél: +216 00 000 000', 50, 90);

        // Informations facture (alignées à droite)
        doc.fontSize(10);
        doc.text(`N° Facture: ${invoice.invoiceNumber}`, 400, 45);
        doc.text(`Date: ${new Date(invoice.createdAt).toLocaleDateString('fr-FR')}`, 400, 60);
        doc.text(`Échéance: ${new Date(invoice.dueDate).toLocaleDateString('fr-FR')}`, 400, 75);
        doc.moveDown();

        // Informations client
        doc.moveDown();
        doc.fontSize(12).text('Client:', { underline: true });
        doc.fontSize(10);
        doc.text(customer.fullName || `${customer.firstName} ${customer.lastName}`);
        if (customer.email) doc.text(`Email: ${customer.email}`);
        if (customer.phone) doc.text(`Tél: ${customer.phone}`);
        if (customer.address) {
          const address = customer.address;
          doc.text(`Adresse: ${address.street}, ${address.postalCode} ${address.city}`);
        }
        doc.moveDown();

        // Tableau des articles
        let y = doc.y;
        const tableTop = y;
        const itemX = 50;
        const descX = 150;
        const qtyX = 350;
        const priceX = 400;
        const totalX = 470;

        // Ligne de séparation
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 10;

        // En-têtes du tableau
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Article', itemX, y);
        doc.text('Description', descX, y);
        doc.text('Qté', qtyX, y);
        doc.text('P.U. (DT)', priceX, y);
        doc.text('Total (DT)', totalX, y);
        doc.font('Helvetica');

        // Ligne de séparation
        y += 15;
        doc.moveTo(50, y).lineTo(550, y).stroke();
        y += 10;

        // Lignes du tableau
        items.forEach((item, index) => {
          // Vérifier saut de page
          y = this._checkPageBreak(doc, y);
          
          doc.text(item.product.name.substring(0, 20), itemX, y);
          doc.text(item.product.description?.substring(0, 30) || '-', descX, y);
          doc.text(item.quantity.toString(), qtyX, y);
          doc.text(item.unitPrice.toFixed(3), priceX, y);
          doc.text(item.totalPrice.toFixed(3), totalX, y);
          
          y += 20;
          
          // Ligne de séparation légère entre les articles
          if (index < items.length - 1) {
            doc.strokeColor('#cccccc').moveTo(50, y-10).lineTo(550, y-10).stroke();
          }
        });

        // Ligne de séparation finale
        doc.strokeColor('#000000').moveTo(50, y).lineTo(550, y).stroke();
        y += 15;

        // Totaux
        y = this._checkPageBreak(doc, y);
        
        doc.font('Helvetica-Bold');
        doc.text(`Sous-total: ${invoice.subtotal.toFixed(3)} DT`, 400, y);
        y += 20;
        doc.text(`TVA (19%): ${invoice.tax.toFixed(3)} DT`, 400, y);
        y += 20;
        doc.fontSize(12).fillColor('#0000ff').text(`TOTAL TTC: ${invoice.total.toFixed(3)} DT`, 400, y);

        // Conditions de paiement
        y += 40;
        y = this._checkPageBreak(doc, y);
        doc.fontSize(8).fillColor('#000000');
        doc.text('Conditions de paiement: Paiement à réception', 50, y);
        doc.text('IBAN: TN59 1234 5678 9012 3456 7890', 50, y + 15);

        // Pied de page
        doc.fontSize(8).font('Helvetica');
        doc.text(
          'Document généré automatiquement - ERP System - Merci de votre confiance',
          50,
          doc.page.height - 50,
          { align: 'center' }
        );

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Générer un devis
  static async generateQuote(quote, customer, items) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        doc.fontSize(20).text('DEVIS', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`N° Devis: ${quote.quoteNumber || 'DEV-001'}`);
        doc.text(`Date: ${new Date().toLocaleDateString('fr-FR')}`);
        doc.text(`Valable jusqu'au: ${new Date(Date.now() + 30*24*60*60*1000).toLocaleDateString('fr-FR')}`);
        doc.moveDown();

        // Informations client
        doc.fontSize(12).text('Client:', { underline: true });
        doc.fontSize(10);
        doc.text(customer.fullName || `${customer.firstName} ${customer.lastName}`);
        doc.text(`Email: ${customer.email}`);
        if (customer.phone) doc.text(`Tél: ${customer.phone}`);
        doc.moveDown();

        doc.text('Devis valable 30 jours. Sous réserve d\'acceptation.');
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  // Générer un rapport financier PDF
  static async generateFinancialReport(data, period) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfData = Buffer.concat(buffers);
          resolve(pdfData);
        });

        doc.fontSize(20).text('RAPPORT FINANCIER', { align: 'center' });
        doc.moveDown();
        doc.fontSize(12).text(`Période: ${period}`);
        doc.moveDown();

        // Trésorerie
        doc.fontSize(14).text('Trésorerie', { underline: true });
        doc.fontSize(12);
        doc.text(`Total: ${data.tresorerie.total.toFixed(3)} DT`);
        if (data.tresorerie.details) {
          data.tresorerie.details.forEach(acc => {
            doc.text(`  ${acc.code} - ${acc.name}: ${acc.balance.toFixed(3)} DT`);
          });
        }
        doc.moveDown();

        // Créances
        doc.fontSize(14).text('Créances Clients', { underline: true });
        doc.fontSize(12);
        doc.text(`Total: ${data.creances.total.toFixed(3)} DT`);
        doc.text(`Nombre de factures: ${data.creances.count}`);
        doc.moveDown();

        // Dettes
        if (data.dettes) {
          doc.fontSize(14).text('Dettes Fournisseurs', { underline: true });
          doc.fontSize(12);
          doc.text(`Total: ${data.dettes.total.toFixed(3)} DT`);
          doc.moveDown();
        }

        // Chiffre d'affaires
        doc.fontSize(14).text('Chiffre d\'affaires', { underline: true });
        doc.fontSize(12);
        doc.text(`CA mensuel: ${data.chiffreAffairesMois?.toFixed(3) || 0} DT`);
        
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = PDFGenerator;