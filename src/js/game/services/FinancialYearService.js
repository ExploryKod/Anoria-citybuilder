import { TimeManager } from '../utils/TimeManager.js';
import budgetManager from '../../stores/BudgetManager.js';

/**
 * FinancialYearService - Calcule les données financières annuelles
 * 
 * Source de vérité : IndexedDB (BudgetManager, HousesStore)
 * 
 * Responsabilités :
 * - Calculer les données de "cette année" (depuis le début de l'année jusqu'au tour actuel)
 * - Gérer le snapshot de "l'année dernière" (sauvegardé au moment de l'ouverture du panneau)
 * - Fournir les données formatées pour le panneau finances
 * 
 * Principe : Une année = 12 mois = 12 tours (avec DAYS_PER_MONTH = 1)
 */
export class FinancialYearService {
    constructor() {
        // Snapshot de l'année dernière (sauvegardé quand on ouvre le panneau)
        this.lastYearSnapshot = null;
        this.lastYearSnapshotYear = null;
    }
    
    /**
     * Réinitialise le service (appelé quand on démarre une nouvelle partie)
     */
    reset() {
        this.lastYearSnapshot = null;
        this.lastYearSnapshotYear = null;
    }

    /**
     * Calcule les données financières de cette année
     * Agrège toutes les transactions depuis le début de l'année
     * 
     * @param {number} time - Temps actuel (nombre de jours)
     * @returns {Promise<Object>} Données financières de cette année
     */
    async calculateThisYearData(time = 0) {
        const timeInfo = TimeManager.getTimeInfo(time);
        const currentYear = timeInfo.year;
        
        // Récupérer le budget actuel (source de vérité - mis à jour en temps réel comme le journal)
        const currentBudget = await budgetManager.getCurrentBudget();
        
        // IMPORTANT : On utilise directement les valeurs cumulées du currentBudget
        // Exactement comme le fait le journal - pas de soustraction, pas de snapshot
        // Les valeurs sont cumulées depuis le début du jeu
        
        const thisYearTaxes = currentBudget.totalTaxes || 0;
        const thisYearMaintenance = currentBudget.totalBuildingMaintenance || 0;
        const thisYearInvestments = currentBudget.totalInvestments || 0;
        const thisYearInterestExpense = currentBudget.totalLoanInterestExpenses || 0;
        
        // Calculer les dons de cette année
        const thisYearTotalGifts = currentBudget.totalGifts || 0;
        const gifts = thisYearTotalGifts;
        
        // IMPORTANT : totalIncome doit être la somme des lignes de revenus affichées
        // Dans l'administrator-panel, les lignes affichées sont :
        // - Impôts sur le revenu (incomeTax)
        // - TVA (vat = 0)
        // - Taxes commerciales (tradeTax = 0)
        // - Dons (gifts)
        // - Intérêts (gain) (interestIncome = 0)
        // Donc : totalIncome = incomeTax + vat + tradeTax + gifts + interestIncome
        const calculatedIncome = thisYearTaxes + 0 + 0 + gifts + 0;
        const totalIncome = calculatedIncome;
        
        // Vérification : otherIncome devrait être 0 si tous les revenus sont catégorisés
        // otherIncome = revenus totaux - revenus catégorisés
        const otherIncome = Math.max(0, (currentBudget.income || 0) - calculatedIncome);
        
        // Calculer le report de solde de l'année précédente
        // Le report de solde est affiché séparément entre flux net et balance
        let previousYearBalance = 0;
        
        if (currentYear > 0) {
            const lastYearSnapshot = await this.getLastYearSnapshot(time);
            if (lastYearSnapshot) {
                previousYearBalance = lastYearSnapshot.balance || lastYearSnapshot.funds || 0;
            }
        }
        
        // Calculer le flux net sans inclure le report de solde dans les totaux
        // netFlow = revenus - (toutes les dépenses affichées)
        const calculatedExpenses = 0 + 0 + 0 + thisYearInterestExpense + thisYearMaintenance + thisYearInvestments;
        const netFlow = totalIncome - calculatedExpenses;
        
        return {
            // Revenus
            incomeTax: thisYearTaxes,
            vat: 0, // Pas implémenté
            tradeTax: 0, // Pas implémenté
            gifts: gifts, // Fonds initiaux (première année) + dons réels de cette année
            interestIncome: 0, // Pas implémenté
            otherIncome: otherIncome,
            totalIncome: totalIncome, // Revenus uniquement (sans report de solde)
            
            // Dépenses
            salaries: 0, // Pas implémenté - les salaires sont séparés de la maintenance
            imports: 0, // Pas implémenté
            giftsGiven: 0, // Pas implémenté
            interestExpense: thisYearInterestExpense,
            maintenance: thisYearMaintenance, // Maintenance des bâtiments (totalBuildingMaintenance)
            construction: thisYearInvestments,
            // IMPORTANT : totalExpenses = somme des lignes de dépenses affichées
            // (salaries + imports + giftsGiven + interestExpense + maintenance + construction)
            totalExpenses: 0 + 0 + 0 + thisYearInterestExpense + thisYearMaintenance + thisYearInvestments,
            
            // Résultats
            netFlow: netFlow, // Flux net = revenus - dépenses (sans report de solde)
            previousYearBalance: previousYearBalance, // Report de solde de l'année précédente (positif ou négatif)
            balance: currentBudget.funds || 0
        };
    }

    /**
     * Récupère ou crée le snapshot de l'année dernière
     * Le snapshot est créé au moment de l'ouverture du panneau
     * 
     * @param {number} time - Temps actuel
     * @returns {Promise<Object>} Snapshot de l'année dernière
     */
    async getLastYearSnapshot(time = 0) {
        const timeInfo = TimeManager.getTimeInfo(time);
        const currentYear = timeInfo.year;
        
        // IMPORTANT : Si on est en première année (année 0), il n'y a pas d'année dernière
        // Retourner null pour éviter de créer un snapshot fantôme
        if (currentYear === 0) {
            return null;
        }
        
        // Si on a déjà un snapshot pour cette année, le retourner
        if (this.lastYearSnapshot && this.lastYearSnapshotYear === currentYear - 1) {
            return this.lastYearSnapshot;
        }
        
        // Sinon, créer un snapshot depuis les données actuelles
        // (cela représente l'état au moment de l'ouverture du panneau)
        const currentBudget = await budgetManager.getCurrentBudget();
        
        // Si on est en début d'année (mois 0-2), l'année dernière = année - 1
        // Sinon, l'année dernière = l'état actuel (snapshot du tour actuel)
        const lastYear = currentYear - 1;
        
        // Chercher les états de l'année dernière
        const budgetStates = await budgetManager.getBudgetStates();
        const lastYearStates = budgetStates.filter(state => {
            const stateYear = Math.floor(state.turn / 12);
            return stateYear === lastYear;
        });
        
        if (lastYearStates.length > 0) {
            // Utiliser le dernier état de l'année dernière
            const lastState = lastYearStates[lastYearStates.length - 1];
            this.lastYearSnapshot = {
                income: lastState.income || 0,
                expenses: lastState.expenses || 0,
                totalTaxes: lastState.totalTaxes || 0,
                totalGifts: lastState.totalGifts || 0, // Dons réels de l'année dernière
                totalBuildingMaintenance: lastState.totalBuildingMaintenance || 0,
                totalInvestments: lastState.totalInvestments || 0,
                totalLoanInterestExpenses: lastState.totalLoanInterestExpenses || 0,
                funds: lastState.funds || 0,
                netFlow: lastState.netFlow || 0,
                initialFunds: currentBudget.initialFunds || 0 // Pour calculer les dons initiaux
            };
        } else {
            // Pas d'états de l'année dernière, utiliser l'état actuel comme snapshot
            // (pour la 2e année qui sera une image du tour actuel)
            this.lastYearSnapshot = {
                income: currentBudget.income || 0,
                expenses: currentBudget.expenses || 0,
                totalTaxes: currentBudget.totalTaxes || 0,
                totalGifts: currentBudget.totalGifts || 0, // Dons réels actuels
                totalBuildingMaintenance: currentBudget.totalBuildingMaintenance || 0,
                totalInvestments: currentBudget.totalInvestments || 0,
                totalLoanInterestExpenses: currentBudget.totalLoanInterestExpenses || 0,
                funds: currentBudget.funds || 0,
                netFlow: currentBudget.netFlow || 0,
                initialFunds: currentBudget.initialFunds || 0 // Pour calculer les dons initiaux
            };
        }
        
        this.lastYearSnapshotYear = lastYear;
        return this.lastYearSnapshot;
    }

    /**
     * Crée un snapshot de l'année actuelle (pour l'année prochaine)
     * Appelé quand on ouvre le panneau finances
     * 
     * @param {number} time - Temps actuel
     * @returns {Promise<Object>} Snapshot créé
     */
    async createCurrentYearSnapshot(time = 0) {
        const currentBudget = await budgetManager.getCurrentBudget();
        const timeInfo = TimeManager.getTimeInfo(time);
        const currentYear = timeInfo.year;
        
        // Créer le snapshot de l'année actuelle
        // Inclure initialFunds et totalGifts pour pouvoir calculer les dons
        const snapshot = {
            income: currentBudget.income || 0,
            expenses: currentBudget.expenses || 0,
            totalTaxes: currentBudget.totalTaxes || 0,
            totalGifts: currentBudget.totalGifts || 0, // Dons réels cumulatifs
            totalBuildingMaintenance: currentBudget.totalBuildingMaintenance || 0,
            totalInvestments: currentBudget.totalInvestments || 0,
            totalLoanInterestExpenses: currentBudget.totalLoanInterestExpenses || 0,
            funds: currentBudget.funds || 0,
            netFlow: currentBudget.netFlow || 0,
            initialFunds: currentBudget.initialFunds || 0, // Pour calculer les dons initiaux
            year: currentYear,
            time: time
        };
        
        // Sauvegarder dans localStorage pour persistance
        // (IndexedDB est la source de vérité, localStorage est juste pour le snapshot)
        try {
            localStorage.setItem('financial_year_snapshot', JSON.stringify(snapshot));
        } catch (err) {
            console.warn('[FinancialYearService] Could not save snapshot to localStorage:', err);
        }
        
        return snapshot;
    }

    /**
     * Calcule les données financières de l'année dernière
     * Utilise le snapshot sauvegardé ou calcule depuis les états
     * 
     * @param {number} time - Temps actuel
     * @returns {Promise<Object>} Données financières de l'année dernière
     */
    async calculateLastYearData(time = 0) {
        const timeInfo = TimeManager.getTimeInfo(time);
        const currentYear = timeInfo.year;
        
        // IMPORTANT : Si on est en première année (année 0), il n'y a pas d'année dernière
        // Retourner des valeurs à 0
        if (currentYear === 0) {
            return {
                // Revenus
                incomeTax: 0,
                vat: 0,
                tradeTax: 0,
                gifts: 0, // Pas de dons l'année dernière (c'est la première année)
                interestIncome: 0,
                otherIncome: 0,
                totalIncome: 0,
                
                // Dépenses
                salaries: 0,
                imports: 0,
                giftsGiven: 0,
                interestExpense: 0,
                maintenance: 0,
                construction: 0,
                totalExpenses: 0,
                
                // Résultats
                netFlow: 0,
                previousYearBalance: 0, // Pas de report de solde (c'est la première année)
                balance: 0
            };
        }
        
        const snapshot = await this.getLastYearSnapshot(time);
        const lastYear = currentYear - 1;
        const isLastYearFirstYear = lastYear === 0;
        
        // Récupérer les fonds initiaux depuis le snapshot
        const initialFunds = snapshot.initialFunds || (await budgetManager.getCurrentBudget()).initialFunds || 0;
        const initialFundsAsGift = isLastYearFirstYear ? initialFunds : 0;
        
        // Récupérer les dons réels de l'année dernière
        // Le snapshot.totalGifts est cumulatif, donc pour l'année dernière on doit :
        // - Si c'était la première année (année 0) : totalGifts = dons de l'année 0 uniquement
        // - Sinon : totalGifts du snapshot - totalGifts de l'année précédente
        let lastYearRealGifts = 0;
        if (isLastYearFirstYear) {
            // Première année : totalGifts contient déjà tous les dons de cette année
            lastYearRealGifts = snapshot.totalGifts || 0;
        } else {
            // Année suivante : on doit soustraire les dons des années précédentes
            // Pour cela, on cherche l'état de l'année précédente (année - 2)
            const budgetStates = await budgetManager.getBudgetStates();
            const previousYear = lastYear - 1;
            const previousYearStates = budgetStates.filter(state => {
                const stateYear = Math.floor(state.turn / 12);
                return stateYear === previousYear;
            });
            
            if (previousYearStates.length > 0) {
                const lastPreviousState = previousYearStates[previousYearStates.length - 1];
                const previousYearGifts = lastPreviousState.totalGifts || 0;
                lastYearRealGifts = Math.max(0, (snapshot.totalGifts || 0) - previousYearGifts);
            } else {
                // Pas d'états de l'année précédente, utiliser directement le snapshot
                // (cela signifie que l'année dernière était la première avec des dons)
                lastYearRealGifts = snapshot.totalGifts || 0;
            }
        }
        
        // Total dons = totalGifts de l'année dernière (inclut fonds initiaux si c'était la première année + dons réels)
        const gifts = lastYearRealGifts;
        
        // IMPORTANT : totalIncome doit être la somme des lignes de revenus affichées
        // Dans l'administrator-panel, les lignes affichées sont :
        // - Impôts sur le revenu (incomeTax)
        // - TVA (vat = 0)
        // - Taxes commerciales (tradeTax = 0)
        // - Dons (gifts)
        // - Intérêts (gain) (interestIncome = 0)
        // Donc : totalIncome = incomeTax + vat + tradeTax + gifts + interestIncome
        const calculatedIncome = (snapshot.totalTaxes || 0) + 0 + 0 + gifts + 0;
        const totalIncome = calculatedIncome;
        
        // Vérification : otherIncome devrait être 0 si tous les revenus sont catégorisés
        // otherIncome = revenus totaux - revenus catégorisés
        const otherIncome = Math.max(0, (snapshot.income || 0) - calculatedIncome);
        
        // Calculer le report de solde de l'année précédente à l'année dernière
        // Si l'année dernière avait une année précédente (année - 2), calculer le report
        let previousYearBalance = 0;
        
        if (!isLastYearFirstYear) {
            // L'année dernière n'était pas la première année, donc elle avait une année précédente
            // Chercher l'état de fin d'année de l'année précédente (année - 2)
            const budgetStates = await budgetManager.getBudgetStates();
            const previousYear = lastYear - 1;
            const previousYearStates = budgetStates.filter(state => {
                const stateYear = Math.floor(state.turn / 12);
                return stateYear === previousYear;
            });
            
            if (previousYearStates.length > 0) {
                // Utiliser le dernier état de l'année précédente (année - 2)
                const lastPreviousState = previousYearStates[previousYearStates.length - 1];
                previousYearBalance = lastPreviousState.funds || 0;
            }
        }
        
        // Calculer le flux net sans inclure le report de solde dans les totaux
        // netFlow = revenus - (toutes les dépenses affichées)
        const calculatedLastYearExpenses = 0 + 0 + 0 + (snapshot.totalLoanInterestExpenses || 0) + (snapshot.totalBuildingMaintenance || 0) + (snapshot.totalInvestments || 0);
        const netFlow = totalIncome - calculatedLastYearExpenses;
        
        return {
            // Revenus
            incomeTax: snapshot.totalTaxes || 0,
            vat: 0, // Pas implémenté
            tradeTax: 0, // Pas implémenté
            gifts: gifts, // Fonds initiaux (si première année) + dons réels de l'année dernière
            interestIncome: 0, // Pas implémenté
            otherIncome: otherIncome,
            totalIncome: totalIncome, // Revenus uniquement (sans report de solde)
            
            // Dépenses
            salaries: 0, // Pas implémenté - les salaires sont séparés de la maintenance
            imports: 0, // Pas implémenté
            giftsGiven: 0, // Pas implémenté
            interestExpense: snapshot.totalLoanInterestExpenses || 0,
            maintenance: snapshot.totalBuildingMaintenance || 0, // Maintenance des bâtiments
            construction: snapshot.totalInvestments || 0,
            // IMPORTANT : totalExpenses = somme des lignes de dépenses affichées
            // (salaries + imports + giftsGiven + interestExpense + maintenance + construction)
            totalExpenses: 0 + 0 + 0 + (snapshot.totalLoanInterestExpenses || 0) + (snapshot.totalBuildingMaintenance || 0) + (snapshot.totalInvestments || 0),
            
            // Résultats
            netFlow: netFlow, // Flux net = revenus - dépenses (sans report de solde)
            previousYearBalance: previousYearBalance, // Report de solde de l'année précédente (positif ou négatif)
            balance: snapshot.funds || 0
        };
    }

    /**
     * Recalcule toutes les données (appelé par le bouton d'actualisation)
     * 
     * @param {number} time - Temps actuel
     * @returns {Promise<Object>} Données financières complètes
     */
    async refreshFinancialData(time = 0) {
        // Créer un nouveau snapshot de l'année actuelle
        await this.createCurrentYearSnapshot(time);
        
        // Recalculer les données
        const thisYear = await this.calculateThisYearData(time);
        const lastYear = await this.calculateLastYearData(time);
        
        return {
            thisYear,
            lastYear,
            debt: thisYear.balance < 0 ? Math.abs(thisYear.balance) : 0
        };
    }
}

// Export singleton instance
const financialYearService = new FinancialYearService();
export default financialYearService;

