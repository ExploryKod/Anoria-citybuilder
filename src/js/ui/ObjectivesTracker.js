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
                description: 'Seuil en spirale : maintenir une gestion financière saine sur 60 jours. Période de grâce de 20 tours après échec.',
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
                        text: 'Les fonds doivent être d\'au moins 600€ à la date cible',
                        check: (data) => data.fundsAtTargetDay >= 600,
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
            fundsAtTargetDay: null,
            currentDay: 0
        };

        this.objectiveFailed = false; // Indique si l'objectif a échoué (seuil atteint)
        this.resetCount = 0; // Nombre de fois que l'objectif a été réinitialisé
        this.lastResetTurn = 0; // Tour du dernier reset (pour tracker depuis le dernier reset uniquement)
        this.gracePeriod = 20; // Période de grâce de 20 tours après un reset (pour seuil en spirale)
        this.targetDay = 60; // Date cible pour les fonds (threshold_date - rééchelonnable)
        
        // Au démarrage d'un nouveau jeu, réinitialiser complètement l'objectif
        const objective = this.objectives.find(obj => obj.id === 'budget_challenge_60_days');
        if (objective) {
            objective.active = false;
            objective.completed = false;
        }
        
        this.init();
    }

    /**
     * Initialise le système de tracking
     */
    init() {
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
            // Activer l'objectif au tour 0 (initialisation d'un nouveau jeu)
            const objective = this.objectives.find(obj => obj.id === 'budget_challenge_60_days');
            if (currentDay === 0 && objective) {
                // Toujours réactiver au tour 0 pour un nouveau jeu
                objective.active = true;
                objective.completed = false;
            }

            // Calculer les données de tracking depuis les états de budget sauvegardés tous les 3 tours (3 intervalles)
            await this.updateTrackingFromBudgetStates(currentDay);

            // Vérifier si le seuil critique a été atteint (flux net < -20)
            // Pour un seuil en spirale (threshold_spiral), on ignore les échecs pendant la période de grâce
            // MAIS seulement à partir de la 2e tentative (resetCount > 0)
            const isInGracePeriod = this.resetCount > 0 && (currentDay - this.lastResetTurn) <= this.gracePeriod;
            
            if (!this.objectiveFailed && this.trackingData.minNetFlow < -20 && !isInGracePeriod) {
                this.objectiveFailed = true;
                await this.handleObjectiveFailure(currentDay);
            }

            // Enregistrer les fonds à la date cible (seuil à date fixe - threshold_date)
            if (currentDay === this.targetDay) {
                await this.saveFundsAtTargetDay();
                
                // Vérifier l'échec sur les fonds juste après avoir enregistré
                if (!this.objectiveFailed && this.trackingData.fundsAtTargetDay < 600) {
                    console.log(`❌ Échec sur les fonds au tour ${this.targetDay}: ${this.trackingData.fundsAtTargetDay}€ au lieu de 600€ (threshold_date)`);
                    
                    // Enregistrer l'échec dans le store
                    try {
                        if (window.objectivesStore) {
                            await window.objectivesStore.recordObjectiveFailure({
                                objectiveId: 'budget_challenge_60_days',
                                type: 'threshold_date',
                                turn: this.targetDay,
                                reason: 'Fonds insuffisants à la date cible',
                                details: {
                                    fundsAtTargetDay: this.trackingData.fundsAtTargetDay,
                                    requiredFunds: 600,
                                    targetDay: this.targetDay,
                                    minNetFlow: this.trackingData.minNetFlow,
                                    maxNetFlow: this.trackingData.maxNetFlow,
                                    maxNetFlowTurn: this.trackingData.maxNetFlowTurn,
                                    resetCount: this.resetCount
                                }
                            });
                        }
                    } catch (error) {
                        console.error('Error recording threshold_date failure:', error);
                    }
                    
                    // Rééchelonner la date cible (ajouter la période de grâce pour donner le même nombre de jours)
                    // 60 jours + 20 tours de grâce = 80 tours au total
                    this.targetDay = currentDay + 80; // 60 + 20 = 80 tours
                    this.trackingData.fundsAtTargetDay = null; // Réinitialiser pour attendre la nouvelle date
                    console.log(`📅 Date cible rééchelonnée au tour ${this.targetDay} (dans 80 tours depuis maintenant)`);
                }
            }

            // Vérifier la complétion à partir du tour 60 minimum
            if (currentDay >= 60 && !this.objectiveFailed && currentDay >= this.targetDay && this.trackingData.fundsAtTargetDay !== null && this.trackingData.fundsAtTargetDay >= 600) {
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
            // Récupérer les états de budget depuis le dernier reset uniquement (pour ne pas inclure les anciennes valeurs échouées)
            const budgetStates = await window.budgetManager.getBudgetStatesForPeriod(this.lastResetTurn, currentDay);
            
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
                
            }
        } catch (error) {
            console.error('Error updating tracking from budget states:', error);
        }
    }

    /**
     * Enregistre les fonds à la date cible depuis les états de budget
     * Date cible rééchelonnable (threshold_date)
     */
    async saveFundsAtTargetDay() {
        try {
            // Récupérer l'état de budget à la date cible (tour targetDay)
            const budgetStates = await window.budgetManager.getBudgetStatesForPeriod(this.targetDay - 3, this.targetDay);
            
            // Trouver l'état le plus proche de la date cible
            const stateAtTargetDay = budgetStates.find(state => state.turn === this.targetDay) || 
                                     budgetStates[budgetStates.length - 1];
            
            if (stateAtTargetDay) {
                this.trackingData.fundsAtTargetDay = stateAtTargetDay.funds || 0;
            } else {
                // Fallback sur le budget actuel si aucun état n'est trouvé
                const budget = await window.budgetManager.getCurrentBudget();
                this.trackingData.fundsAtTargetDay = budget.funds || 0;
            }
        } catch (error) {
            console.error('Error saving funds at target day:', error);
        }
    }

    /**
     * Gère l'échec de l'objectif (seuil critique atteint)
     * @param {number} currentDay - Tour actuel
     */
    async handleObjectiveFailure(currentDay) {
        // Afficher une modale de rééchelonnement
        this.showRescheduleModal();
    }

    /**
     * Affiche une modale de rééchelonnement de l'objectif
     */
    showRescheduleModal() {
        // Créer l'overlay semi-transparent
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 2, 53, 0.85);
            z-index: 10001;
            backdrop-filter: blur(3px);
        `;
        
        const modal = document.createElement('div');
        modal.className = 'objective-reschedule-modal';
        modal.innerHTML = `
            <div class="reschedule-modal-content">
                <h3>⚠️ Objectif Non Atteint</h3>
                <div class="reschedule-modal-message">
                    <p>Le flux net est descendu à <strong>${this.trackingData.minNetFlow}€</strong> au tour ${this.trackingData.minNetFlowTurn}.</p>
                    <p>L'objectif (seuil en spirale) exigeait que le flux net ne descende jamais en dessous de -20€. ${this.resetCount === 0 ? 'Vous aurez maintenant une période de grâce de 20 tours pour vous remettre en ordre.' : 'Après cette tentative, vous bénéficierez d\'une période de grâce de 20 tours.'}</p>
                </div>
                <div class="reschedule-modal-buttons">
                    <button class="reschedule-btn">Rééchelonner l'objectif</button>
                    <button class="replay-all-btn">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-rotate-ccw">
                            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                            <path d="M3 3v5h5"/>
                        </svg>
                        Rejouer
                    </button>
                </div>
            </div>
        `;
        
        // Styles inline pour la modale
        modal.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #fafafa;
            border: 3px solid var(--cta);
            border-radius: 10px;
            padding: 20px;
            max-width: 450px;
            width: 90%;
            z-index: 10002;
            color: var(--primary);
            box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
        `;
        
        // Style du contenu
        const content = modal.querySelector('.reschedule-modal-content');
        content.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 16px;
        `;
        
        const heading = modal.querySelector('h3');
        heading.style.cssText = `
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--cta);
            border-bottom: 2px solid var(--cta);
            padding-bottom: 12px;
        `;
        
        const message = modal.querySelector('.reschedule-modal-message');
        message.style.cssText = `
            color: var(--primary);
            font-size: 14px;
            line-height: 1.5;
        `;
        
        const buttons = modal.querySelector('.reschedule-modal-buttons');
        buttons.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: center;
            padding-top: 8px;
            border-top: 2px solid var(--cta);
        `;
        
        const rescheduleBtn = modal.querySelector('.reschedule-btn');
        rescheduleBtn.style.cssText = `
            padding: 10px 24px;
            border: 3px solid var(--cta);
            border-radius: 10px;
            background: var(--cta);
            color: white;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.3s ease;
        `;
        
        rescheduleBtn.addEventListener('mouseenter', () => {
            rescheduleBtn.style.background = 'white';
            rescheduleBtn.style.color = 'var(--cta)';
        });
        
        rescheduleBtn.addEventListener('mouseleave', () => {
            rescheduleBtn.style.background = 'var(--cta)';
            rescheduleBtn.style.color = 'white';
        });
        
        // Style et gestionnaire pour le bouton Rejouer
        const replayAllBtn = modal.querySelector('.replay-all-btn');
        replayAllBtn.style.cssText = `
            padding: 10px 20px;
            border: 3px solid var(--cta);
            border-radius: 10px;
            background: white;
            color: var(--cta);
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
            transition: all 0.3s ease;
        `;
        
        replayAllBtn.addEventListener('mouseenter', () => {
            replayAllBtn.style.background = 'var(--cta)';
            replayAllBtn.style.color = 'white';
        });
        
        replayAllBtn.addEventListener('mouseleave', () => {
            replayAllBtn.style.background = 'white';
            replayAllBtn.style.color = 'var(--cta)';
        });
        
        // Gestionnaire pour rejouer (reload la page)
        replayAllBtn.addEventListener('click', () => {
            window.location.href = '/';
        });
        
        document.body.appendChild(overlay);
        document.body.appendChild(modal);
        
        // Gestionnaire pour rééchelonner
        rescheduleBtn.addEventListener('click', async () => {
            await this.rescheduleObjective();
            overlay.remove();
            modal.remove();
        });
        
        // Désactiver les événements Three.js quand la modale est ouverte
        if (window.tutorialManager && window.tutorialManager.disableThreeJSEvents) {
            window.tutorialManager.disableThreeJSEvents();
        }
    }

    /**
     * Rééchelonne l'objectif (remet à zéro les compteurs du tracker uniquement)
     * Enregistre l'échec dans le store objectives
     */
    async rescheduleObjective() {
        // Enregistrer l'échec dans le store
        try {
            if (window.objectivesStore) {
                await window.objectivesStore.recordObjectiveFailure({
                    objectiveId: 'budget_challenge_60_days',
                    type: 'threshold_spiral',
                    turn: this.trackingData.minNetFlowTurn,
                    reason: 'Flux net minimum en dessous de -20€',
                    details: {
                        minNetFlow: this.trackingData.minNetFlow,
                        maxNetFlow: this.trackingData.maxNetFlow,
                        maxNetFlowTurn: this.trackingData.maxNetFlowTurn,
                        fundsAtTargetDay: this.trackingData.fundsAtTargetDay,
                        targetDay: this.targetDay,
                        resetCount: this.resetCount
                    }
                });
            }
        } catch (error) {
            console.error('Error recording objective failure:', error);
        }
        
        // Sauvegarder les données actuelles avant reset
        const previousData = {
            minNetFlow: this.trackingData.minNetFlow,
            maxNetFlow: this.trackingData.maxNetFlow,
            minNetFlowTurn: this.trackingData.minNetFlowTurn,
            maxNetFlowTurn: this.trackingData.maxNetFlowTurn
        };
        
        // Reset uniquement les compteurs du tracker
        this.trackingData = {
            minNetFlow: Infinity,
            maxNetFlow: -Infinity,
            minNetFlowTurn: null,
            maxNetFlowTurn: null,
            fundsAtTargetDay: null,
            currentDay: this.trackingData.currentDay // Garder le tour actuel
        };
        
        // Enregistrer le tour du reset pour tracker uniquement depuis ce tour
        this.lastResetTurn = this.trackingData.currentDay;
        
        // Réinitialiser la date cible (ajouter la période de grâce pour donner le même nombre de jours)
        // Donc +80 tours (60 jours + 20 tours de grâce) pour compenser la période de grâce au début
        // Mais seulement si on est déjà passé au-delà du tour 60, sinon on attend toujours le tour 60
        if (this.trackingData.currentDay >= 60) {
            this.targetDay = this.trackingData.currentDay + 80; // 60 + 20 = 80 tours
        } else {
            this.targetDay = 60;
        }
        
        // Réinitialiser le statut d'échec
        this.objectiveFailed = false;
        this.resetCount++;
        
        // IMPORTANT : Réactiver l'objectif pour permettre une nouvelle tentative
        const objective = this.objectives.find(obj => obj.id === 'budget_challenge_60_days');
        if (objective) {
            objective.active = true;
            objective.completed = false;
        }
        
        // Message de confirmation
        this.showRescheduleSuccess();
        
        // Réactiver les événements Three.js
        if (window.tutorialManager && window.tutorialManager.enableThreeJSEvents) {
            window.tutorialManager.enableThreeJSEvents();
        }
    }

    /**
     * Affiche un message de succès du rééchelonnement
     */
    showRescheduleSuccess() {
        const notification = document.createElement('div');
        notification.className = 'objective-reschedule-success';
        notification.innerHTML = `
            <div style="padding: 8px 12px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; border-radius: 8px; border: 2px solid rgba(255, 255, 255, 0.2);">
                <strong>✓</strong> Objectif rééchelonné - Nouvelle tentative en cours
            </div>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            z-index: 10002;
            animation: slideInRight 0.3s ease-out;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    /**
     * Active un objectif
     * @param {string} objectiveId - ID de l'objectif
     */
    activateObjective(objectiveId) {
        const objective = this.objectives.find(obj => obj.id === objectiveId);
        if (objective) {
            objective.active = true;
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
            
        });

        // Vérifier si tous les requirements sont complétés
        if (allCompleted) {
            objective.completed = true;
            
            // Enregistrer le succès dans le store
            await this.recordObjectiveCompletion(objectiveId, this.trackingData.currentDay);
            
            // Afficher la notification
            this.showObjectiveCompletion(objective);
            
            // Réinitialiser complètement pour qu'il n'y ait plus d'objectif actif
            this.resetAfterCompletion();
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

    /**
     * Enregistre la complétion d'un objectif dans le store
     * @param {string} objectiveId - ID de l'objectif complété
     * @param {number} turn - Tour où l'objectif a été complété
     */
    async recordObjectiveCompletion(objectiveId, turn) {
        try {
            const objective = this.objectives.find(obj => obj.id === objectiveId);
            
            if (window.objectivesStore) {
                await window.objectivesStore.recordObjectiveSuccess({
                    objectiveId: objectiveId,
                    turn: turn,
                    details: {
                        title: objective?.title || 'Unknown',
                        description: objective?.description || '',
                        minNetFlow: this.trackingData.minNetFlow,
                        maxNetFlow: this.trackingData.maxNetFlow,
                        fundsAtTargetDay: this.trackingData.fundsAtTargetDay,
                        resetCount: this.resetCount,
                        totalAttempts: this.resetCount + 1
                    }
                });
            }
        } catch (error) {
            console.error('Error recording objective completion:', error);
        }
    }

    /**
     * Réinitialise complètement après la complétion d'un objectif
     * Tout redevient neutre - pas d'objectif actif
     */
    resetAfterCompletion() {
        // Réinitialiser tous les compteurs
        this.trackingData = {
            minNetFlow: Infinity,
            maxNetFlow: -Infinity,
            minNetFlowTurn: null,
            maxNetFlowTurn: null,
            fundsAtTargetDay: null,
            currentDay: this.trackingData.currentDay // Garder le tour actuel
        };
        
        // Réinitialiser le statut d'échec et les compteurs
        this.objectiveFailed = false;
        this.resetCount = 0;
        this.lastResetTurn = 0;
        this.targetDay = 60;
        
        // Désactiver l'objectif après succès
        const objective = this.objectives.find(obj => obj.id === 'budget_challenge_60_days');
        if (objective) {
            objective.active = false;
            objective.completed = false;
        }
    }
}

// Créer une instance globale
const objectivesTracker = new ObjectivesTracker();

// Exposer globalement
window.objectivesTracker = objectivesTracker;

export default objectivesTracker;

