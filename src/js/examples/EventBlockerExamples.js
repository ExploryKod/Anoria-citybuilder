/**
 * Exemples d'utilisation d'EventBlocker par composition
 */

// Exemple 1: Modal avec blocage d'événements
class ModalManager {
    constructor() {
        this.eventBlocker = new EventBlocker();
        this.isOpen = false;
    }

    openModal() {
        this.isOpen = true;
        // Bloquer les événements de jeu pendant que la modal est ouverte
        this.eventBlocker.blockGameEvents({
            onBlock: (eventType, e) => {
                console.log(`Game event blocked by modal: ${eventType}`);
            }
        });
    }

    closeModal() {
        this.isOpen = false;
        // Réactiver les événements
        this.eventBlocker.unblockEvents();
    }

    cleanup() {
        this.eventBlocker.cleanup();
    }
}

// Exemple 2: Système de pause avec blocage d'événements
class GamePauseManager {
    constructor() {
        this.eventBlocker = new EventBlocker();
        this.isPaused = false;
    }

    pauseGame() {
        this.isPaused = true;
        // Bloquer tous les événements de jeu
        this.eventBlocker.blockGameEvents({
            canvasSelectors: ['canvas', '.game-area'],
            onBlock: (eventType, e) => {
                console.log(`Game paused - event blocked: ${eventType}`);
            }
        });
    }

    resumeGame() {
        this.isPaused = false;
        // Réactiver les événements
        this.eventBlocker.unblockEvents();
    }

    cleanup() {
        this.eventBlocker.cleanup();
    }
}

// Exemple 3: Système de formulaire avec blocage d'événements
class FormManager {
    constructor() {
        this.eventBlocker = new EventBlocker();
        this.isEditing = false;
    }

    startEditing() {
        this.isEditing = true;
        // Bloquer les événements de formulaire pour éviter les soumissions accidentelles
        this.eventBlocker.blockFormEvents({
            onBlock: (eventType, e) => {
                console.log(`Form event blocked during editing: ${eventType}`);
            }
        });
    }

    stopEditing() {
        this.isEditing = false;
        // Réactiver les événements
        this.eventBlocker.unblockEvents();
    }

    cleanup() {
        this.eventBlocker.cleanup();
    }
}

// Exemple 4: Utilisation avec gestion d'erreur automatique
class SafeEventBlocker {
    constructor() {
        // Créer une instance avec gestion d'erreur automatique
        this.eventBlocker = EventBlocker.createWithErrorHandling();
    }

    blockEvents(events, options) {
        this.eventBlocker.blockEvents(events, options);
    }

    unblockEvents() {
        this.eventBlocker.unblockEvents();
    }

    cleanup() {
        // Nettoyer l'EventBlocker et supprimer les listeners globaux
        this.eventBlocker.cleanup();
        if (this.eventBlocker.removeGlobalListeners) {
            this.eventBlocker.removeGlobalListeners();
        }
    }
}

// Exemple d'utilisation dans une classe existante
class ExistingClass {
    constructor() {
        // Ajouter EventBlocker par composition
        this.eventBlocker = new EventBlocker();
        this.someState = false;
    }

    doSomethingThatRequiresBlocking() {
        this.someState = true;
        
        // Bloquer les événements pendant cette opération
        this.eventBlocker.blockEvents(['mousedown', 'mouseup'], {
            onBlock: (eventType, e) => {
                console.log(`Event blocked during operation: ${eventType}`);
            }
        });
    }

    finishOperation() {
        this.someState = false;
        
        // Réactiver les événements
        this.eventBlocker.unblockEvents();
    }

    // Méthode de nettoyage
    destroy() {
        this.eventBlocker.cleanup();
    }
}

// Exporter les exemples pour utilisation
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        ModalManager,
        GamePauseManager,
        FormManager,
        SafeEventBlocker,
        ExistingClass
    };
}

// Exposer globalement pour les tests
window.ModalManager = ModalManager;
window.GamePauseManager = GamePauseManager;
window.FormManager = FormManager;
window.SafeEventBlocker = SafeEventBlocker;
window.ExistingClass = ExistingClass;
