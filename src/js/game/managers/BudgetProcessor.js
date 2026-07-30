import { TimeManager } from '../utils/TimeManager.js';
import { getCityTotalPopulation, clearPopulationWithoutRoadAccess } from '../../acl/housing.js';

/**
 * Processes budget-related operations
 */
export class BudgetProcessor {
    constructor() {
        this.lastMaintenanceMonth = -1;
        this.lastSalaryMonth = -1;
    }

    /**
     * Reset maintenance and salary tracking
     */
    reset() {
        this.lastMaintenanceMonth = -1;
        this.lastSalaryMonth = -1;
    }

    /**
     * Calculate building counts and maintenance breakdown
     */
    calculateBuildingCounts(city, buildings) {
        const buildingCounts = {
            houses: 0,
            farms: 0,
            markets: 0,
            roads: 0,
            total: 0
        };
        
        const maintenanceCosts = {
            'roads': 2,
            'House-Blue': 3,
            'House-Red': 3,
            'House-Purple': 3,
            'House-2Story': 3,
            'Farm': 1,
            'Market': 1
        };
        
        const maintenanceBreakdown = {
            roads: { count: 0, cost: 0 },
            houses: { count: 0, cost: 0 },
            farms: { count: 0, cost: 0 },
            markets: { count: 0, cost: 0 }
        };
        
        for(let x = 0; x < city.size; x++) {
            for(let y = 0; y < city.size; y++) {
                const building = buildings[x][y];
                if (building && building.userData && building.userData.type) {
                    const type = building.userData.type;
                    
                    let cost = 2;
                    if (type.includes('roads')) {
                        cost = maintenanceCosts['roads'];
                        buildingCounts.roads++;
                        maintenanceBreakdown.roads.count++;
                        maintenanceBreakdown.roads.cost += cost;
                    } else if (type === 'House-Blue' || type === 'House-Red' || type === 'House-Purple' || type === 'House-2Story') {
                        cost = maintenanceCosts['House-Blue'];
                        buildingCounts.houses++;
                        maintenanceBreakdown.houses.count++;
                        maintenanceBreakdown.houses.cost += cost;
                    } else if (type.includes('Farm')) {
                        cost = maintenanceCosts['Farm'];
                        buildingCounts.farms++;
                        maintenanceBreakdown.farms.count++;
                        maintenanceBreakdown.farms.cost += cost;
                    } else if (type.includes('Market')) {
                        cost = maintenanceCosts['Market'];
                        buildingCounts.markets++;
                        maintenanceBreakdown.markets.count++;
                        maintenanceBreakdown.markets.cost += cost;
                    }
                    
                    buildingCounts.total++;
                }
            }
        }
        
        return { buildingCounts, maintenanceBreakdown };
    }

    /**
     * Process budget operations (taxes, salaries, maintenance)
     */
    async processBudget(time, totalPop, buildingCounts, maintenanceBreakdown) {
        try {
            if (!window.budgetManager) {
                return;
            }

            await window.budgetManager.addTaxes(time);
            
            const timeInfo = TimeManager.getTimeInfo(time);
            const currentMonth = timeInfo.monthNumber;
            const isFirstTurnOfMonth = timeInfo.dayInMonth === 1;
            
            // Process salaries (only once per month, on the first day)
            // Update lastSalaryMonth BEFORE processing to prevent multiple calls in the same turn
            if (isFirstTurnOfMonth && currentMonth !== this.lastSalaryMonth) {
                // Mark as processed immediately to prevent duplicate processing
                this.lastSalaryMonth = currentMonth;
                
                let salaryPerMonth = 100;
                if (window.workSectionManager && typeof window.workSectionManager.salary === 'number') {
                    salaryPerMonth = window.workSectionManager.salary;
                }
                
                const totalPopulation = await getCityTotalPopulation();
                
                if (totalPopulation > 0 && salaryPerMonth > 0) {
                    const yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
                    const monthName = timeInfo.month || 'Mois';
                    const salaryDescription = `Salaires fonctionnaires - ${monthName} ${yearDisplay} (${totalPopulation} hab. × ${salaryPerMonth}€)`;
                    
                    const totalSalaryAmount = totalPopulation * salaryPerMonth;
                    await window.budgetManager.addSalaries(salaryPerMonth, totalPopulation, salaryDescription);
                    
                    let salaryTaxRate = 0.2;
                    if (window.workSectionManager && typeof window.workSectionManager.salaryTaxRate === 'number') {
                        salaryTaxRate = window.workSectionManager.salaryTaxRate;
                    }
                    
                    if (salaryTaxRate > 0) {
                        const taxDescription = `Impôt sur les salaires - ${monthName} ${yearDisplay} (${Math.round(salaryTaxRate * 100)}%)`;
                        await window.budgetManager.addSalaryTax(totalSalaryAmount, salaryTaxRate, taxDescription);
                    }
                }
            }
            
            // Process maintenance
            if (currentMonth !== this.lastMaintenanceMonth) {
                const buildingAmount = maintenanceBreakdown.roads.cost + 
                                     maintenanceBreakdown.houses.cost + 
                                     maintenanceBreakdown.farms.cost + 
                                     maintenanceBreakdown.markets.cost;
                
                if (buildingAmount > 0) {
                    const year = timeInfo.year + 1;
                    const monthName = timeInfo.month || 'Mois';
                    
                    const breakdownItems = [];
                    if (maintenanceBreakdown.roads.count > 0) {
                        breakdownItems.push({
                            label: 'Routes',
                            count: maintenanceBreakdown.roads.count,
                            unitCost: 2,
                            total: maintenanceBreakdown.roads.cost
                        });
                    }
                    if (maintenanceBreakdown.houses.count > 0) {
                        breakdownItems.push({
                            label: 'Maisons',
                            count: maintenanceBreakdown.houses.count,
                            unitCost: 3,
                            total: maintenanceBreakdown.houses.cost
                        });
                    }
                    if (maintenanceBreakdown.farms.count > 0) {
                        breakdownItems.push({
                            label: 'Fermes',
                            count: maintenanceBreakdown.farms.count,
                            unitCost: 1,
                            total: maintenanceBreakdown.farms.cost
                        });
                    }
                    if (maintenanceBreakdown.markets.count > 0) {
                        breakdownItems.push({
                            label: 'Marchés',
                            count: maintenanceBreakdown.markets.count,
                            unitCost: 1,
                            total: maintenanceBreakdown.markets.cost
                        });
                    }
                    
                    const breakdownData = JSON.stringify(breakdownItems);
                    const maintenanceDescription = `Maintenance mensuelle - ${monthName} ${year} |BREAKDOWN|${breakdownData}|BREAKDOWN|`;
                    
                    await window.budgetManager.addBuildingMaintenance(buildingAmount, maintenanceDescription);
                    this.lastMaintenanceMonth = currentMonth;
                }
            }
            
            // Process population/food logic
            const populationResult = await clearPopulationWithoutRoadAccess();
            if (populationResult.totalPopulationLost > 0) {
                console.warn(`⚠️ ${populationResult.message}`);
            }
            
            // Process loan payments
            if (window.processLoanPayments) {
                await window.processLoanPayments();
                const budget = await window.budgetManager.getCurrentBudget();
                await window.budgetManager.calculateLoanTotals(budget);
            }
            
            // Save budget state every 3 turns
            if (time % 3 === 0 && time > 0) {
                try {
                    const additionalData = {
                        population: totalPop,
                        buildingCounts: buildingCounts
                    };
                    
                    await window.budgetManager.saveBudgetState(time, additionalData);
                    
                    const cleanupResult = await window.budgetManager.cleanupOldBudgetStatesByAge();
                    if (cleanupResult.deleted > 0) {
                        this.showCleanupNotificationOnce(cleanupResult);
                    }
                    
                    if (window.budgetManager.cleanupOldJournalEntries) {
                        await window.budgetManager.cleanupOldJournalEntries(60);
                    }
                } catch (error) {
                    console.warn('Failed to save budget state:', error);
                }
            }

            const journalManager =
                window.journalManager ||
                window.budgetManager?.journalManager;
            if (journalManager?.flushSessionToDexie) {
                await journalManager.flushSessionToDexie();
            }
        } catch (error) {
            console.warn('Budget operations failed:', error);
        }
    }

    /**
     * Show cleanup notification to user only once
     */
    showCleanupNotificationOnce(cleanupResult) {
        const hasSeenCleanupNotification = localStorage.getItem('hasSeenCleanupNotification');
        
        if (hasSeenCleanupNotification === 'true') {
            return;
        }
        
        localStorage.setItem('hasSeenCleanupNotification', 'true');
        this.showCleanupNotification(cleanupResult);
    }

    /**
     * Show cleanup notification to user
     */
    showCleanupNotification(cleanupResult) {
        const notification = document.createElement('div');
        notification.className = 'cleanup-notification';
        notification.innerHTML = `
            <div class="cleanup-content">
                <div class="cleanup-icon">🧹</div>
                <div class="cleanup-text">
                    <strong>Nettoyage automatique</strong><br>
                    Les états financiers de plus de 60 jours seront supprimés
                    ${cleanupResult.deletedTurns ? `<br><small>Tours: ${cleanupResult.deletedTurns.join(', ')}</small>` : ''}
                </div>
                <button class="cleanup-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}
