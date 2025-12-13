/**
 * JournalManager - Gère l'affichage et l'export du journal financier
 */

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
    
    // Toggle journal popup on journal button click
    journalBtn.addEventListener('click', () => {
        journalPanel.classList.add('active');
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('journal-panel');
        }
        loadJournalEntries('all');
    });
    
    // Close journal popup
    journalCloseBtn.addEventListener('click', () => {
        journalPanel.classList.remove('active');
        if (window.popupManager) {
            window.popupManager.forceClosePopup('journal-panel');
        }
    });
    
    // Close popup when clicking outside
    journalPanel.addEventListener('click', (e) => {
        if (e.target === journalPanel) {
            journalPanel.classList.remove('active');
            if (window.popupManager) {
                window.popupManager.forceClosePopup('journal-panel');
            }
        }
    });
    
    // Refresh button
    journalRefreshBtn.addEventListener('click', () => {
        const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
        const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
        loadJournalEntries(currentPeriod);
    });
    
    // Filter buttons (period)
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // Réinitialiser le filtre de type quand on change de période
            const activePill = document.querySelector('.journal-filter-pill.active');
            const typeFilter = activePill ? JSON.parse(activePill.dataset.types || '[]') : null;
            loadJournalEntries(btn.dataset.period, typeFilter);
        });
    });
    
    // Filter pills (type)
    const filterPills = document.querySelectorAll('.journal-filter-pill');
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            // Toggle active state
            if (pill.classList.contains('active')) {
                // Désactiver le filtre
                pill.classList.remove('active');
                const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
                const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
                loadJournalEntries(currentPeriod, null);
            } else {
                // Activer ce filtre et désactiver les autres
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                const typeFilter = JSON.parse(pill.dataset.types || '[]');
                const activeFilterBtn = document.querySelector('.journal-filter-btn.active');
                const currentPeriod = activeFilterBtn ? activeFilterBtn.dataset.period : 'all';
                loadJournalEntries(currentPeriod, typeFilter);
            }
        });
    });
    
    // Export buttons
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

/**
 * Charge et affiche les entrées du journal
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
        // Try to use journalManager directly if available, otherwise fall back to budgetManager
        const manager = window.journalManager || window.app?.journalManager || window.budgetManager;
        if (!manager) {
            throw new Error('Journal/BudgetManager not available');
        }
        
        // Récupérer les données groupées par année et mois
        const yearlyData = await manager.getYearlyFinancialSummary();
        
        // Obtenir le budget actuel (source unique de vérité : budget.funds)
        let currentFunds = 0;
        let currentYear = 0;
        let currentTurn = 0;
        
        if (window.budgetManager) {
            const budget = await window.budgetManager.getCurrentBudget();
            currentFunds = budget.funds || 0;
            currentTurn = budget.turn || 0;
            if (window.TimeManager) {
                const timeInfo = window.TimeManager.getTimeInfo(currentTurn);
                currentYear = timeInfo.year;
            }
        } else {
            // Fallback: utiliser le turn le plus récent du journal
            const allEntries = await manager.getJournalEntries();
            if (allEntries.length > 0) {
                // Trier par turn décroissant pour obtenir le plus récent
                const sortedEntries = [...allEntries].sort((a, b) => b.turn - a.turn);
                currentTurn = sortedEntries[0].turn;
            }
        }
        const currentDate = new Date().toISOString();
        
        // Sauvegarder les soldes de fin d'année dans localStorage
        // Utiliser les entrées 'balance' qui reflètent budget.funds
        const LOCALSTORAGE_KEY = 'journal_year_end_balances';
        let soldes = []; // Déclarer en dehors du try pour être accessible plus tard
        
        try {
            const stored = localStorage.getItem(LOCALSTORAGE_KEY);
            soldes = stored ? JSON.parse(stored) : [];
            
            // NETTOYER : supprimer les entrées avec amount NaN ou undefined
            soldes = soldes.filter(s => typeof s.amount === 'number' && !isNaN(s.amount));
            
            // Pour chaque année affichée, récupérer le solde depuis les entrées balance
            for (const yearData of yearlyData) {
                try {
                    let nature;
                    let amount;
                    
                    // Pour l'année en cours, utiliser currentFunds (budget.funds actuel)
                    if (yearData.year === currentYear) {
                        nature = currentFunds >= 0 ? 'revenue' : 'deficit';
                        amount = Math.abs(currentFunds);
                    } else {
                        // Pour les années précédentes, utiliser localStorage (méthode synchrone)
                        // Retourne {an, nature, amount, turn, date} ou null
                        const yearEndBalance = manager.getYearEndBalance(yearData.year);
                        
                        if (yearEndBalance && typeof yearEndBalance.amount === 'number' && !isNaN(yearEndBalance.amount)) {
                            nature = yearEndBalance.nature;
                            amount = yearEndBalance.amount;
                        } else {
                            // Pas de solde valide trouvé, utiliser netFlow calculé comme fallback
                            const netFlow = yearData.netFlow;
                            if (typeof netFlow === 'number' && !isNaN(netFlow)) {
                                nature = netFlow >= 0 ? 'revenue' : 'deficit';
                                amount = Math.abs(netFlow);
                                console.warn(`[Journal] No valid balance in localStorage for year ${yearData.year}, using netFlow: ${netFlow}`);
                            } else {
                                console.warn(`[Journal] No valid balance for year ${yearData.year}, skipping`);
                                continue;
                            }
                        }
                    }
                    
                    // Validation finale : ne pas sauvegarder si amount est NaN
                    if (typeof amount !== 'number' || isNaN(amount)) {
                        console.error(`[Journal] Invalid amount for year ${yearData.year}: ${amount}`);
                        continue;
                    }
                    
                    // Vérifier si cette combinaison (an + turn) existe déjà
                    const existingIndex = soldes.findIndex(s => s.an === yearData.year && s.turn === currentTurn);
                    
                    if (existingIndex >= 0) {
                        // Mettre à jour l'entrée existante
                        soldes[existingIndex] = {
                            an: yearData.year,
                            nature: nature,
                            amount: amount,
                            turn: currentTurn,
                            date: currentDate
                        };
                    } else {
                        // Ajouter une nouvelle entrée
                        soldes.push({
                            an: yearData.year,
                            nature: nature,
                            amount: amount,
                            turn: currentTurn,
                            date: currentDate
                        });
                    }
                } catch (error) {
                    console.error(`[Journal] Error getting balance for year ${yearData.year}:`, error.message);
                    // Ne pas sauvegarder cette année si erreur
                }
            }
            
            // Trier par année puis par turn (décroissant)
            soldes.sort((a, b) => {
                if (a.an !== b.an) return b.an - a.an;
                return b.turn - a.turn;
            });
            
            localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(soldes));
        } catch (error) {
            console.error('[Journal] Error saving balances to localStorage:', error);
        }
        
        if (yearlyData.length === 0) {
            journalList.innerHTML = `
                <div class="no-journal-entries">
                    <div class="no-journal-entries-icon">📔</div>
                    <div class="no-journal-entries-text">Aucune écriture dans le journal</div>
                </div>
            `;
            return;
        }
        
        // Créer le HTML avec regroupements Année → Mois → Entrées
        let html = '';
        
        yearlyData.forEach(yearData => {
            // En-tête Année
            const yearDisplay = yearData.year === 0 ? '0 JC' : `${yearData.year} ap JC`;
            
            // Pour le solde : utiliser budget.funds (source unique de vérité)
            let displayBalance;
            let balanceClass;
            
            if (yearData.year === currentYear) {
                // Année en cours : utiliser budget.funds actuel
                displayBalance = currentFunds;
                balanceClass = displayBalance >= 0 ? 'positive' : 'negative';
            } else {
                // Années précédentes : utiliser le solde sauvegardé depuis localStorage
                const savedBalance = soldes.find(s => s.an === yearData.year);
                if (savedBalance && typeof savedBalance.amount === 'number' && !isNaN(savedBalance.amount)) {
                    displayBalance = savedBalance.nature === 'revenue' ? savedBalance.amount : -savedBalance.amount;
                    balanceClass = savedBalance.nature === 'revenue' ? 'positive' : 'negative';
                } else {
                    // Fallback : utiliser netFlow calculé
                    const netFlow = yearData.netFlow;
                    if (typeof netFlow === 'number' && !isNaN(netFlow)) {
                        displayBalance = netFlow;
                        balanceClass = displayBalance >= 0 ? 'positive' : 'negative';
                    } else {
                        // Dernier recours : afficher 0 avec avertissement
                        displayBalance = 0;
                        balanceClass = 'error';
                        console.warn(`[Journal] No valid balance for year ${yearData.year}`);
                    }
                }
            }
            
            html += `
                <div class="journal-year-group">
                    <div class="journal-year-header">
                        <h3>Année ${yearDisplay}</h3>
                        <div class="journal-year-summary">
                            <div class="journal-summary-item income">
                                <span class="label">Revenus:</span>
                                <span class="amount">+${yearData.income.total}€</span>
                            </div>
                            <div class="journal-summary-item expenses">
                                <span class="label">Dépenses:</span>
                                <span class="amount">-${yearData.expenses.total}€</span>
                            </div>
                            <div class="journal-summary-item netflow ${balanceClass}">
                                <span class="label">Solde:</span>
                                <span class="amount">${displayBalance >= 0 ? '+' : ''}${displayBalance}€</span>
                            </div>
                        </div>
                    </div>
                    
                    ${yearData.months.map(monthData => {
                        // En-tête Mois
                        const yearDisplayMonth = monthData.year === 0 ? '0 JC' : `${monthData.year} ap JC`;
                        return `
                            <div class="journal-month-group">
                                <div class="journal-month-header">
                                    <h4>${monthData.monthName} ${yearDisplayMonth}</h4>
                                    <div class="journal-month-summary">
                                        <div class="journal-summary-item income">
                                            <span class="label">Revenus:</span>
                                            <span class="amount">+${monthData.income.total}€</span>
                                        </div>
                                        <div class="journal-summary-item expenses">
                                            <span class="label">Dépenses:</span>
                                            <span class="amount">-${monthData.expenses.total}€</span>
                                        </div>
                                        <div class="journal-summary-item netflow ${monthData.netFlow >= 0 ? 'positive' : 'negative'}">
                                            <span class="label">Solde:</span>
                                            <span class="amount">${monthData.netFlow >= 0 ? '+' : ''}${monthData.netFlow}€</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="journal-month-entries">
                                    ${(() => {
                                        // Filtrer les entrées selon typeFilter si défini
                                        let filteredIncome = monthData.income.entries;
                                        let filteredExpenses = monthData.expenses.entries;
                                        
                                        if (typeFilter && typeFilter.length > 0) {
                                            filteredIncome = monthData.income.entries.filter(e => {
                                                // Vérifier si le type correspond exactement ou commence par un préfixe dans typeFilter
                                                return typeFilter.some(filterType => {
                                                    // Type exact (ex: "citizen_tax", "loan_capital")
                                                    if (e.type === filterType) {
                                                        return true;
                                                    }
                                                    // Préfixe avec underscore (ex: "export_" pour tous les exports)
                                                    if (filterType.endsWith('_') && e.type.startsWith(filterType)) {
                                                        return true;
                                                    }
                                                    return false;
                                                });
                                            });
                                            filteredExpenses = monthData.expenses.entries.filter(e => {
                                                return typeFilter.some(filterType => {
                                                    // Type exact
                                                    if (e.type === filterType) {
                                                        return true;
                                                    }
                                                    // Préfixe avec underscore
                                                    if (filterType.endsWith('_') && e.type.startsWith(filterType)) {
                                                        return true;
                                                    }
                                                    return false;
                                                });
                                            });
                                        }
                                        
                                        // Séparer les entrées : report à nouveau en premier, puis les autres
                                        const carryForwardIncome = filteredIncome.filter(e => e.type === 'carry_forward');
                                        const carryForwardExpenses = filteredExpenses.filter(e => e.type === 'carry_forward');
                                        const otherIncome = filteredIncome.filter(e => e.type !== 'carry_forward');
                                        const otherExpenses = filteredExpenses.filter(e => e.type !== 'carry_forward');
                                        
                                        // Afficher d'abord les reports à nouveau (revenus puis dépenses), puis les autres
                                        return [
                                            ...carryForwardIncome.map(entry => createJournalEntryHTML(entry)),
                                            ...carryForwardExpenses.map(entry => createJournalEntryHTML(entry)),
                                            ...otherIncome.map(entry => createJournalEntryHTML(entry)),
                                            ...otherExpenses.map(entry => createJournalEntryHTML(entry))
                                        ].join('');
                                    })()}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        });
        
        journalList.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading journal entries:', error);
        journalList.innerHTML = `
            <div class="journal-loading">
                <p>Erreur lors du chargement du journal: ${error.message}</p>
            </div>
        `;
    }
}

/**
 * Export journal to JSON and download
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
 * Export journal to PDF and download
 */
export async function exportJournalToPDF() {
    try {
        const manager = window.journalManager || window.app?.journalManager || window.budgetManager;
        if (!manager) {
            throw new Error('JournalManager not available');
        }
        
        // Show loading indicator
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
        
        // Restore button
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
        
        // Restore button on error
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
    
    // Obtenir l'année depuis le turn
    let yearDisplay = '';
    if (window.TimeManager && entry.turn !== undefined) {
        const timeInfo = window.TimeManager.getTimeInfo(entry.turn);
        yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
    }
    
    // Déterminer si c'est un revenu (positif) ou une dépense (négatif)
    // Les cumuls et les balances sont informatifs seulement (pas comptés dans les calculs)
    let isIncome = false;
    
    if (entry.type === 'cumul_maintenance' || 
        entry.type === 'cumul_construction' || 
        entry.type === 'cumul_salary' ||
        entry.type === 'cumul_exceptional_expenses' ||
        entry.type === 'cumul_loan_interest' ||
        entry.type === 'cumul_loan_repayment') {
        isIncome = false; // Les cumuls sont toujours des dépenses
    } else if (entry.type === 'balance') {
        // La balance peut être positive ou négative selon le montant
        isIncome = entry.amount >= 0;
    } else if (entry.type === 'citizen_tax' || entry.type === 'payroll_tax' || entry.type === 'capital_funds' || entry.type === 'loan_capital') {
        isIncome = true;
    } else if (entry.type.startsWith('export_')) {
        isIncome = true; // Tous les exports sont des revenus
    } else if (entry.type.startsWith('import_')) {
        isIncome = false; // Tous les imports sont des dépenses
    } else if (entry.type === 'salary' || entry.type === 'maintenance' || entry.type === 'construction' || entry.type === 'exceptional_expenses' || entry.type === 'commercial_route') {
        isIncome = false; // Dépenses
    } else if (entry.type === 'carry_forward') {
        // Pour carry_forward, utiliser la propriété isCarryForwardIncome si disponible
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
    
    // Check if description contains breakdown data
    const breakdownMatch = entry.description?.match(/\|BREAKDOWN\|(.*?)\|BREAKDOWN\|/);
    let descriptionText = entry.description || '';
    let breakdownItems = null;

    // Support breakdown for maintenance, imports, exports, and commercial routes
    const supportsBreakdown = entry.type === 'maintenance' ||
                              entry.type === 'commercial_route' ||
                              entry.type.startsWith('import_') ||
                              entry.type.startsWith('export_');

    if (breakdownMatch && supportsBreakdown) {
        try {
            breakdownItems = JSON.parse(breakdownMatch[1]);
            // Remove breakdown data from description text
            descriptionText = entry.description.replace(/\|BREAKDOWN\|.*?\|BREAKDOWN\|/, '').trim();
        } catch (e) {
            console.warn('Failed to parse breakdown:', e);
        }
    }

    // Get partner name if partnerId exists
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
                <div class="journal-entry-description">${descriptionText}</div>
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
                    ${yearDisplay ? `<span class="journal-entry-year">Année: ${yearDisplay}</span>` : ''}
                    ${entry.turn !== undefined ? `<span class="journal-entry-turn-number">Tour: ${entry.turn}</span>` : ''}
                    <span class="journal-entry-date">${formattedDate}</span>
                </div>
            </div>
        </div>
    `;
}

