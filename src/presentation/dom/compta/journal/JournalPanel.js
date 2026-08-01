/**
 * JournalPanel — popup journal comptable (DOM + événements).
 * Rendu : JournalPresenter.js
 */

import { renderJournalList } from './JournalPresenter.js';

/**
 * @type {{
 *   accounting: object,
 *   popupManager?: object | null,
 * } | null}
 */
let deps = null;

/**
 * @param {{
 *   accounting: object,
 *   popupManager?: object | null,
 * }} panelDeps
 */
export function initJournalPopup(panelDeps) {
  deps = panelDeps;
  const { popupManager } = deps;

  const journalBtn = document.getElementById('journal-btn');
  const journalPanel = document.getElementById('journal-panel');
  const journalCloseBtn = document.querySelector('.journal-close-btn');
  const journalRefreshBtn = document.getElementById('journal-refresh-btn');
  const filterButtons = document.querySelectorAll('.journal-filter-btn');

  if (!journalBtn || !journalPanel || !journalCloseBtn || !journalRefreshBtn) {
    console.warn('Journal popup elements not found');
    return;
  }

  journalBtn.addEventListener('click', () => {
    journalPanel.classList.add('active');
    popupManager?.forceOpenPopup('journal-panel');
    loadJournalEntries('all');
  });

  journalCloseBtn.addEventListener('click', () => {
    journalPanel.classList.remove('active');
    popupManager?.forceClosePopup('journal-panel');
  });

  journalPanel.addEventListener('click', (e) => {
    if (e.target === journalPanel) {
      journalPanel.classList.remove('active');
      popupManager?.forceClosePopup('journal-panel');
    }
  });

  journalRefreshBtn.addEventListener('click', () => {
    const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
    const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
    loadJournalEntries(currentPeriod);
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      filterButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const activePill = document.querySelector('.journal-filter-pill.active');
      const typeFilter = activePill ? JSON.parse(activePill.dataset.types || '[]') : null;
      loadJournalEntries(btn.dataset.period, typeFilter);
    });
  });

  const filterPills = document.querySelectorAll('.journal-filter-pill');
  filterPills.forEach((pill) => {
    pill.addEventListener('click', () => {
      if (pill.classList.contains('active')) {
        pill.classList.remove('active');
        const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadJournalEntries(currentPeriod, null);
      } else {
        filterPills.forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        const typeFilter = JSON.parse(pill.dataset.types || '[]');
        const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadJournalEntries(currentPeriod, typeFilter);
      }
    });
  });

  const exportJsonBtn = document.getElementById('journal-export-json-btn');
  const exportPdfBtn = document.getElementById('journal-export-pdf-btn');

  if (exportJsonBtn) {
    exportJsonBtn.addEventListener('click', async () => {
      await exportJournalToJSON();
    });
  }

  if (exportPdfBtn) {
    exportPdfBtn.addEventListener('click', async () => {
      await exportJournalToPDF();
    });
  }
}

/** @param {string} period */
function parsePeriodDays(period) {
  if (period === 'all' || period == null) {
    return null;
  }
  const days = parseInt(period, 10);
  return Number.isNaN(days) ? null : days;
}

/**
 * @param {string} [period='all']
 * @param {string[]|null} [typeFilter=null]
 */
export async function loadJournalEntries(period = 'all', typeFilter = null) {
  if (!deps?.accounting) {
    console.warn('[JournalPanel] deps not initialized');
    return;
  }

  const { accounting } = deps;
  const journalList = document.getElementById('journal-list');
  if (!journalList) return;

  journalList.innerHTML = `
        <div class="journal-loading">
            <div class="loading-spinner"></div>
            <p>Chargement du journal...</p>
        </div>
    `;

  try {
    const ledger = await accounting.getGeneralLedger({
      periodDays: parsePeriodDays(period),
      types: typeFilter,
    });

    if (ledger.years.length === 0) {
      journalList.innerHTML = `
                <div class="no-journal-entries">
                    <div class="no-journal-entries-icon">📔</div>
                    <div class="no-journal-entries-text">Aucune écriture dans le journal</div>
                </div>
            `;
      return;
    }

    journalList.innerHTML = renderJournalList(ledger, accounting);
  } catch (error) {
    console.error('Error loading journal entries:', error);
    journalList.innerHTML = `
            <div class="journal-loading">
                <p>Erreur lors du chargement du journal: ${error.message}</p>
            </div>
        `;
  }
}

export async function exportJournalToJSON() {
  if (!deps?.accounting) return;
  try {
    const jsonString = await deps.accounting.exportJournalJson();
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('[Journal] Error exporting to JSON:', error);
    alert("Erreur lors de l'export JSON: " + error.message);
  }
}

export async function exportJournalToPDF() {
  if (!deps?.accounting) return;
  try {
    const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.disabled = true;
      exportPdfBtn.innerHTML = '<span>Génération...</span>';
    }

    const pdfBlob = await deps.accounting.exportJournalPdf();
    const url = URL.createObjectURL(pdfBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `journal-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    if (exportPdfBtn) {
      exportPdfBtn.disabled = false;
      exportPdfBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    <path d="M10 9H8"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                </svg>
                PDF
            `;
    }
  } catch (error) {
    console.error('[Journal] Error exporting to PDF:', error);
    alert("Erreur lors de l'export PDF: " + error.message);

    const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
    if (exportPdfBtn) {
      exportPdfBtn.disabled = false;
      exportPdfBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-file-text">
                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                    <path d="M14 2v4a2 2 0 0 0 2 2h4"/>
                    <path d="M10 9H8"/>
                    <path d="M16 13H8"/>
                    <path d="M16 17H8"/>
                </svg>
                PDF
            `;
    }
  }
}
