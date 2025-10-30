/**
 * Système de Tutoriel - Anoria City Builder
 * Gère l'affichage et la logique de la popup de tutoriel
 */

class TutorialManager {
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
            console.error('Tutorial panel not found in DOM');
            return;
        }

        this.setupEventListeners();
        this.setupDefaultSteps();
        this.isInitialized = true;

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
            skipBtn.addEventListener('click', () => this.skipTutorial());
        }

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeTutorial());
        }

        // Fermer avec Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.closeTutorial();
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
            onBlock: (eventType, e) => {}
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
    showTutorial() {
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
        } else {
            console.warn('Game object not available for pausing');
        }

    }

    /**
     * Cache le tutoriel
     */
    hideTutorial() {
        this.panel.classList.remove('visible');
        this.isVisible = false;
        
        // Réactiver les événements Three.js
        this.enableThreeJSEvents();
        
        // Reprendre le jeu
        if (window.game && typeof window.game.play === 'function') {
            window.game.play();
        } else {
            console.warn('Game object not available for resuming');
        }

    }

    /**
     * Ferme le tutoriel
     */
    closeTutorial() {
        this.hideTutorial();
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
            this.closeTutorial();
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
    skipTutorial() {
        this.closeTutorial();
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
    isTutorialVisible() {
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
const tutorialManager = new TutorialManager();

// Exposer globalement pour les tests
window.tutorialManager = tutorialManager;
// Also register with AppRegistry if available
if (window.app && window.app.register) {
    window.app.register('tutorialManager', tutorialManager);
}

// Fonction utilitaire pour démarrer le tutoriel
window.startTutorial = () => {
    tutorialManager.showTutorial();
};

// Fonction utilitaire pour fermer le tutoriel
window.closeTutorial = () => {
    tutorialManager.closeTutorial();
};

// Vérifier que le bouton tutoriel existe et ajouter un event listener direct
document.addEventListener('DOMContentLoaded', () => {
    const tutorialBtn = document.getElementById('tutorial-btn');
    if (tutorialBtn) {
        
        // Supprimer tous les event listeners existants
        const newBtn = tutorialBtn.cloneNode(true);
        tutorialBtn.parentNode.replaceChild(newBtn, tutorialBtn);
        
        // Ajouter notre gestionnaire avec capture pour intercepter avant les autres
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            if (window.startTutorial) {
                window.startTutorial();
            } else {
                console.error('startTutorial function not available');
            }
        }, true); // true = capture phase
        
    } else {
        console.error('Tutorial button not found');
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

