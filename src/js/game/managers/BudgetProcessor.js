import { processTurnBudget, resetProcessTurnBudget } from '../../acl/accounting.js';

/**
 * Processes budget-related operations (Three.js building scan stays here).
 */
export class BudgetProcessor {
    constructor() {
    }

    /**
     * Reset maintenance and salary tracking
     */
    reset() {
        resetProcessTurnBudget();
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
        const result = await processTurnBudget({
            time,
            totalPop,
            buildingCounts,
            maintenanceBreakdown,
        });

        if (result?.cleanupResult?.deleted > 0) {
            this.showCleanupNotificationOnce(result.cleanupResult);
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
