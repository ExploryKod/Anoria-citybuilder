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
    init() {
        if (this.isInitialized) return;
        
        // Attendre que le DOM soit chargé
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }
        
        this.panel = document.getElementById('objectives-panel');
        if (!this.panel) {
            console.error('Objectives panel not found in DOM');
            return;
        }

        this.setupEventListeners();
        this.setupDefaultSteps();
        this.isInitialized = true;
        
        console.log('Objectives system initialized');
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
     * Configure les étapes par défaut (objectifs)
     */
    async setupDefaultSteps() {
        // Charger les objectifs depuis le tracker
        if (window.objectivesTracker) {
            const objectives = window.objectivesTracker.objectives;
            this.steps = await Promise.all(objectives.map(async obj => ({
                title: obj.title,
                content: await this.createObjectiveContent(obj)
            })));
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
            html += '<ul style="margin: 0; padding-left: 20px; color: var(--primary);">';
            
            objective.requirements.forEach((req, index) => {
                const status = req.value === true ? '✅' : req.value === false ? '❌' : '⏳';
                const color = req.value === true ? '#28a745' : req.value === false ? '#dc3545' : '#ffc107';
                html += `<li style="margin-bottom: 6px;">
                    <span style="color: ${color}; margin-right: 8px;">${status}</span>
                    <span>${req.text}</span>
                </li>`;
            });
            
            html += '</ul>';
            html += '</div>';
        }

        // Afficher les données de tracking si disponible
        if (window.objectivesTracker) {
            const trackingData = window.objectivesTracker.getTrackingData();
            html += `<div style="background: rgba(251, 129, 34, 0.05); border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid rgba(251, 129, 34, 0.2);">`;
            html += '<strong style="color: var(--cta); display: block; margin-bottom: 8px;">État actuel (depuis les comptes de résultat) :</strong>';
            
            if (trackingData.currentDay !== undefined) {
                html += `<p style="margin: 4px 0; color: var(--primary);"><strong>Tour actuel :</strong> ${trackingData.currentDay}</p>`;
            }
            if (trackingData.minNetFlow !== Infinity) {
                const isValid = trackingData.minNetFlow >= -20;
                const statusColor = isValid ? '#28a745' : '#dc3545';
                const statusIcon = isValid ? '✅' : '❌';
                const turnInfo = trackingData.minNetFlowTurn !== null ? ` (tour ${trackingData.minNetFlowTurn})` : '';
                html += `<p style="margin: 4px 0; color: var(--primary);">
                    <strong>Flux net minimum :</strong> 
                    <span style="color: ${statusColor};">${trackingData.minNetFlow}€${turnInfo}</span>
                    ${statusIcon}
                </p>`;
            }
            if (trackingData.maxNetFlow !== -Infinity) {
                const isValid = trackingData.maxNetFlow >= 100;
                const statusColor = isValid ? '#28a745' : '#dc3545';
                const statusIcon = isValid ? '✅' : '❌';
                const turnInfo = trackingData.maxNetFlowTurn !== null ? ` (tour ${trackingData.maxNetFlowTurn})` : '';
                html += `<p style="margin: 4px 0; color: var(--primary);">
                    <strong>Flux net maximum :</strong> 
                    <span style="color: ${statusColor};">${trackingData.maxNetFlow}€${turnInfo}</span>
                    ${statusIcon}
                </p>`;
            }
            if (trackingData.fundsAtDay60 !== null) {
                const isValid = trackingData.fundsAtDay60 >= 600;
                const statusColor = isValid ? '#28a745' : '#dc3545';
                const statusIcon = isValid ? '✅' : '❌';
                html += `<p style="margin: 4px 0; color: var(--primary);">
                    <strong>Fonds au 60e tour :</strong> 
                    <span style="color: ${statusColor};">${trackingData.fundsAtDay60}€ (tour 60)</span>
                    ${statusIcon}
                </p>`;
            }
            
            html += '</div>';
            
            // Afficher les informations sur les états de budget
            html += `<div style="background: rgba(251, 129, 34, 0.03); border-radius: 8px; padding: 12px; margin-top: 12px; border: 1px solid rgba(251, 129, 34, 0.1);">`;
            html += '<strong style="color: var(--cta); display: block; margin-bottom: 8px; font-size: 0.9em;">ℹ️</strong>';
            html += '<p style="margin: 0; color: var(--primary); font-size: 0.85em; line-height: 1.4;">Données issues des <strong>comptes de résultat</strong> (tous les 3 tours) dans "États Budgets".</p>';
            
            // Aide pour retrouver le compte de résultat concerné en cas d'échec
            const failedTurns = [];
            if (trackingData.minNetFlow !== Infinity && trackingData.minNetFlow < -20) {
                failedTurns.push(trackingData.minNetFlowTurn);
            }
            if (trackingData.maxNetFlow !== -Infinity && trackingData.maxNetFlow < 100) {
                failedTurns.push(trackingData.maxNetFlowTurn);
            }
            if (trackingData.fundsAtDay60 !== null && trackingData.fundsAtDay60 < 600 && trackingData.currentDay >= 60) {
                failedTurns.push(60);
            }
            
            if (failedTurns.length > 0) {
                const uniqueTurns = [...new Set(failedTurns)].sort((a, b) => a - b);
                html += `<p style="margin: 8px 0 0 0; color: var(--primary); font-size: 0.85em; line-height: 1.4;">`;
                html += `<strong style="color: var(--cta);">💡</strong> `;
                html += `Consult <strong>"États Budgets"</strong> aux tours ${uniqueTurns.join(', ')} pour analyser la situation.`;
                html += `</p>`;
            }
            
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
                console.log(`Three.js event blocked: ${eventType}`);
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
            console.log('Game paused for objectives');
        } else {
            console.warn('Game object not available for pausing');
        }
        
        console.log('Objectives shown');
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
            console.log('Game resumed after tutorial');
        } else {
            console.warn('Game object not available for resuming');
        }
        
        console.log('Objectives hidden');
    }

    /**
     * Ferme le tutoriel
     */
    closeObjectives() {
        this.hideObjectives();
        console.log('Objectives closed');
    }

    /**
     * Passe à l'étape suivante
     */
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.updateDisplay();
        } else {
            // Dernière étape - fermer le tutoriel
            this.closeObjectives();
        }
    }

    /**
     * Revient à l'étape précédente
     */
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.updateDisplay();
        }
    }

    /**
     * Passe le tutoriel
     */
    skipObjectives() {
        this.closeObjectives();
        console.log('Objectives skipped');
    }

    /**
     * Met à jour l'affichage de l'étape actuelle
     */
    async updateDisplay() {
        const step = this.steps[this.currentStep];
        if (!step) return;

        // Mettre à jour le titre
        const header = this.panel.querySelector('.objectives-panel-header h3');
        if (header) {
            header.textContent = step.title;
        }

        // Mettre à jour le contenu (de manière asynchrone si nécessaire)
        const content = this.panel.querySelector('.objectives-content');
        if (content) {
            if (typeof step.content === 'function') {
                content.innerHTML = await step.content();
            } else {
                content.innerHTML = step.content;
            }
        }

        // Mettre à jour les boutons
        this.updateButtons();
    }

    /**
     * Met à jour l'état des boutons
     */
    updateButtons() {
        const previousBtn = this.panel.querySelector('.objectives-previous-btn');
        const nextBtn = this.panel.querySelector('.objectives-next-btn');
        const skipBtn = this.panel.querySelector('.objectives-skip-btn');

        // Bouton précédent
        if (previousBtn) {
            previousBtn.style.display = this.currentStep > 0 ? 'block' : 'none';
        }

        // Bouton suivant
        if (nextBtn) {
            if (this.currentStep === this.steps.length - 1) {
                nextBtn.textContent = 'Terminer';
            } else {
                nextBtn.textContent = 'Suivant';
            }
        }

        // Bouton passer (toujours visible sauf à la dernière étape)
        if (skipBtn) {
            skipBtn.style.display = this.currentStep === this.steps.length - 1 ? 'none' : 'block';
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
        console.log('Objectives cleanup completed');
    }
}

// Créer une instance globale
const tutorialManager = new ObjectivesManager();

// Exposer globalement pour les tests
window.tutorialManager = tutorialManager;

// Fonction utilitaire pour démarrer les objectifs
window.startObjectives = async () => {
    console.log('startObjectives called');
    await tutorialManager.showObjectives();
};

// Fonction utilitaire pour fermer le tutoriel
window.closeObjectives = () => {
    console.log('closeObjectives called');
    tutorialManager.closeObjectives();
};

// Vérifier que le bouton objectives existe et ajouter un event listener direct
document.addEventListener('DOMContentLoaded', () => {
    const objectivesBtn = document.getElementById('objectives-btn');
    if (objectivesBtn) {
        console.log('Objectives button found, adding event listener');
        
        // Supprimer tous les event listeners existants
        const newBtn = objectivesBtn.cloneNode(true);
        objectivesBtn.parentNode.replaceChild(newBtn, objectivesBtn);
        
        // Ajouter notre gestionnaire avec capture pour intercepter avant les autres
        newBtn.addEventListener('click', async (e) => {
            console.log('Objectives button clicked');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            if (window.startObjectives) {
                await window.startObjectives();
            } else {
                console.error('startObjectives function not available');
            }
        }, true); // true = capture phase
        
    } else {
        console.error('Objectives button not found');
    }
});

// Gestion d'erreur globale pour s'assurer que les événements Three.js sont réactivés
window.addEventListener('error', (e) => {
    if (window.tutorialManager && window.tutorialManager.eventBlocker.isEventsBlocked()) {
        console.warn('Error detected while tutorial is open, cleaning up Three.js events');
        window.tutorialManager.cleanup();
    }
});

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
    if (window.tutorialManager) {
        window.tutorialManager.cleanup();
    }
});

console.log('Objectives system loaded. Use window.startObjectives() to begin.');
