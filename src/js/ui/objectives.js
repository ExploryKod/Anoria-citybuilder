/**
 * Système de Tutoriel - Anoria City Builder
 * Gère l'affichage et la logique de la popup de tutoriel
 */

class ObjectivesManager {
    constructor() {
        this.panel = null;
        this.currentStep = 0;
        this.steps = [];
        this.isVisible = false;
        this.isInitialized = false;
        
        // Utilisation de EventBlocker par composition
        this.eventBlocker = new EventBlocker();
        
        this.init();
    }

    /**
     * Initialise le système de tutoriel
     */
    async init() {
        if (this.isInitialized) return;
        
        // Attendre que le DOM soit chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', async () => await this.init());
            return;
        }
        
        this.panel = document.getElementById('objectives-panel');
        if (!this.panel) {
            console.error('Objectives panel not found in DOM');
            return;
        }

        this.setupEventListeners();
        await this.setupDefaultSteps();
        this.isInitialized = true;
    }

    /**
     * Configure les event listeners
     */
    setupEventListeners() {
        const previousBtn = this.panel.querySelector('.objectives-previous-btn');
        const nextBtn = this.panel.querySelector('.objectives-next-btn');
        const skipBtn = this.panel.querySelector('.objectives-skip-btn');
        const closeBtn = this.panel.querySelector('.objectives-close-btn');

        if (previousBtn) {
            previousBtn.addEventListener('click', () => this.previousStep());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
        }

        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipObjectives());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeObjectives());
        }

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.closeObjectives();
            }
        });
    }

    /**
     * Configure le contenu (objectifs)
     */
    async setupDefaultSteps() {
        // Charger les objectifs depuis le tracker
        if (window.objectivesTracker) {
            const objectives = window.objectivesTracker.objectives;
            const activeObjectives = objectives.filter(obj => obj.active && !obj.completed);
            
            console.log('📋 setupDefaultSteps - Objectives state:', {
                total: objectives.length,
                active: objectives.filter(obj => obj.active).length,
                completed: objectives.filter(obj => obj.completed).length,
                activeObjectivesCount: activeObjectives.length
            });
            
            // Initialiser les étapes
            this.steps = [];
            
            if (activeObjectives.length > 0) {
                // Afficher le premier objectif actif uniquement
                const firstObjective = activeObjectives[0];
                this.steps.push({
                    title: firstObjective.title,
                    content: await this.createObjectiveContent(firstObjective)
                });
            } else {
                // Aucun objectif actif - afficher un message neutre
                this.steps.push({
                    title: '🎯 Objectifs',
                    content: `
                        <div style="text-align: center; padding: 40px;">
                            <p style="margin-bottom: 20px; font-size: 16px; color: var(--primary);">
                                Aucun objectif actif pour le moment.
                            </p>
                            <p style="margin-bottom: 30px; font-size: 14px; color: var(--primary); opacity: 0.7;">
                                Votre ville continue de fonctionner normalement.
                            </p>
                        </div>
                    `
                });
            }
        } else {
            // Fallback si le tracker n'est pas disponible
            this.steps = [
                {
                    title: '🎯 Objectifs',
                    content: '<p>Les objectifs sont en cours de chargement...</p>'
                }
            ];
        }
    }

    /**
     * Crée le contenu HTML pour un objectif
     * @param {Object} objective - Objectif à afficher
     * @returns {string} HTML du contenu
     */
    async createObjectiveContent(objective) {
        let html = `<p>${objective.description}</p>`;
        
        if (objective.requirements && objective.requirements.length > 0) {
            html += '<div style="background: rgba(251, 129, 34, 0.1); border-radius: 8px; padding: 12px; margin-top: 12px;">';
            html += '<strong style="color: var(--cta); display: block; margin-bottom: 8px;">Conditions :</strong>';
            html += '<div style="display: flex; flex-direction: column; gap: 6px; align-items: flex-start;">';
            
            objective.requirements.forEach((req, index) => {
                const status = req.value === true ? '✅' : req.value === false ? '❌' : '⏳';
                const color = req.value === true ? '#28a745' : req.value === false ? '#dc3545' : '#ffc107';
                html += `<div style="display: flex; align-items: center; margin: 0; padding: 0;">
                    <span style="color: ${color}; margin-right: 8px; flex-shrink: 0;">${status}</span>
                    <span style="text-align: left;">${req.text}</span>
                </div>`;
            });
            
            html += '</div>';
            html += '</div>';
        }

        // Afficher les données de tracking si disponible
        if (window.objectivesTracker) {
            const trackingData = window.objectivesTracker.getTrackingData();
            const resetCount = window.objectivesTracker.resetCount || 0;
            const hasFailed = window.objectivesTracker.objectiveFailed;
            
            // Calculer la période de grâce (uniquement pour les tentatives après échec)
            const turnsSinceReset = trackingData.currentDay - (window.objectivesTracker?.lastResetTurn || 0);
            const isInGracePeriod = resetCount > 0 && turnsSinceReset >= 0 && turnsSinceReset <= (window.objectivesTracker?.gracePeriod || 20);
            
            html += `<div style="background: rgba(251, 129, 34, 0.05); border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid rgba(251, 129, 34, 0.2); text-align: left;">`;
            html += '<strong style="color: var(--cta); display: block; margin-bottom: 8px; text-align: left;">État actuel :</strong>';
            
            // Afficher le nombre de tentatives
            if (resetCount > 0 || hasFailed) {
                html += `<p style="margin: 4px 0; color: var(--primary); font-size: 0.9em; text-align: left;">
                    <strong>Tentative :</strong> ${resetCount + 1} 
                    ${hasFailed ? '<span style="color: #dc3545;">❌ Échec actuel</span>' : ''}
                    ${isInGracePeriod && !hasFailed ? `<span style="color: #28a745;"> • Période de grâce (${turnsSinceReset}/${window.objectivesTracker?.gracePeriod || 20})</span>` : ''}
                </p>`;
            }
            
            if (trackingData.currentDay !== undefined) {
                html += `<p style="margin: 4px 0; color: var(--primary); text-align: left;"><strong>Tour actuel :</strong> ${trackingData.currentDay}</p>`;
            }
            if (isInGracePeriod) {
                // Pendant la période de grâce, afficher "Grâcié" en vert
                html += `<p style="margin: 4px 0; color: var(--primary); text-align: left;">
                    <strong>Flux net minimum :</strong> 
                    <span style="color: #28a745; font-weight: 600;">Grâcié</span>
                    ✅
                </p>`;
            } else if (trackingData.minNetFlow !== Infinity) {
                const isValid = trackingData.minNetFlow >= -20;
                const statusColor = isValid ? '#28a745' : '#dc3545';
                const statusIcon = isValid ? '✅' : '❌';
                const turnInfo = trackingData.minNetFlowTurn !== null ? ` (tour ${trackingData.minNetFlowTurn})` : '';
                const warning = hasFailed && !isValid ? ' <span style="color: #ffc107; font-size: 0.85em;">⚠ Seuil atteint</span>' : '';
                html += `<p style="margin: 4px 0; color: var(--primary); text-align: left;">
                    <strong>Flux net minimum :</strong> 
                    <span style="color: ${statusColor};">${trackingData.minNetFlow}€${turnInfo}</span>
                    ${statusIcon}${warning}
                </p>`;
            } else {
                // Aucune donnée encore pour cette tentative
                html += `<p style="margin: 4px 0; color: var(--primary); font-style: italic; opacity: 0.7; text-align: left;">
                    <strong>Flux net minimum :</strong> En attente de données...
                </p>`;
            }
            
            if (isInGracePeriod) {
                // Pendant la période de grâce, afficher "Grâcié" en vert
                html += `<p style="margin: 4px 0; color: var(--primary); text-align: left;">
                    <strong>Flux net maximum :</strong> 
                    <span style="color: #28a745; font-weight: 600;">Grâcié</span>
                    ✅
                </p>`;
            } else if (trackingData.maxNetFlow !== -Infinity) {
                const isValid = trackingData.maxNetFlow >= 100;
                const statusColor = isValid ? '#28a745' : '#dc3545';
                const statusIcon = isValid ? '✅' : '❌';
                const turnInfo = trackingData.maxNetFlowTurn !== null ? ` (tour ${trackingData.maxNetFlowTurn})` : '';
                html += `<p style="margin: 4px 0; color: var(--primary); text-align: left;">
                    <strong>Flux net maximum :</strong> 
                    <span style="color: ${statusColor};">${trackingData.maxNetFlow}€${turnInfo}</span>
                    ${statusIcon}
                </p>`;
            } else {
                // Aucune donnée encore pour cette tentative
                html += `<p style="margin: 4px 0; color: var(--primary); font-style: italic; opacity: 0.7; text-align: left;">
                    <strong>Flux net maximum :</strong> En attente de données...
                </p>`;
            }
                // Afficher les fonds max atteints et le nombre de tours restants
                const currentTargetDay = window.objectivesTracker?.targetDay || 60;
                const lastResetTurn = window.objectivesTracker?.lastResetTurn || 0;
                const isFirstAttempt = resetCount === 0; // Première tentative = pas de rééchelonnement
                
                if (trackingData.fundsAtTargetDay !== null) {
                    const isValid = trackingData.fundsAtTargetDay >= 600;
                    const statusColor = isValid ? '#28a745' : '#dc3545';
                    const statusIcon = isValid ? '✅' : '❌';
                    html += `<p style="margin: 4px 0; color: var(--primary); text-align: left;">
                        <strong>Fonds max atteints :</strong> 
                        <span style="color: ${statusColor};">${trackingData.fundsAtTargetDay}€</span>
                        ${statusIcon}
                        <span style="font-size: 0.85em; opacity: 0.7;"> (cible: 600€ au tour ${currentTargetDay})</span>
                    </p>`;
                } else if (currentTargetDay >= trackingData.currentDay) {
                    // Message différent selon si c'est la première tentative ou une tentative rééchelonnée
                    let targetMessage;
                    if (isFirstAttempt) {
                        // Première tentative : tour 0 + 0 (pas de grâce) + 60 tours = tour 60
                        targetMessage = `dans 60 tours (tour 60)`;
                    } else {
                        // Tentatives suivantes : tour de départ + 20 (grâce) + 60 (objectif)
                        const targetTour = lastResetTurn + 20 + 60;
                        targetMessage = `dans 60 tours après période de grâce (tour ${targetTour})`;
                    }
                    
                    html += `<p style="margin: 4px 0; color: var(--primary); font-style: italic; opacity: 0.7; text-align: left;">
                        <strong>Fonds max atteints :</strong> En attente... (cible ${targetMessage})
                    </p>`;
                } else {
                    html += `<p style="margin: 4px 0; color: #ffc107; font-style: italic; text-align: left;">
                        <strong>Fonds max atteints :</strong> En attente d'évaluation au tour ${currentTargetDay}...
                    </p>`;
                }
            
            html += '</div>';
            
            // Afficher les informations sur les états de budget
            html += `<div style="background: rgba(251, 129, 34, 0.03); border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid rgba(251, 129, 34, 0.1); text-align: left;">`;
            html += '<strong style="color: var(--cta); display: block; margin-bottom: 8px; font-size: 0.9em;">ℹ️</strong>';
            
            // Message adapté selon l'état
            const targetDay = window.objectivesTracker?.targetDay || 60;
            const targetDayWasRescheduled = targetDay > 60;
            
            if (resetCount > 0) {
                html += `<p style="margin: 0; color: var(--primary); font-size: 0.85em; line-height: 1.4; text-align: left;">`;
                html += `Données de la <strong>Tentative ${resetCount + 1}</strong> (depuis le tour ${window.objectivesTracker?.lastResetTurn || 'rééchelonnement'}). `;
                html += `Issues des <strong>comptes de résultat</strong> dans "États Budgets".`;
                if (isInGracePeriod) {
                    html += ` <span style="color: #28a745; font-weight: 600;">✓ Période de grâce active</span>`;
                }
                html += `</p>`;
            } else {
                html += `<p style="margin: 0; color: var(--primary); font-size: 0.85em; line-height: 1.4; text-align: left;">`;
                html += `Données issues des <strong>comptes de résultat</strong> (tous les 3 tours) dans "États Budgets".`;
                html += ` <span style="color: #ffc107; font-weight: 600;">⚠️ Si vous échouez, une période de grâce de 20 tours vous sera accordée</span>`;
                html += `</p>`;
            }
            
            // Indiquer si la date cible a été rééchelonnée (uniquement pour les tentatives suivantes)
            if (resetCount > 0 && targetDayWasRescheduled) {
                html += `<p style="margin: 4px 0 0 0; color: var(--primary); font-size: 0.85em; line-height: 1.4; text-align: left;">`;
                const startOfAttempt = window.objectivesTracker?.lastResetTurn || 0;
                const targetTour = startOfAttempt + 20 + 60; // T2T + 20 (grâce) + 60 (objectif)
                html += `<strong style="color: var(--cta);">📅</strong> Date cible rééchelonnée au tour <strong>${targetTour}</strong> (départ: tour ${startOfAttempt} + 20 tours de grâce + 60 tours objectif).`;
                html += `</p>`;
            }
            
            // Aide pour retrouver le compte de résultat concerné en cas d'échec
            const failedTurns = [];
            if (trackingData.minNetFlow !== Infinity && trackingData.minNetFlow < -20) {
                failedTurns.push(trackingData.minNetFlowTurn);
            }
            if (trackingData.maxNetFlow !== -Infinity && trackingData.maxNetFlow < 100) {
                failedTurns.push(trackingData.maxNetFlowTurn);
            }
            if (trackingData.fundsAtTargetDay !== null && trackingData.fundsAtTargetDay < 600) {
                const targetDay = window.objectivesTracker?.targetDay || 60;
                failedTurns.push(targetDay);
            }
            
            if (failedTurns.length > 0) {
                const uniqueTurns = [...new Set(failedTurns)].sort((a, b) => a - b);
                html += `<p style="margin: 8px 0 0 0; color: var(--primary); font-size: 0.85em; line-height: 1.4; text-align: left;">`;
                html += `<strong style="color: var(--cta);">💡</strong> `;
                html += `Consult <strong>"États Budgets"</strong> aux tours ${uniqueTurns.join(', ')} pour analyser la situation.`;
                html += `</p>`;
            }
            
            html += '</div>';
        }
        
        // Ajouter un bouton pour accéder à l'historique si disponible
        // Toujours disponible à partir de la 2e tentative (resetCount >= 1)
        try {
            const resetCount = window.objectivesTracker?.resetCount || 0;
            
            // Toujours afficher le bouton d'historique dès la 2e tentative
            if (resetCount >= 1) {
                html += `
                    <div style="margin-top: 20px; text-align: center;">
                        <button id="show-history-btn" style="background: var(--cta); color: white; border: none; border-radius: 10px; padding: 12px 24px; cursor: pointer; font-weight: 600; font-size: 14px;">
                            📜 Voir l'historique des objectifs
                        </button>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Error checking history:', error);
        }

        return html;
    }

    /**
     * Désactive les événements Three.js
     */
    disableThreeJSEvents() {
        this.eventBlocker.blockThreeJSEvents({
            onBlock: (eventType, e) => {
            }
        });
    }

    /**
     * Réactive les événements Three.js
     */
    enableThreeJSEvents() {
        this.eventBlocker.unblockEvents();
    }

    /**
     * Affiche les objectifs
     */
    async showObjectives() {
        if (!this.isInitialized) {
            this.init();
        }

        // Rafraîchir les étapes pour avoir les dernières données
        await this.setupDefaultSteps();

        this.currentStep = 0;
        await this.updateDisplay();
        this.panel.classList.add('visible');
        this.isVisible = true;
        
        // Désactiver les événements Three.js
        this.disableThreeJSEvents();
        
        // Mettre le jeu en pause
        if (window.game && typeof window.game.pause === 'function') {
            window.game.pause();
        }
    }

    /**
     * Cache le tutoriel
     */
    hideObjectives() {
        this.panel.classList.remove('visible');
        this.isVisible = false;
        
        // Réactiver les événements Three.js
        this.enableThreeJSEvents();
        
        // Reprendre le jeu
        if (window.game && typeof window.game.play === 'function') {
            window.game.play();
        }
    }

    /**
     * Ferme le tutoriel
     */
    closeObjectives() {
        this.hideObjectives();
    }

    // Ces méthodes ne sont plus utilisées car il n'y a pas d'étapes
    nextStep() {
        // Ne rien faire
    }

    previousStep() {
        // Ne rien faire
    }

    skipObjectives() {
        // Ne rien faire
    }

    /**
     * Met à jour l'affichage du contenu
     */
    async updateDisplay() {
        const step = this.steps[this.currentStep];
        if (!step) return;

        // Mettre à jour le titre
        const header = this.panel.querySelector('.objectives-panel-header h3');
        if (header) {
            header.textContent = step.title;
        }

        // Mettre à jour le contenu
        const content = this.panel.querySelector('.objectives-content');
        if (content) {
            if (typeof step.content === 'function') {
                content.innerHTML = await step.content();
            } else {
                content.innerHTML = step.content;
            }
            
            // Ajouter le gestionnaire pour le bouton d'historique
            const historyBtn = content.querySelector('#show-history-btn');
            if (historyBtn) {
                historyBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    console.log('History button clicked');
                    if (window.objectivesHistory && window.objectivesHistory.showHistory) {
                        console.log('Calling window.objectivesHistory.showHistory()');
                        window.objectivesHistory.showHistory();
                    } else {
                        console.warn('window.objectivesHistory not available');
                    }
                });
            }
        }

        // Mettre à jour les boutons - tout cacher sauf "Fermer"
        this.updateButtons();
    }
    
    /**
     * Charge le contenu de l'historique
     */
    async loadHistoryContent() {
        const historyContent = document.getElementById('history-content');
        if (!historyContent) return;
        
        try {
            const allRecords = await window.objectivesStore.getAllFailures();
            const failures = allRecords.filter(r => r.name?.startsWith('failure_'));
            const successes = allRecords.filter(r => r.name?.startsWith('success_'));
            
            if (failures.length === 0 && successes.length === 0) {
                historyContent.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: var(--primary); opacity: 0.6;">
                        <p style="margin: 0; font-size: 16px;">Aucun historique disponible pour le moment.</p>
                    </div>
                `;
            } else {
                // Créer une version simplifiée de l'historique
                let html = '<div style="max-height: 400px; overflow-y: auto;">';
                
                if (successes.length > 0) {
                    html += `<h4 style="color: #28a745; margin: 20px 0 10px 0;">✅ Succès (${successes.length})</h4>`;
                    successes.forEach(success => {
                        html += `<p style="margin: 8px 0; color: var(--primary); font-size: 13px;">
                            🎉 Tour ${success.successTurn} - ${success.successDetails?.title || 'Objectif réussi'}
                        </p>`;
                    });
                }
                
                if (failures.length > 0) {
                    html += `<h4 style="color: #dc3545; margin: 20px 0 10px 0;">❌ Échecs (${failures.length})</h4>`;
                    failures.forEach(failure => {
                        html += `<p style="margin: 8px 0; color: var(--primary); font-size: 13px;">
                            ❌ Tour ${failure.failureTurn} - ${failure.failureReason || 'Échec'}
                        </p>`;
                    });
                }
                
                html += '</div>';
                html += `
                    <div style="text-align: center; margin-top: 20px;">
                        <button id="open-full-history-btn" style="background: var(--cta); color: white; border: none; border-radius: 10px; padding: 10px 20px; cursor: pointer; font-weight: 600; font-size: 13px;">
                            📜 Voir l'historique complet
                        </button>
                    </div>
                `;
                
                historyContent.innerHTML = html;
                
                // Ajouter le gestionnaire pour ouvrir l'historique complet
                const fullHistoryBtn = historyContent.querySelector('#open-full-history-btn');
                if (fullHistoryBtn) {
                    fullHistoryBtn.addEventListener('click', () => {
                        if (window.objectivesHistory) {
                            window.objectivesHistory.showHistory();
                        }
                    });
                }
            }
        } catch (error) {
            console.error('Error loading history content:', error);
            historyContent.innerHTML = '<p style="color: #dc3545;">Erreur lors du chargement de l\'historique.</p>';
        }
    }

    /**
     * Met à jour l'état des boutons
     */
    updateButtons() {
        const previousBtn = this.panel.querySelector('.objectives-previous-btn');
        const nextBtn = this.panel.querySelector('.objectives-next-btn');
        const skipBtn = this.panel.querySelector('.objectives-skip-btn');

        // Cacher tous les boutons sauf "Fermer"
        if (previousBtn) {
            previousBtn.style.display = 'none';
        }
        if (nextBtn) {
            nextBtn.style.display = 'none';
        }
        if (skipBtn) {
            skipBtn.style.display = 'none';
        }
    }

    /**
     * Ajoute une étape personnalisée
     */
    addStep(title, content) {
        this.steps.push({ title, content });
    }

    /**
     * Définit les étapes du tutoriel
     */
    setSteps(steps) {
        this.steps = steps;
        this.currentStep = 0;
    }

    /**
     * Vérifie si le tutoriel est visible
     */
    isObjectivesVisible() {
        return this.isVisible;
    }

    /**
     * Récupère l'étape actuelle
     */
    getCurrentStep() {
        return this.currentStep;
    }

    /**
     * Récupère le nombre total d'étapes
     */
    getTotalSteps() {
        return this.steps.length;
    }

    /**
     * Nettoie les ressources (à appeler en cas d'erreur ou de destruction)
     */
    cleanup() {
        this.eventBlocker.cleanup();
    }
}

// Créer une instance globale
const tutorialManager = new ObjectivesManager();

// Exposer globalement pour les tests
window.tutorialManager = tutorialManager;

// Fonction utilitaire pour démarrer les objectifs
window.startObjectives = async () => {
    await tutorialManager.showObjectives();
};

// Fonction utilitaire pour fermer le tutoriel
window.closeObjectives = () => {
    tutorialManager.closeObjectives();
};

// Vérifier que le bouton objectives existe et ajouter un event listener direct
document.addEventListener('DOMContentLoaded', () => {
    const objectivesBtn = document.getElementById('objectives-btn');
    if (objectivesBtn) {
        // Supprimer tous les event listeners existants
        const newBtn = objectivesBtn.cloneNode(true);
        objectivesBtn.parentNode.replaceChild(newBtn, objectivesBtn);
        
        // Ajouter notre gestionnaire avec capture pour intercepter avant les autres
        newBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            if (window.startObjectives) {
                await window.startObjectives();
            }
        }, true); // true = capture phase
    }
});

// Gestion d'erreur globale pour s'assurer que les événements Three.js sont réactivés
window.addEventListener('error', (e) => {
    if (window.tutorialManager && window.tutorialManager.eventBlocker.isEventsBlocked()) {
        window.tutorialManager.cleanup();
    }
});

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (window.tutorialManager) {
        window.tutorialManager.cleanup();
    }
});

