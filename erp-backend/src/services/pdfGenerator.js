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
          
          const productName = item.product?.name || item.description || 'Article';
          doc.text(productName.substring(0, 20), itemX, y);
          doc.text((item.description || item.product?.description || '-').substring(0, 30), descX, y);
          doc.text(item.quantity.toString(), qtyX, y);
          doc.text(item.unitPrice.toFixed(3), priceX, y);
          doc.text((item.totalTTC || item.totalHT || (item.quantity * item.unitPrice)).toFixed(3), totalX, y);
          
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
        doc.text(`Sous-total HT: ${(invoice.subtotalHT || 0).toFixed(3)} DT`, 400, y);
        y += 20;
        doc.text(`TVA: ${(invoice.totalTax || 0).toFixed(3)} DT`, 400, y);
        y += 20;
        doc.fontSize(12).fillColor('#0000ff').text(`TOTAL TTC: ${(invoice.totalTTC || 0).toFixed(3)} DT`, 400, y);

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

  // Générer un rapport générique PDF
  static async generateReport(report) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        const pageWidth = doc.page.width;
        const contentWidth = pageWidth - 100; // 50px margin each side
        const primaryColor = '#2b6cb0';
        const accentColor = '#4299e1';
        const darkText = '#1a202c';
        const grayText = '#4a5568';
        const lightGray = '#e2e8f0';
        const reportDate = new Date(report.date || report.createdAt || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
        const createdDate = new Date(report.createdAt || Date.now()).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        // === HEADER BAR ===
        doc.rect(0, 0, pageWidth, 90).fill(primaryColor);
        doc.fontSize(10).font('Helvetica').fillColor('#ffffff');
        doc.text('ERP System', 50, 20);
        doc.fontSize(8).text('Rapport officiel', 50, 35);
        doc.fontSize(9).font('Helvetica').fillColor('#bee3f8');
        doc.text(reportDate, pageWidth - 200, 20, { width: 150, align: 'right' });
        doc.text(`Type: ${(report.type || 'analytique').toUpperCase()}`, pageWidth - 200, 35, { width: 150, align: 'right' });
        if (report.tags && report.tags.length > 0) {
          doc.text(`Module: ${report.tags.map(t => t.replace('source:', '')).join(', ')}`, pageWidth - 200, 50, { width: 150, align: 'right' });
        }

        // === TITLE ===
        let y = 115;
        doc.fontSize(22).font('Helvetica-Bold').fillColor(darkText);
        doc.text(report.title || 'Rapport', 50, y, { width: contentWidth });
        y = doc.y + 8;

        // Accent line under title
        doc.rect(50, y, 60, 3).fill(accentColor);
        y += 20;

        // === META INFO BOX ===
        doc.roundedRect(50, y, contentWidth, 50, 6).fill('#f7fafc').stroke(lightGray);
        doc.fontSize(8).font('Helvetica-Bold').fillColor(grayText);
        doc.text('DATE DU RAPPORT', 70, y + 10);
        doc.text('CREE LE', 250, y + 10);
        doc.text('AUTEUR', 430, y + 10);
        doc.fontSize(9).font('Helvetica').fillColor(darkText);
        doc.text(reportDate, 70, y + 25);
        doc.text(createdDate, 250, y + 25);
        doc.text(report.author || 'Administrateur', 430, y + 25);
        y += 70;

        // === DESCRIPTION ===
        if (report.description) {
          doc.fontSize(13).font('Helvetica-Bold').fillColor(primaryColor);
          doc.text('Description', 50, y);
          y = doc.y + 8;

          doc.fontSize(10.5).font('Helvetica').fillColor(grayText);
          doc.text(report.description, 50, y, { width: contentWidth, lineGap: 5, align: 'justify' });
          y = doc.y + 20;
        }

        // === DATA SECTION ===
        if (report.data && typeof report.data === 'object') {
          y = this._checkPageBreak(doc, y, 120);

          doc.fontSize(13).font('Helvetica-Bold').fillColor(primaryColor);
          doc.text('Donnees detaillees', 50, y);
          y = doc.y + 10;

          const entries = Object.entries(report.data);
          const colKeyWidth = 200;
          const colValX = 50 + colKeyWidth + 10;

          // Table header
          doc.rect(50, y, contentWidth, 24).fill(primaryColor);
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#ffffff');
          doc.text('Indicateur', 60, y + 7, { width: colKeyWidth });
          doc.text('Valeur', colValX, y + 7, { width: contentWidth - colKeyWidth - 10 });
          y += 24;

          entries.forEach(([key, value], index) => {
            y = this._checkPageBreak(doc, y);
            const bgColor = index % 2 === 0 ? '#f7fafc' : '#ffffff';
            const displayVal = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
            const rowHeight = Math.max(20, Math.ceil(displayVal.length / 50) * 14 + 8);

            doc.rect(50, y, contentWidth, rowHeight).fill(bgColor);
            doc.fontSize(9).font('Helvetica-Bold').fillColor(darkText);
            doc.text(key, 60, y + 5, { width: colKeyWidth });
            doc.fontSize(9).font('Helvetica').fillColor(grayText);
            doc.text(displayVal, colValX, y + 5, { width: contentWidth - colKeyWidth - 20 });
            y += rowHeight;
          });

          // Bottom border
          doc.rect(50, y, contentWidth, 1).fill(lightGray);
          y += 15;
        }

        // === PARAMETERS SECTION ===
        if (report.parameters && typeof report.parameters === 'object' && Object.keys(report.parameters).length > 0) {
          y = this._checkPageBreak(doc, y, 80);

          doc.fontSize(13).font('Helvetica-Bold').fillColor(primaryColor);
          doc.text('Parametres', 50, y);
          y = doc.y + 8;

          Object.entries(report.parameters).forEach(([key, value]) => {
            y = this._checkPageBreak(doc, y);
            doc.fontSize(9).font('Helvetica-Bold').fillColor(darkText).text(`${key}: `, 60, y, { continued: true });
            doc.font('Helvetica').fillColor(grayText).text(String(value));
            y = doc.y + 4;
          });
          y += 10;
        }

        // === FOOTER ===
        const footerY = doc.page.height - 60;
        doc.rect(0, footerY - 5, pageWidth, 1).fill(lightGray);
        doc.fontSize(7).font('Helvetica').fillColor('#a0aec0');
        doc.text('Document officiel genere automatiquement par ERP System', 50, footerY + 5, { width: contentWidth, align: 'center' });
        doc.text(`Ref: RPT-${(report._id || '').toString().slice(-8).toUpperCase()} | ${new Date().toLocaleDateString('fr-FR')}`, 50, footerY + 18, { width: contentWidth, align: 'center' });

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
module.exports.generatePDF = (report) => PDFGenerator.generateReport(report);