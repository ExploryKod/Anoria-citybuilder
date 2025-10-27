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
        
        this.panel = document.getElementById('tutorial-panel');
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
        const previousBtn = this.panel.querySelector('.tutorial-previous-btn');
        const nextBtn = this.panel.querySelector('.tutorial-next-btn');
        const skipBtn = this.panel.querySelector('.tutorial-skip-btn');
        const closeBtn = this.panel.querySelector('.tutorial-close-btn');

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
     * Configure les étapes par défaut
     */
    setupDefaultSteps() {
        this.steps = [
            {
                title: 'Bienvenue dans Anoria',
                content: `
                    <p>Bienvenue dans <strong>Anoria City Builder</strong> !</p>
                    <p>Dans ce tutoriel, vous apprendrez les bases pour créer une ville prospère.</p>
                    <p>Vous commencez avec <strong>200€</strong> pour construire votre première ville.</p>
                `
            },
            {
                title: 'Construire votre première maison',
                content: `
                    <p>Commençons par construire votre première maison !</p>
                    <p><strong>Étape 1 :</strong> Cliquez sur l'outil "Maison" dans la barre d'outils à gauche</p>
                    <p><strong>Étape 2 :</strong> Cliquez sur une case verte du terrain pour placer la maison</p>
                    <p>Les maisons coûtent <strong>50€</strong> chacune.</p>
                `
            },
            {
                title: 'Construire des routes',
                content: `
                    <p>Excellent ! Maintenant, construisons des routes pour connecter votre maison.</p>
                    <p><strong>Étape 1 :</strong> Sélectionnez l'outil "Routes"</p>
                    <p><strong>Étape 2 :</strong> Placez des routes autour de votre maison</p>
                    <p>Les routes permettent aux habitants d'accéder aux services.</p>
                `
            },
            {
                title: 'Construire une ferme',
                content: `
                    <p>Maintenant, construisons une ferme pour nourrir vos habitants !</p>
                    <p><strong>Étape 1 :</strong> Sélectionnez l'outil "Fermes"</p>
                    <p><strong>Étape 2 :</strong> Placez une ferme près de votre maison</p>
                    <p>Les fermes produisent de la nourriture pour vos habitants.</p>
                `
            },
            {
                title: 'Félicitations !',
                content: `
                    <p><strong>Bravo !</strong> Vous avez créé votre première ville !</p>
                    <p>Vous avez appris à :</p>
                    <ul>
                        <li>Construire des maisons</li>
                        <li>Créer des routes</li>
                        <li>Installer des fermes</li>
                    </ul>
                    <p>Votre ville va maintenant se développer automatiquement. Bonne chance !</p>
                `
            }
        ];
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
     * Affiche le tutoriel
     */
    showObjectives() {
        if (!this.isInitialized) {
            this.init();
        }

        this.currentStep = 0;
        this.updateDisplay();
        this.panel.classList.add('visible');
        this.isVisible = true;
        
        // Désactiver les événements Three.js
        this.disableThreeJSEvents();
        
        // Mettre le jeu en pause
        if (window.game && typeof window.game.pause === 'function') {
            window.game.pause();
            console.log('Game paused for tutorial');
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
    updateDisplay() {
        const step = this.steps[this.currentStep];
        if (!step) return;

        // Mettre à jour le titre
        const header = this.panel.querySelector('.tutorial-panel-header h3');
        if (header) {
            header.textContent = step.title;
        }

        // Mettre à jour le contenu
        const content = this.panel.querySelector('.tutorial-content');
        if (content) {
            content.innerHTML = step.content;
        }

        // Mettre à jour les boutons
        this.updateButtons();
    }

    /**
     * Met à jour l'état des boutons
     */
    updateButtons() {
        const previousBtn = this.panel.querySelector('.tutorial-previous-btn');
        const nextBtn = this.panel.querySelector('.tutorial-next-btn');
        const skipBtn = this.panel.querySelector('.tutorial-skip-btn');

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

// Fonction utilitaire pour démarrer le tutoriel
window.startObjectives = () => {
    console.log('startObjectives called');
    tutorialManager.showObjectives();
};

// Fonction utilitaire pour fermer le tutoriel
window.closeObjectives = () => {
    console.log('closeObjectives called');
    tutorialManager.closeObjectives();
};

// Vérifier que le bouton tutoriel existe et ajouter un event listener direct
document.addEventListener('DOMContentLoaded', () => {
    const tutorialBtn = document.getElementById('tutorial-btn');
    if (tutorialBtn) {
        console.log('Objectives button found, adding event listener');
        
        // Supprimer tous les event listeners existants
        const newBtn = tutorialBtn.cloneNode(true);
        tutorialBtn.parentNode.replaceChild(newBtn, tutorialBtn);
        
        // Ajouter notre gestionnaire avec capture pour intercepter avant les autres
        newBtn.addEventListener('click', (e) => {
            console.log('Objectives button clicked');
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            if (window.startObjectives) {
                window.startObjectives();
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
