/**
 * ObjectivesTracker - Gestion des objectifs financiers
 * Treasury via sessionApi.accounting
 */

import { getObjectivesManager, getButtonStateManager, registerAppService } from '../../../composition/sessionShell.js';
import {
  OBJECTIVE_CATALOG,
  isObjectiveRequirementMet,
} from '../../../composition/accountingObjectivesCatalog.js';
import { requireSessionAccountingApi } from '../../../composition/sessionRuntime.js';

const BUDGET_CHALLENGE_OBJECTIVE_ID = 'budget_challenge_5000';
const budgetChallengeDefinition = OBJECTIVE_CATALOG[BUDGET_CHALLENGE_OBJECTIVE_ID];
class ObjectivesTracker {
    constructor() {
        // TEST MODE: Désactiver les objectifs pour les tests
        // Méthode 1: Variable d'environnement Vite (prioritaire)
        // Créer un fichier .env.local avec: VITE_IS_GOAL=false
        // Méthode 2: localStorage (fallback)
        // Pour désactiver: localStorage.setItem('objectives-disabled', 'true')
        // Pour réactiver: localStorage.removeItem('objectives-disabled') ou localStorage.setItem('objectives-disabled', 'false')
        
        // Vérifier d'abord la variable d'environnement Vite
        const envDisabled = import.meta.env.VITE_IS_GOAL === 'false' || import.meta.env.VITE_IS_GOAL === false;
        // Ensuite vérifier localStorage (fallback)
        const localStorageDisabled = localStorage.getItem('objectives-disabled') === 'true';
        
        // Les objectifs sont activés par défaut, sauf si désactivés par env ou localStorage
        this.enabled = !envDisabled && !localStorageDisabled;
        
        // Log pour debug
        if (envDisabled) {
            console.info('🎯 Objectifs désactivés via variable d\'environnement VITE_IS_GOAL=false');
        } else if (localStorageDisabled) {
            console.info('🎯 Objectifs désactivés via localStorage');
        }
        
        this.objectives = [
            {
                id: budgetChallengeDefinition.id,
                title: budgetChallengeDefinition.title,
                description: budgetChallengeDefinition.description,
                requirements: [
                    {
                        text: budgetChallengeDefinition.requirementText,
                        check: (data) =>
                            isObjectiveRequirementMet(BUDGET_CHALLENGE_OBJECTIVE_ID, data),
                        value: null
                    }
                ],
                active: false,
                completed: false
            }
        ];

        this.trackingData = {
            currentFunds: 0,
            currentDay: 0
        };
        
        // Au démarrage d'un nouveau jeu, l'objectif est inactif par défaut
        // Il sera activé au tour 0 par checkObjectives(0)
        const objective = this.objectives.find((obj) => obj.id === BUDGET_CHALLENGE_OBJECTIVE_ID);
        if (objective) {
            objective.active = false; // Activé au tour 0
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
     * @param {number} currentDay - Tour actuel (1 tour = 1 intervalle du jeu)
     */
    async checkObjectives(currentDay) {
        // TEST MODE: Si les objectifs sont désactivés, ne rien faire
        if (!this.enabled) {
            return;
        }
        
        try {
            // Activer l'objectif au tour 0 (initialisation d'un nouveau jeu)
            const objective = this.objectives.find((obj) => obj.id === BUDGET_CHALLENGE_OBJECTIVE_ID);
            if (currentDay === 0 && objective) {
                objective.active = true;
                objective.completed = false;
            }

            this.trackingData.currentDay = currentDay;

            const budget = await requireSessionAccountingApi().getTreasurySnapshot();
            this.trackingData.currentFunds = budget.funds || 0;

            if (
                objective &&
                objective.active &&
                !objective.completed &&
                isObjectiveRequirementMet(BUDGET_CHALLENGE_OBJECTIVE_ID, this.trackingData)
            ) {
                await this.verifyObjective(BUDGET_CHALLENGE_OBJECTIVE_ID);
            }

        } catch (error) {
            console.error('Error checking objectives:', error);
        }
    }

    /**
     * Affiche une modale de rééchelonnement de l'objectif (deprecated - kept for compatibility)
     * No longer used with simplified objective
     */
    showRescheduleModal() {
        // This function is deprecated - simplified objective doesn't need rescheduling
        return;
        
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
        if (getObjectivesManager() && getObjectivesManager().disableThreeJSEvents) {
            getObjectivesManager().disableThreeJSEvents();
        }
    }

    /**
     * Rééchelonne l'objectif (deprecated - kept for compatibility)
     */
    async rescheduleObjective() {
        // No longer needed with simplified objective
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
        // Déverrouiller House-Purple quand l'objectif est complété
        if (getButtonStateManager()) {
            getButtonStateManager().enable('House-Purple');
            
            // Animation pour attirer l'attention sur le bouton déverrouillé
            setTimeout(() => {
                // Trouver le bouton dans le panel (si le panel residential est ouvert)
                const purpleBtn = document.getElementById('House-Purple');
                if (purpleBtn) {
                    purpleBtn.classList.add('building-unlocked');
                    
                    // Scroll vers le bouton si dans un container scrollable
                    purpleBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                    // Retirer la classe après l'animation
                    setTimeout(() => {
                        purpleBtn.classList.remove('building-unlocked');
                    }, 1000);
                }
            }, 500);
        }
        
        // Créer une notification
        const notification = document.createElement('div');
        notification.className = 'objective-completion-notification';
        notification.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">🎉</div>
                <div class="notification-text">
                    <div class="notification-title">Objectif Réussi !</div>
                    <div class="notification-message">${objective.title}</div>
                    <div class="unlock-message" style="margin-top: 10px; font-size: 12px; font-weight: 600; color: #ffd700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">🏰 Maison Violette déverrouillée !</div>
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
            
            const objectivesStore = requireSessionAccountingApi().getObjectivesStore();
            if (objectivesStore) {
                await objectivesStore.recordObjectiveSuccess({
                    objectiveId: objectiveId,
                    turn: turn,
                    details: {
                        title: objective?.title || 'Unknown',
                        description: objective?.description || '',
                        currentFunds: this.trackingData.currentFunds,
                        turn: turn
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
        // Réinitialiser les données de tracking
        this.trackingData = {
            currentFunds: 0,
            currentDay: this.trackingData.currentDay // Garder le tour actuel
        };
        
        // Désactiver l'objectif après succès
        const objective = this.objectives.find((obj) => obj.id === BUDGET_CHALLENGE_OBJECTIVE_ID);
        if (objective) {
            objective.active = false;
            objective.completed = false;
        }
    }
}

// Créer une instance globale
const objectivesTracker = new ObjectivesTracker();

registerAppService('objectivesTracker', objectivesTracker);

export default objectivesTracker;

