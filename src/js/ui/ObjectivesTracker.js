/**
 * ObjectivesTracker - Gestion des objectifs financiers
 * Utilise le BudgetManager comme single source of truth
 */

import budgetManager from '../stores/BudgetManager.js';

class ObjectivesTracker {
    constructor() {
        this.objectives = [
            {
                id: 'budget_challenge_60_days',
                title: '🏛️ Défi Financier : 60 jours',
                description: 'Maintenir une gestion financière saine sur 60 jours',
                requirements: [
                    {
                        text: 'Le résultat net ne doit jamais descendre à -20€',
                        check: (data) => data.minNetFlow >= -20,
                        value: null
                    },
                    {
                        text: 'Le résultat net doit atteindre au moins +100€',
                        check: (data) => data.maxNetFlow >= 100,
                        value: null
                    },
                    {
                        text: 'Les fonds doivent être d\'au moins 600€ au 60e jour',
                        check: (data) => data.fundsAtDay60 >= 600,
                        value: null
                    }
                ],
                active: false,
                completed: false
            }
        ];

        this.trackingData = {
            minNetFlow: Infinity,
            maxNetFlow: -Infinity,
            minNetFlowTurn: null, // Tour où le flux net minimum a été atteint
            maxNetFlowTurn: null, // Tour où le flux net maximum a été atteint
            fundsAtDay60: null,
            currentDay: 0
        };

        this.init();
    }

    /**
     * Initialise le système de tracking
     */
    init() {
        console.log('ObjectivesTracker initialized');
    }

    /**
     * Vérifie les objectifs à chaque tour
     * Utilise les états de budget sauvegardés tous les 3 tours (tous les 3 intervalles) comme source de vérité
     * @param {number} currentDay - Tour actuel (1 tour = 1 intervalle du jeu)
     */
    async checkObjectives(currentDay) {
        if (!window.budgetManager) {
            console.warn('BudgetManager not available for objectives check');
            return;
        }

        try {
            // Activer l'objectif au tour 0 (initialisation)
            if (currentDay === 0) {
                this.activateObjective('budget_challenge_60_days');
            }

            // Calculer les données de tracking depuis les états de budget sauvegardés tous les 3 tours (3 intervalles)
            await this.updateTrackingFromBudgetStates(currentDay);

            // Enregistrer les fonds au tour 60 (60 intervalles = 60 jours de jeu)
            if (currentDay === 60) {
                await this.saveFundsAtDay60();
            }

            // Vérifier la complétion à partir du tour 60 (60 intervalles = 60 jours)
            if (currentDay >= 60) {
                await this.verifyObjective('budget_challenge_60_days');
            }

        } catch (error) {
            console.error('Error checking objectives:', error);
        }
    }

    /**
     * Met à jour les données de tracking depuis les états de budget sauvegardés
     * Les comptes de résultat sont sauvegardés tous les 3 tours (3 intervalles)
     * @param {number} currentDay - Tour actuel (1 tour = 1 intervalle)
     */
    async updateTrackingFromBudgetStates(currentDay) {
        try {
            // Récupérer les états de budget pour la période actuelle (sauvegardés tous les 3 intervalles: tours 3, 6, 9, 12, ...)
            const budgetStates = await window.budgetManager.getBudgetStatesForPeriod(0, currentDay);
            
            // Mettre à jour les données de tracking
            this.trackingData.currentDay = currentDay;
            
            // Calculer le flux net min et max depuis les états sauvegardés
            if (budgetStates.length > 0) {
                budgetStates.forEach(state => {
                    if (state.netFlow !== undefined) {
                        // Trouver le flux net minimum et son tour
                        if (state.netFlow < this.trackingData.minNetFlow) {
                            this.trackingData.minNetFlow = state.netFlow;
                            this.trackingData.minNetFlowTurn = state.turn;
                        }
                        
                        // Trouver le flux net maximum et son tour
                        if (state.netFlow > this.trackingData.maxNetFlow) {
                            this.trackingData.maxNetFlow = state.netFlow;
                            this.trackingData.maxNetFlowTurn = state.turn;
                        }
                    }
                });
                
                console.log(`📊 Tracking mis à jour depuis ${budgetStates.length} états de budget (tous les 3 intervalles). Min: ${this.trackingData.minNetFlow}€ au tour ${this.trackingData.minNetFlowTurn}, Max: ${this.trackingData.maxNetFlow}€ au tour ${this.trackingData.maxNetFlowTurn}`);
            }
        } catch (error) {
            console.error('Error updating tracking from budget states:', error);
        }
    }

    /**
     * Enregistre les fonds au tour 60 depuis les états de budget
     * Tour 60 = 60 intervalles = 60 jours de jeu
     */
    async saveFundsAtDay60() {
        try {
            // Récupérer l'état de budget au tour 60 (ou le plus proche, qui sera le tour 60 lui-même si divisible par 3)
            const budgetStates = await window.budgetManager.getBudgetStatesForPeriod(57, 60);
            
            // Trouver l'état le plus proche du jour 60
            const stateAtDay60 = budgetStates.find(state => state.turn === 60) || 
                                 budgetStates[budgetStates.length - 1];
            
            if (stateAtDay60) {
                this.trackingData.fundsAtDay60 = stateAtDay60.funds || 0;
                console.log(`📊 Fonds au 60e tour (60 intervalles, depuis état de budget): ${this.trackingData.fundsAtDay60}€`);
            } else {
                // Fallback sur le budget actuel si aucun état n'est trouvé
                const budget = await window.budgetManager.getCurrentBudget();
                this.trackingData.fundsAtDay60 = budget.funds || 0;
                console.log(`📊 Fonds au 60e tour (fallback budget actuel): ${this.trackingData.fundsAtDay60}€`);
            }
        } catch (error) {
            console.error('Error saving funds at day 60:', error);
        }
    }

    /**
     * Active un objectif
     * @param {string} objectiveId - ID de l'objectif
     */
    activateObjective(objectiveId) {
        const objective = this.objectives.find(obj => obj.id === objectiveId);
        if (objective) {
            objective.active = true;
            console.log(`✅ Objective activated: ${objective.title}`);
        }
    }

    /**
     * Vérifie si un objectif est complété
     * @param {string} objectiveId - ID de l'objectif
     */
    async verifyObjective(objectiveId) {
        const objective = this.objectives.find(obj => obj.id === objectiveId);
        if (!objective || objective.completed) return;

        // Mettre à jour les valeurs des requirements
        let allCompleted = true;
        
        objective.requirements.forEach((requirement, index) => {
            const result = requirement.check(this.trackingData);
            requirement.value = result;
            
            if (!result) {
                allCompleted = false;
            }
            
            console.log(`📋 Requirement ${index + 1}: ${requirement.text} - ${result ? '✅' : '❌'}`);
        });

        // Vérifier si tous les requirements sont complétés
        if (allCompleted) {
            objective.completed = true;
            console.log(`🎉 Objective completed: ${objective.title}`);
            this.showObjectiveCompletion(objective);
        }
    }

    /**
     * Affiche une notification de complétion d'objectif
     * @param {Object} objective - Objectif complété
     */
    showObjectiveCompletion(objective) {
        // Créer une notification
        const notification = document.createElement('div');
        notification.className = 'objective-completion-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">🎉</div>
                <div class="notification-text">
                    <div class="notification-title">Objectif Réussi !</div>
                    <div class="notification-message">${objective.title}</div>
                </div>
            </div>
        `;
        
        // Styles inline pour la notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #28a745 0%, #20c997 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 12px;
            box-shadow: 0 8px 25px rgba(40, 167, 69, 0.3);
            z-index: 10001;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            font-weight: 500;
            max-width: 350px;
            animation: slideInRight 0.3s ease-out;
            border: 2px solid rgba(255, 255, 255, 0.2);
        `;
        
        // Ajouter animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    opacity: 0;
                    transform: translateX(100%);
                }
                to {
                    opacity: 1;
                    transform: translateX(0);
                }
            }
            @keyframes slideOutRight {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
        `;
        
        if (!document.querySelector('#objective-notification-styles')) {
            style.id = 'objective-notification-styles';
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }

    /**
     * Obtient le statut d'un objectif
     * @param {string} objectiveId - ID de l'objectif
     * @returns {Object} Statut de l'objectif
     */
    getObjectiveStatus(objectiveId) {
        const objective = this.objectives.find(obj => obj.id === objectiveId);
        if (!objective) return null;

        return {
            title: objective.title,
            description: objective.description,
            requirements: objective.requirements.map(req => ({
                text: req.text,
                completed: req.value
            })),
            active: objective.active,
            completed: objective.completed,
            progress: this.calculateProgress(objective)
        };
    }

    /**
     * Calcule le progrès d'un objectif
     * @param {Object} objective - Objectif
     * @returns {number} Pourcentage de progression (0-100)
     */
    calculateProgress(objective) {
        if (!objective.active) return 0;
        
        const completedRequirements = objective.requirements.filter(req => req.value === true).length;
        return Math.round((completedRequirements / objective.requirements.length) * 100);
    }

    /**
     * Obtient toutes les données de tracking
     * @returns {Object} Données de tracking
     */
    getTrackingData() {
        return { ...this.trackingData };
    }
}

// Créer une instance globale
const objectivesTracker = new ObjectivesTracker();

// Exposer globalement
window.objectivesTracker = objectivesTracker;

export default objectivesTracker;

