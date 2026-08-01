/**
 * Système de Tutoriel - Anoria City Builder
 * Gère l'affichage et la logique de la popup de tutoriel
 */
import {
    pauseGame,
    playGame,
    registerAppService,
    registerAppFunction,
    getTutorialManager,
    invokeStartTutorial,
} from '../acl/appRuntime.js';
import EventBlocker from '../utils/EventBlocker.js';

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
        const closeBtn = this.panel.querySelector('.tutorial-close-btn');

        if (previousBtn) {
            previousBtn.addEventListener('click', () => this.previousStep());
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => this.nextStep());
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
                title: 'Bienvenue à Eraanurbs',
                content: `
                    <p>Tante Laminoria est décédée et vous lègue son domaine. Vous recevez un lopin de terre sans rien. Mais vous avez décidé d'y construire un hameau prospère !</p>
                    <p>Cette tante qui vous fit si peur que vous la compariez à Era, femme de Zeus... d'où le nom que vous choisissez en sa mémoire : <strong>Eraanurbs</strong>.</p>
                    <p>Vous avez demandé <strong>200 euros</strong> à un "ami" peu recommandable... qui vous les a accordés. Il espère peut-être y gagner quelque chose.</p>
                    <p>Mais pour cette première étape de votre aventure chez feu Tante Laminoria, vous êtes plein d'enthousiasme pour y construire un hameau prospère.</p>
                `
            },
            {
                title: 'Système Ferme / Marché',
                content: `
                    <p>Chaque ferme ne peut produire qu'au <strong>printemps</strong> et en <strong>été</strong> et ne peut vendre ses stocks qu'en <strong>automne</strong> si un marché n'est pas loin.</p>
                    <p>Chaque marché n'achète qu'en <strong>automne</strong> et ne vend qu'aux maisons voisines en <strong>printemps</strong>, <strong>été</strong>, <strong>hiver</strong> tant qu'il possède des stocks.</p>
                `
            },
            {
                title: 'Maisons',
                content: `
                    <p>Chaque maison achète des stocks au marché et peut accueillir des citoyens uniquement tant qu'elle a des stocks.</p>
                    <p>À partir de <strong>6 paniers</strong>, la maison devient plus riche.</p>
                `
            },
            {
                title: 'Citoyens',
                content: `
                    <p>Chaque citoyen va payer des impôts pour renflouer vos fonds et il y aura autant de citoyens qu'il n'y a de stocks de nourriture dans les maisons.</p>
                    <p>Les impôts sont collectés uniquement en <strong>novembre</strong> : chaque citoyen paie <strong>100€</strong> à cette période.</p>
                    <p>Chaque bâtiment doit accéder à une route.</p>
                `
            },
            {
                title: 'Coûts d\'achat',
                content: `
                    <p>Chaque bâtiment a un coût d\'achat initial (immobilisation) :</p>
                    <p><strong>Routes</strong> : 5€</p>
                    <p><strong>Maisons</strong> : 10€ (20€ pour les maisons à étage)</p>
                    <p><strong>Fermes</strong> : 10€ (blé), 20€ (carotte), 30€ (chou)</p>
                    <p><strong>Marchés</strong> : 10€</p>
                    <p><strong>Infrastructure</strong> : 5€ (lampadaire), 15€ (puits), 25€ (fontaine)</p>
                    <p><strong>Industrie</strong> : 40€ (grange), 50€ (moulin)</p>
                    <p>Ces coûts sont déduits de vos fonds au moment de la construction.</p>
                `
            },
            {
                title: 'Coûts de maintenance',
                content: `
                    <p>Chaque bâtiment que vous construisez coûte <strong>2€ de maintenance</strong> par mois pour son entretien.</p>
                    <p><strong>Coûts de maintenance :</strong></p>
                    <p><strong>Maisons</strong> : 2€/mois</p>
                    <p><strong>Fermes</strong> : 2€/mois</p>
                    <p><strong>Marchés</strong> : 2€/mois</p>
                    <p><strong>Routes</strong> : 2€/mois</p>
                    <p><strong>Infrastructure</strong> (puits, fontaines, lampadaires) : 2€/mois</p>
                    <p><strong>Industrie</strong> (moulins, granges) : 2€/mois</p>
                    <p>Ces dépenses sont déduites automatiquement chaque mois de vos fonds. Surveillez bien votre budget pour éviter la faillite !</p>
                `
            },
            {
                title: 'Objectifs',
                content: `
                    <p>Vous avez des objectifs à atteindre si cette fonction est activée.</p>
                    <p><strong>Conseil :</strong> Commencez par une seule maison, une seule ferme, une seule route le plus vite possible pour éviter de perdre de l'argent dès le départ et essayer d'atteindre l'objectif.</p>
                    <p>Vous n'êtes pas à l'abri des événements imprévisibles comme les récessions économiques, les tempêtes, la sécheresse, les inondations...</p>
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
        pauseGame();

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
        playGame();

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

registerAppService('tutorialManager', tutorialManager);

registerAppFunction('startTutorial', () => {
    tutorialManager.showTutorial();
});

registerAppFunction('closeTutorial', () => {
    tutorialManager.closeTutorial();
});

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
            
            invokeStartTutorial();
        }, true); // true = capture phase
        
    } else {
        console.error('Tutorial button not found');
    }
});

// Gestion d'erreur globale pour s'assurer que les événements Three.js sont réactivés
window.addEventListener('error', (e) => {
    const tutorialManagerRef = getTutorialManager();
    if (tutorialManagerRef && tutorialManagerRef.eventBlocker.isEventsBlocked()) {
        console.warn('Error detected while tutorial is open, cleaning up Three.js events');
        tutorialManagerRef.cleanup();
    }
});

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
    getTutorialManager()?.cleanup();
});

