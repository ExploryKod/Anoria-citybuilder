/**
 * Journal UI presenter — DOM + events only (Phase 2b).
 * Data: acl/accounting.js → GetGeneralLedger
 * Export JSON/PDF: legacy store until Phase 3+
 */

import { getGeneralLedger } from '../../acl/accounting.js';
import {
  formatJournalEntryDetails,
} from './formatJournalEntryDescription.js';

/**
 * Initialise le popup du journal
 */
export function initJournalPopup() {
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
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('journal-panel');
        }
        loadJournalEntries('all');
    });

    journalCloseBtn.addEventListener('click', () => {
        journalPanel.classList.remove('active');
        if (window.popupManager) {
            window.popupManager.forceClosePopup('journal-panel');
        }
    });

    journalPanel.addEventListener('click', (e) => {
        if (e.target === journalPanel) {
            journalPanel.classList.remove('active');
            if (window.popupManager) {
                window.popupManager.forceClosePopup('journal-panel');
            }
        }
    });

    journalRefreshBtn.addEventListener('click', () => {
        const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadJournalEntries(currentPeriod);
    });

    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const activePill = document.querySelector('.journal-filter-pill.active');
            const typeFilter = activePill ? JSON.parse(activePill.dataset.types || '[]') : null;
            loadJournalEntries(btn.dataset.period, typeFilter);
        });
    });

    const filterPills = document.querySelectorAll('.journal-filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            if (pill.classList.contains('active')) {
                pill.classList.remove('active');
                const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
                const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
                loadJournalEntries(currentPeriod, null);
            } else {
                filterPills.forEach(p => p.classList.remove('active'));
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
 * Charge et affiche les entrées du journal via Accounting BC
 * @param {string} [period='all']
 * @param {string[]|null} [typeFilter=null]
 */
export async function loadJournalEntries(period = 'all', typeFilter = null) {
    const journalList = document.getElementById('journal-list');
    if (!journalList) return;

    journalList.innerHTML = `
        <div class="journal-loading">
            <div class="loading-spinner"></div>
            <p>Chargement du journal...</p>
        </div>
    `;

    try {
        const ledger = await getGeneralLedger({
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

        journalList.innerHTML = renderGeneralLedger(ledger);
    } catch (error) {
        console.error('Error loading journal entries:', error);
        journalList.innerHTML = `
            <div class="journal-loading">
                <p>Erreur lors du chargement du journal: ${error.message}</p>
            </div>
        `;
    }
}

/** @param {import('../../../contexts/accounting/domain/read-models/GeneralLedgerView.js').GeneralLedgerView} ledger */
function renderGeneralLedger(ledger) {
    return ledger.years.map(yearData => {
        const yearDisplay = yearData.year === 0 ? '0 JC' : `${yearData.year} ap JC`;
        const displayBalance = yearData.displayBalance;
        const balanceClass = displayBalance >= 0 ? 'positive' : 'negative';

        return `
            <div class="journal-year-group">
                <div class="journal-year-header">
                    <h3>Année ${yearDisplay}</h3>
                    <div class="journal-year-summary">
                        <div class="journal-summary-item income">
                            <span class="label">Revenus:</span>
                            <span class="amount">+${yearData.incomeTotal}€</span>
                        </div>
                        <div class="journal-summary-item expenses">
                            <span class="label">Dépenses:</span>
                            <span class="amount">-${yearData.expensesTotal}€</span>
                        </div>
                        <div class="journal-summary-item netflow ${balanceClass}">
                            <span class="label">Solde:</span>
                            <span class="amount">${displayBalance >= 0 ? '+' : ''}${displayBalance}€</span>
                        </div>
                    </div>
                </div>

                ${yearData.months.map(monthData => {
                    const yearDisplayMonth = monthData.year === 0 ? '0 JC' : `${monthData.year} ap JC`;
                    const monthNetClass = monthData.netFlow >= 0 ? 'positive' : 'negative';

                    return `
                        <div class="journal-month-group">
                            <div class="journal-month-header">
                                <h4>${monthData.monthName} ${yearDisplayMonth}</h4>
                                <div class="journal-month-summary">
                                    <div class="journal-summary-item income">
                                        <span class="label">Revenus:</span>
                                        <span class="amount">+${monthData.incomeTotal}€</span>
                                    </div>
                                    <div class="journal-summary-item expenses">
                                        <span class="label">Dépenses:</span>
                                        <span class="amount">-${monthData.expensesTotal}€</span>
                                    </div>
                                    <div class="journal-summary-item netflow ${monthNetClass}">
                                        <span class="label">Solde:</span>
                                        <span class="amount">${monthData.netFlow >= 0 ? '+' : ''}${monthData.netFlow}€</span>
                                    </div>
                                </div>
                            </div>
                            <div class="journal-month-entries">
                                ${monthData.entries.map(entry => createJournalEntryHTML(entry)).join('')}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }).join('');
}

/**
 * Export JSON — legacy store (Phase 3+)
 */
export async function exportJournalToJSON() {
    try {
        const manager = window.journalManager || window.app?.journalManager || window.budgetManager;
        if (!manager) {
            throw new Error('JournalManager not available');
        }

        const jsonString = await manager.exportToJSON();
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
        alert('Erreur lors de l\'export JSON: ' + error.message);
    }
}

/**
 * Export PDF — legacy store (Phase 3+)
 */
export async function exportJournalToPDF() {
    try {
        const manager = window.journalManager || window.app?.journalManager || window.budgetManager;
        if (!manager) {
            throw new Error('JournalManager not available');
        }

        const exportPdfBtn = document.getElementById('journal-export-pdf-btn');
        if (exportPdfBtn) {
            exportPdfBtn.disabled = true;
            exportPdfBtn.innerHTML = '<span>Génération...</span>';
        }

        const pdfBlob = await manager.exportToPDF();
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
        alert('Erreur lors de l\'export PDF: ' + error.message);

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

/**
 * Crée le HTML pour une entrée du journal
 */
function createJournalEntryHTML(entry) {
    const date = new Date(entry.date);
    const formattedDate = date.toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    let yearDisplay = '';
    if (window.TimeManager && entry.turn !== undefined) {
        const timeInfo = window.TimeManager.getTimeInfo(entry.turn);
        yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
    }

    let isIncome = false;

    if (entry.type === 'cumul_maintenance' ||
        entry.type === 'cumul_construction' ||
        entry.type === 'cumul_salary' ||
        entry.type === 'cumul_exceptional_expenses' ||
        entry.type === 'cumul_loan_interest' ||
        entry.type === 'cumul_loan_repayment') {
        isIncome = false;
    } else if (entry.type === 'balance') {
        isIncome = entry.amount >= 0;
    } else if (entry.type === 'citizen_tax' || entry.type === 'payroll_tax' || entry.type === 'capital_funds' || entry.type === 'loan_capital') {
        isIncome = true;
    } else if (entry.type.startsWith('export_')) {
        isIncome = true;
    } else if (entry.type.startsWith('import_')) {
        isIncome = false;
    } else if (entry.type === 'salary' || entry.type === 'maintenance' || entry.type === 'construction' || entry.type === 'exceptional_expenses' || entry.type === 'commercial_route') {
        isIncome = false;
    } else if (entry.type === 'carry_forward') {
        isIncome = entry.isCarryForwardIncome !== undefined ? entry.isCarryForwardIncome : true;
    }

    const typeClass = isIncome ? 'positive' : 'negative';

    const typeLabels = {
        'citizen_tax': 'Impôt Citoyen',
        'payroll_tax': 'Impôt sur les salaires',
        'capital_funds': 'Capital de départ',
        'carry_forward': 'Report à nouveau',
        'construction': 'Construction',
        'exceptional_expenses': 'Réparation',
        'maintenance': 'Maintenance mensuelle',
        'salary': 'Salaires',
        'import_wheat': 'Import Blé',
        'import_carrot': 'Import Carotte',
        'import_cabbage': 'Import Chou',
        'import_wood': 'Import Bois',
        'import_dattes': 'Import Dattes',
        'export_wheat': 'Export Blé',
        'export_carrot': 'Export Carotte',
        'export_cabbage': 'Export Chou',
        'export_wood': 'Export Bois',
        'export_dattes': 'Export Dattes',
        'commercial_route': 'Commission Négociants',
        'loan_capital': 'Capital Prêt',
        'loan_interest': 'Intérêts prêt',
        'loan_repayment': 'Remboursement prêt',
        'cumul_maintenance': 'Cumul Maintenance',
        'cumul_construction': 'Cumul Construction',
        'cumul_salary': 'Cumul Salaires',
        'cumul_exceptional_expenses': 'Cumul Réparations',
        'cumul_loan_interest': 'Cumul Intérêts Prêt',
        'cumul_loan_repayment': 'Cumul Remboursement Prêt',
        'balance': 'Solde'
    };

    const breakdownMatch = entry.description?.match(/\|BREAKDOWN\|(.*?)\|BREAKDOWN\|/);
    let breakdownItems = null;

    const supportsBreakdown = entry.type === 'maintenance' ||
                              entry.type === 'commercial_route' ||
                              entry.type.startsWith('import_') ||
                              entry.type.startsWith('export_');

    if (breakdownMatch && supportsBreakdown) {
        try {
            breakdownItems = JSON.parse(breakdownMatch[1]);
        } catch (e) {
            console.warn('Failed to parse breakdown:', e);
        }
    }

    const entryDetails = formatJournalEntryDetails(entry);

    let partnerName = null;
    if (entry.partnerId && (entry.type.startsWith('import_') || entry.type.startsWith('export_') || entry.type === 'commercial_route')) {
        try {
            const partnersData = localStorage.getItem('commerce_partners');
            if (partnersData) {
                const partners = JSON.parse(partnersData);
                const partner = partners.find(p => p.id === entry.partnerId);
                if (partner) {
                    partnerName = partner.name;
                }
            }
        } catch (e) {
            console.warn('Failed to get partner name:', e);
        }
    }

    return `
        <div class="journal-entry">
            <div class="journal-entry-header">
                <span class="journal-entry-type ${entry.type}">${typeLabels[entry.type] || entry.type}</span>
                ${partnerName ? `<span class="journal-entry-partner">🤝 ${partnerName}</span>` : ''}
                <span class="journal-entry-amount ${typeClass}">
                    ${typeClass === 'positive' ? '+' : '-'}${Math.abs(entry.amount)}€
                </span>
            </div>
            <div class="journal-entry-details">
                ${entryDetails.length ? `
                <div class="journal-entry-facts">
                    ${entryDetails.map(({ label, value }) => `
                        <span class="journal-entry-fact">
                            <span class="journal-entry-fact-label">${label}:</span>
                            <span class="journal-entry-fact-value">${value}</span>
                        </span>
                    `).join('')}
                </div>
                ` : ''}
                ${breakdownItems ? `
                <ul class="journal-maintenance-breakdown">
                    ${breakdownItems.map(item => `
                        <li class="journal-breakdown-item">
                            <span class="breakdown-label">${item.label}:</span>
                            <span class="breakdown-count">${item.quantity || item.count}</span>
                            <span class="breakdown-multiply">×</span>
                            <span class="breakdown-unit-cost">${item.unitCost}€</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-total">${item.total}€</span>
                        </li>
                    `).join('')}
                </ul>
                ` : ''}
                <div class="journal-entry-meta">
                    ${entry.id != null ? `<span class="journal-entry-id">N° ${entry.id}</span>` : ''}
                    ${yearDisplay ? `<span class="journal-entry-year">Année: ${yearDisplay}</span>` : ''}
                    ${entry.turn !== undefined ? `<span class="journal-entry-turn-number">Tour: ${entry.turn}</span>` : ''}
                    <span class="journal-entry-date">${formattedDate}</span>
                </div>
            </div>
        </div>
    `;
}
