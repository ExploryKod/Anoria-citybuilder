import { registerAppService } from '../acl/appRuntime.js';

/**
 * EventBlocker - Utilitaire pour bloquer les événements DOM
 * Peut être utilisé par composition dans n'importe quelle classe
 */
class EventBlocker {
    constructor() {
        this.isBlocked = false;
        this.blockedEvents = [];
        this.originalEventListeners = [];
        this.blockedElements = [];
    }

    /**
     * Bloque les événements spécifiés sur le document
     * @param {string[]} events - Liste des types d'événements à bloquer
     * @param {Object} options - Options de blocage
     * @param {boolean} options.blockCanvas - Bloquer aussi les événements sur les canvas
     * @param {string[]} options.canvasSelectors - Sélecteurs CSS pour les canvas à bloquer
     * @param {Function} options.onBlock - Callback appelé quand un événement est bloqué
     */
    blockEvents(events = ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'], options = {}) {
        if (this.isBlocked) {
            console.warn('Events are already blocked');
            return;
        }

        const {
            blockCanvas = true,
            canvasSelectors = ['canvas'],
            onBlock = null,
            excludeSelectors = []
        } = options;

        this.blockedEvents = [...events];
        this.originalEventListeners = [];
        this.excludeSelectors = excludeSelectors;

        // Bloquer les événements sur le document
        events.forEach(eventType => {
            const blocker = (e) => {
                // Vérifier si l'élément cible est dans les exclusions
                if (this.excludeSelectors && this.excludeSelectors.length > 0) {
                    const target = e.target;
                    if (target) {
                        for (const selector of this.excludeSelectors) {
                            try {
                                if (target.matches && target.matches(selector)) {
                                    return; // Ne pas bloquer cet événement
                                }
                                // Vérifier aussi si un parent correspond
                                if (target.closest && target.closest(selector)) {
                                    return; // Ne pas bloquer cet événement
                                }
                            } catch (err) {
                                // Ignorer les erreurs de sélecteur invalide
                            }
                        }
                    }
                }
                
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                
                if (onBlock) {
                    onBlock(eventType, e);
                } else {
                }
                
                return false;
            };

            document.addEventListener(eventType, blocker, true);
            this.originalEventListeners.push({ type: eventType, handler: blocker });
        });

        // Bloquer les événements sur les canvas si demandé
        if (blockCanvas) {
            canvasSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.style.pointerEvents !== 'none') {
                        element.style.pointerEvents = 'none';
                        this.blockedElements.push(element);
                    }
                });
            });
        }

        this.isBlocked = true;
    }

    /**
     * Débloque tous les événements précédemment bloqués
     */
    unblockEvents() {
        if (!this.isBlocked) {
            console.warn('No events are currently blocked');
            return;
        }

        // Supprimer les blockers d'événements
        this.originalEventListeners.forEach(({ type, handler }) => {
            document.removeEventListener(type, handler, true);
        });

        // Réactiver les événements sur les éléments bloqués
        this.blockedElements.forEach(element => {
            element.style.pointerEvents = 'auto';
        });

        // Réinitialiser l'état
        this.originalEventListeners = [];
        this.blockedElements = [];
        this.blockedEvents = [];
        this.isBlocked = false;

    }

    /**
     * Vérifie si les événements sont actuellement bloqués
     */
    isEventsBlocked() {
        return this.isBlocked;
    }

    /**
     * Récupère la liste des événements bloqués
     */
    getBlockedEvents() {
        return [...this.blockedEvents];
    }

    /**
     * Bloque spécifiquement les événements Three.js
     * Méthode de convenance pour les applications Three.js
     */
    blockThreeJSEvents(options = {}) {
        const threeJSEvents = ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'];
        const threeJSOptions = {
            blockCanvas: true,
            canvasSelectors: ['canvas'],
            onBlock: (eventType, e) => {
            },
            ...options
        };

        this.blockEvents(threeJSEvents, threeJSOptions);
    }

    /**
     * Bloque les événements de jeu (pour les jeux en général)
     * Méthode de convenance pour les applications de jeu
     */
    blockGameEvents(options = {}) {
        const gameEvents = ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup', 'contextmenu'];
        const gameOptions = {
            blockCanvas: true,
            canvasSelectors: ['canvas', '.game-area', '.game-canvas'],
            onBlock: (eventType, e) => {
            },
            ...options
        };

        this.blockEvents(gameEvents, gameOptions);
    }

    /**
     * Bloque les événements de formulaire
     * Méthode de convenance pour les formulaires
     */
    blockFormEvents(options = {}) {
        const formEvents = ['submit', 'reset', 'change', 'input'];
        const formOptions = {
            blockCanvas: false,
            onBlock: (eventType, e) => {
            },
            ...options
        };

        this.blockEvents(formEvents, formOptions);
    }

    /**
     * Nettoie toutes les ressources (à appeler en cas d'erreur ou de destruction)
     */
    cleanup() {
        if (this.isBlocked) {
            this.unblockEvents();
        }
    }

    /**
     * Crée une instance avec gestion automatique des erreurs
     * @param {Object} options - Options pour l'instance
     * @returns {EventBlocker} - Instance avec gestion d'erreur automatique
     */
    static createWithErrorHandling(options = {}) {
        const blocker = new EventBlocker();
        
        // Gestion d'erreur globale
        const errorHandler = (e) => {
            if (blocker.isEventsBlocked()) {
                console.warn('Error detected while events are blocked, cleaning up');
                blocker.cleanup();
            }
        };

        // Nettoyage lors de la fermeture de la page
        const cleanupHandler = () => {
            blocker.cleanup();
        };

        window.addEventListener('error', errorHandler);
        window.addEventListener('beforeunload', cleanupHandler);

        // Ajouter une méthode pour supprimer les listeners globaux
        blocker.removeGlobalListeners = () => {
            window.removeEventListener('error', errorHandler);
            window.removeEventListener('beforeunload', cleanupHandler);
        };

        return blocker;
    }
}

// Exporter pour utilisation dans d'autres modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBlocker;
}

registerAppService('EventBlocker', EventBlocker);

export default EventBlocker;
