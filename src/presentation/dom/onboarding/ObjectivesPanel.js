/**
 * ObjectivesPanel — popup objectifs (DOM + événements).
 */
import EventBlocker from '../shell/EventBlocker.js';

class ObjectivesPanel {
    /**
     * @param {{
     *   accounting: object,
     *   pauseGame?: () => void,
     *   playGame?: () => void,
     *   getObjectivesTracker?: () => object | null,
     *   getObjectivesHistory?: () => object | null,
     *   getObjectivesManager?: () => object | null,
     *   invokeStartObjectives?: () => Promise<void> | void,
     *   registerAppService?: (name: string, instance: *) => void,
     *   registerAppFunction?: (name: string, fn: Function) => void,
     * }} deps
     */
    constructor(deps) {
        this.deps = deps;
        this.panel = null;
        this.currentStep = 0;
        this.steps = [];
        this.isVisible = false;
        this.isInitialized = false;
        this.eventBlocker = new EventBlocker();
    }

    async init() {
        if (this.isInitialized) return;
        if (typeof document === 'undefined') return;
        
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
        const objectivesTracker = this.deps.getObjectivesTracker?.();
        if (objectivesTracker) {
            const objectives = objectivesTracker.objectives;
            const activeObjectives = objectives.filter(obj => obj.active && !obj.completed);
            
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
        let html = `<p style="font-size: 15px; line-height: 1.6; margin-bottom: 20px;">${objective.description}</p>`;
        
        // Afficher les conditions de manière simplifiée
        if (objective.requirements && objective.requirements.length > 0) {
            html += '<div style="background: rgba(251, 129, 34, 0.1); border-radius: 8px; padding: 16px; margin-top: 16px;">';
            html += '<strong style="color: var(--cta); display: block; margin-bottom: 12px; font-size: 14px;">Condition :</strong>';
            
            objective.requirements.forEach((req, index) => {
                const status = req.value === true ? '✅' : '⏳';
                const color = req.value === true ? '#28a745' : '#ffc107';
                html += `<div style="display: flex; align-items: center; margin: 8px 0;">
                    <span style="color: ${color}; margin-right: 10px; flex-shrink: 0; font-size: 18px;">${status}</span>
                    <span style="text-align: left; font-size: 14px;">${req.text}</span>
                </div>`;
            });
            
            html += '</div>';
        }

        // Afficher l'état actuel de manière simplifiée
        const objectivesTracker = this.deps.getObjectivesTracker?.();
        if (objectivesTracker) {
            const trackingData = objectivesTracker.getTrackingData();
            
            html += `<div style="background: rgba(251, 129, 34, 0.05); border-radius: 8px; padding: 16px; margin-top: 16px; border: 1px solid rgba(251, 129, 34, 0.2);">`;
            html += '<strong style="color: var(--cta); display: block; margin-bottom: 12px; font-size: 14px;">État actuel :</strong>';
            
            // Afficher les fonds actuels
            const currentFunds = trackingData.currentFunds || 0;
            const targetFunds = 5000;
            const progress = Math.min(100, (currentFunds / targetFunds) * 100);
            const isCompleted = currentFunds >= targetFunds;
            
            html += `<div style="margin: 12px 0;">`;
            html += `<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">`;
            html += `<span style="color: var(--primary); font-size: 14px; font-weight: 600;">Fonds actuels :</span>`;
            html += `<span style="color: ${isCompleted ? '#28a745' : 'var(--primary)'}; font-size: 16px; font-weight: 700;">${currentFunds.toLocaleString('fr-FR')}€</span>`;
            html += `</div>`;
            
            // Barre de progression
            html += `<div style="background: rgba(0, 0, 0, 0.1); border-radius: 4px; height: 24px; overflow: hidden; position: relative;">`;
            html += `<div style="background: ${isCompleted ? 'linear-gradient(90deg, #28a745, #20c997)' : 'linear-gradient(90deg, var(--cta), #ff8c42)'}; height: 100%; width: ${progress}%; transition: width 0.3s ease; border-radius: 4px;"></div>`;
            html += `<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); color: ${progress > 50 ? 'white' : 'var(--primary)'}; font-size: 12px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,0.3);">${Math.round(progress)}%</div>`;
            html += `</div>`;
            
            html += `<div style="display: flex; justify-content: space-between; margin-top: 8px;">`;
            html += `<span style="color: var(--primary); font-size: 12px; opacity: 0.7;">0€</span>`;
            html += `<span style="color: var(--primary); font-size: 12px; opacity: 0.7;">${targetFunds.toLocaleString('fr-FR')}€</span>`;
            html += `</div>`;
            html += `</div>`;
            
            html += '</div>';
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
        this.deps.pauseGame?.();
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
        this.deps.playGame?.();
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
                    const objectivesHistory = this.deps.getObjectivesHistory?.();
                    if (objectivesHistory?.showHistory) {
                        objectivesHistory.showHistory();
                    } else {
                        console.warn('objectivesHistory not available');
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
            const allRecords = await this.deps.accounting.getObjectivesStore().getAllFailures();
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
                        const objectivesHistory = this.deps.getObjectivesHistory?.();
                        if (objectivesHistory) {
                            objectivesHistory.showHistory();
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


/**
 * @param {ConstructorParameters<typeof ObjectivesPanel>[0]} deps
 */
export function initObjectivesPanel(deps) {
  const objectivesPanel = new ObjectivesPanel(deps);
  void objectivesPanel.init();

  deps.registerAppService?.('objectivesManager', objectivesPanel);
  deps.registerAppFunction?.('startObjectives', async () => {
    await objectivesPanel.showObjectives();
  });
  deps.registerAppFunction?.('closeObjectives', () => {
    objectivesPanel.closeObjectives();
  });

  const objectivesBtn = document.getElementById('objectives-btn');
  if (objectivesBtn) {
    const newBtn = objectivesBtn.cloneNode(true);
    objectivesBtn.parentNode.replaceChild(newBtn, objectivesBtn);
    newBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      await deps.invokeStartObjectives?.();
    }, true);
  }

  window.addEventListener('error', () => {
    const objectivesManagerRef = deps.getObjectivesManager?.();
    if (objectivesManagerRef && objectivesManagerRef.eventBlocker.isEventsBlocked()) {
      objectivesManagerRef.cleanup();
    }
  });

  window.addEventListener('beforeunload', () => {
    deps.getObjectivesManager?.()?.cleanup();
  });

  return objectivesPanel;
}
