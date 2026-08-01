import {
  filterJournalEntriesForPdfExport,
  isJournalIncomeType,
} from '../../../domain/policies/JournalExportFilterPolicy.js';
import { journalEntryTypeLabel } from '../../../presentation/JournalExportViewModel.js';

/**
 * Browser infrastructure — renders journal export PDF via jsPDF (CDN).
 */
export class BrowserJournalPdfExporter {
  /** @returns {Promise<void>} */
  async loadJSPDF() {
    if (typeof window === 'undefined') {
      throw new Error('BrowserJournalPdfExporter requires a browser environment');
    }

    return new Promise((resolve, reject) => {
      if (typeof window.jsPDF !== 'undefined' || (window.jspdf && window.jspdf.jsPDF)) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => {
        if (typeof window.jsPDF !== 'undefined' || (window.jspdf && window.jspdf.jsPDF)) {
          resolve();
        } else {
          reject(new Error('jsPDF failed to load'));
        }
      };
      script.onerror = () => reject(new Error('Failed to load jsPDF from CDN'));
      document.head.appendChild(script);
    });
  }

  /**
   * @param {object} params
   * @param {Array<object>} params.entries
   * @param {Array<object>} params.yearlySummary
   * @returns {Promise<Blob>}
   */
  async export({ entries, yearlySummary }) {
    if (typeof window === 'undefined') {
      throw new Error('BrowserJournalPdfExporter requires a browser environment');
    }

    if (typeof window.jsPDF === 'undefined' && !(window.jspdf && window.jspdf.jsPDF)) {
      await this.loadJSPDF();
    }

    const jsPDF = window.jsPDF || (window.jspdf && window.jspdf.jsPDF);
    if (!jsPDF) {
      throw new Error('jsPDF not available after loading');
    }

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Journal des Écritures Comptables', 14, 20);

    doc.setFontSize(10);
    doc.text(`Exporté le: ${new Date().toLocaleString('fr-FR')}`, 14, 30);

    let yPosition = 40;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 14;
    const lineHeight = 7;

    doc.setFontSize(14);
    doc.text('Résumé par Année', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(10);
    yearlySummary.forEach((yearData) => {
      if (yPosition > pageHeight - 30) {
        doc.addPage();
        yPosition = margin;
      }

      const yearDisplay = yearData.year === 0 ? '0 JC' : `${yearData.year} ap JC`;
      doc.setFont(undefined, 'bold');
      doc.text(`Année ${yearDisplay}`, margin, yPosition);
      yPosition += lineHeight;

      doc.setFont(undefined, 'normal');
      doc.text(`Revenus: ${yearData.income.total}€`, margin + 5, yPosition);
      yPosition += lineHeight;
      doc.text(`Dépenses: ${yearData.expenses.total}€`, margin + 5, yPosition);
      yPosition += lineHeight;

      const netFlowColor = yearData.netFlow >= 0 ? [0, 128, 0] : [255, 0, 0];
      doc.setTextColor(...netFlowColor);
      doc.text(`Solde: ${yearData.netFlow >= 0 ? '+' : ''}${yearData.netFlow}€`, margin + 5, yPosition);
      doc.setTextColor(0, 0, 0);
      yPosition += lineHeight + 3;
    });

    yPosition += 5;
    doc.setFontSize(14);
    doc.text('Détail des Écritures', margin, yPosition);
    yPosition += 10;

    doc.setFontSize(8);
    const entriesToExport = filterJournalEntriesForPdfExport(entries);
    const maxEntries = Math.min(entriesToExport.length, 100);

    for (let i = 0; i < maxEntries; i += 1) {
      const entry = entriesToExport[i];

      if (yPosition > pageHeight - 20) {
        doc.addPage();
        yPosition = margin;
      }

      const date = new Date(entry.date).toLocaleDateString('fr-FR');
      const typeLabel = journalEntryTypeLabel(entry);
      const amountText = isJournalIncomeType(entry) ? `+${entry.amount}€` : `-${entry.amount}€`;

      doc.text(`${date} - ${typeLabel}: ${amountText}`, margin, yPosition);
      yPosition += lineHeight;
      doc.text(`  ${entry.description}`, margin + 5, yPosition);
      yPosition += lineHeight + 2;
    }

    if (entriesToExport.length > maxEntries) {
      doc.text(`... et ${entriesToExport.length - maxEntries} autres entrées`, margin, yPosition);
    }

    return doc.output('blob');
  }
}
