/**
 * PopupManager - Gestionnaire unifié pour toutes les popups
 * Utilise pointer-events CSS pour désactiver les interactions avec le canvas 3D
 */
class PopupManager {
    constructor() {
        this.activePopups = new Set();
        this.popupConfigs = new Map();
        
        this.setupPopupConfigs();
        this.setupGlobalEventListeners();
        
        // S'assurer que les événements ne sont pas bloqués au démarrage
        this.ensureEventsUnblocked();
    }

    /**
     * Configure les paramètres pour chaque popup
     */
    setupPopupConfigs() {
        // Popups qui nécessitent le blocage d'événements
        this.popupConfigs.set('pause-overlay', {
            shouldBlockEvents: true,
            shouldPauseGame: true,
            eventsToBlock: ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'],
            canvasSelectors: ['canvas'],
            onOpen: () => console.log('Pause overlay opened'),
            onClose: () => console.log('Pause overlay closed')
        });

        this.popupConfigs.set('realtime-budget-panel', {
            shouldBlockEvents: true,
            shouldPauseGame: false, // Le budget peut rester ouvert pendant le jeu
            eventsToBlock: ['mousedown', 'mouseup', 'mousemove'],
            canvasSelectors: ['canvas'],
            onOpen: () => console.log('Budget popup opened'),
            onClose: () => console.log('Budget popup closed')
        });

        this.popupConfigs.set('budget-states-panel', {
            shouldBlockEvents: true,
            shouldPauseGame: false,
            eventsToBlock: ['mousedown', 'mouseup', 'mousemove'],
            canvasSelectors: ['canvas'],
            onOpen: () => console.log('Budget states popup opened'),
            onClose: () => console.log('Budget states popup closed')
        });

        this.popupConfigs.set('info-building-overlay', {
            shouldBlockEvents: true,
            shouldPauseGame: true,
            eventsToBlock: ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'],
            canvasSelectors: ['canvas'],
            onOpen: () => console.log('Building info overlay opened'),
            onClose: () => console.log('Building info overlay closed')
        });

        this.popupConfigs.set('over-overlay', {
            shouldBlockEvents: true,
            shouldPauseGame: true,
            eventsToBlock: ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'],
            canvasSelectors: ['canvas'],
            onOpen: () => console.log('Game over overlay opened'),
            onClose: () => console.log('Game over overlay closed')
        });

        // Popups de sélection d'objets (ne pas bloquer les événements)
        this.popupConfigs.set('panel-layout', {
            shouldBlockEvents: false, // Cette popup permet la sélection d'objets
            shouldPauseGame: true,
            eventsToBlock: [],
            canvasSelectors: [],
            onOpen: () => console.log('Building selection panel opened'),
            onClose: () => console.log('Building selection panel closed')
        });

        this.popupConfigs.set('loans-panel', {
            shouldBlockEvents: true,
            shouldPauseGame: true,
            eventsToBlock: ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'],
            canvasSelectors: ['canvas'],
            onOpen: () => console.log('Loans panel opened'),
            onClose: () => console.log('Loans panel closed')
        });

        this.popupConfigs.set('budget-panel', {
            shouldBlockEvents: true,
            shouldPauseGame: true,
            eventsToBlock: ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'],
            canvasSelectors: ['canvas'],
            onOpen: () => console.log('Budget panel opened'),
            onClose: () => console.log('Budget panel closed')
        });
    }

    /**
     * Configure les event listeners globaux
     */
    setupGlobalEventListeners() {
        // Observer les changements de classe pour détecter l'ouverture/fermeture des popups
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    const element = mutation.target;
                    const popupId = this.getPopupId(element);
                    
                    if (popupId && this.popupConfigs.has(popupId)) {
                        if (this.isPopupOpen(element)) {
                            this.openPopup(popupId);
                        } else {
                            this.closePopup(popupId);
                        }
                    }
                }
            });
        });

        // Observer tous les éléments de popup
        this.popupConfigs.forEach((config, popupId) => {
            const element = document.getElementById(popupId);
            if (element) {
                observer.observe(element, { attributes: true, attributeFilter: ['class'] });
                console.log(`PopupManager: Observing ${popupId}`, element);
            } else {
                console.warn(`PopupManager: Element ${popupId} not found`);
            }
        });
    }

    /**
     * Détermine l'ID de popup à partir d'un élément
     */
    getPopupId(element) {
        if (!element || !element.id) return null;
        
        // Vérifier si c'est un élément de popup connu
        for (const popupId of this.popupConfigs.keys()) {
            if (element.id === popupId || element.closest(`#${popupId}`)) {
                return popupId;
            }
        }
        
        return null;
    }

    /**
     * Vérifie si une popup est ouverte
     */
    isPopupOpen(element) {
        return element.classList.contains('active') || 
               element.classList.contains('visible') ||
               element.classList.contains('show');
    }

    /**
     * Ouvre une popup avec gestion des événements
     */
    openPopup(popupId) {
        // Vérifier l'état réel du DOM plutôt que juste notre Set interne
        const element = document.getElementById(popupId);
        const isActuallyActive = element && element.classList.contains('active');
        
        if (this.activePopups.has(popupId) && isActuallyActive) {
            console.log(`PopupManager: ${popupId} already active, skipping`);
            return;
        }
        
        // Si le popup est actif dans le DOM mais pas dans notre Set, on le synchronise
        if (isActuallyActive && !this.activePopups.has(popupId)) {
            console.log(`PopupManager: ${popupId} is active in DOM but not in our Set, synchronizing`);
            this.activePopups.add(popupId);
            
            // Appliquer la configuration du popup
            const config = this.popupConfigs.get(popupId);
            if (config) {
                // Désactiver les pointer-events sur le canvas
                if (config.canvasSelectors && config.canvasSelectors.length > 0) {
                    config.canvasSelectors.forEach(selector => {
                        const elements = document.querySelectorAll(selector);
                        elements.forEach(element => {
                            if (!element.classList.contains('pointer-events-disabled')) {
                                element.classList.add('pointer-events-disabled');
                            }
                        });
                    });
                }
                if (config.shouldPauseGame && window.game && typeof window.game.pause === 'function') {
                    window.game.pause();
                }
                if (config.onOpen) {
                    config.onOpen();
                }
            }
            return;
        }

        const config = this.popupConfigs.get(popupId);
        if (!config) {
            console.warn(`PopupManager: No config found for ${popupId}`);
            return;
        }

        console.log(`PopupManager: Opening ${popupId} with config:`, config);
        this.activePopups.add(popupId);

        // Désactiver les pointer-events sur le canvas
        if (config.canvasSelectors && config.canvasSelectors.length > 0) {
            config.canvasSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (!element.classList.contains('pointer-events-disabled')) {
                        element.classList.add('pointer-events-disabled');
                        console.log(`Added pointer-events-disabled to ${selector}`);
                    }
                });
            });
        }

        // Mettre le jeu en pause si nécessaire
        if (config.shouldPauseGame && window.game && typeof window.game.pause === 'function') {
            window.game.pause();
            console.log(`Game paused for ${popupId}`);
        }

        // Callback d'ouverture
        if (config.onOpen) {
            config.onOpen();
        }

        console.log(`Popup opened: ${popupId}`);
    }

    /**
     * Ferme une popup avec gestion des événements
     */
    closePopup(popupId) {
        if (!this.activePopups.has(popupId)) return;

        const config = this.popupConfigs.get(popupId);
        if (!config) return;

        this.activePopups.delete(popupId);

        // Réactiver les pointer-events sur le canvas
        if (config.canvasSelectors && config.canvasSelectors.length > 0) {
            config.canvasSelectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(element => {
                    if (element.classList.contains('pointer-events-disabled')) {
                        element.classList.remove('pointer-events-disabled');
                        console.log(`Removed pointer-events-disabled from ${selector}`);
                    }
                });
            });
        }

        // Reprendre le jeu si nécessaire
        if (config.shouldPauseGame && window.game && typeof window.game.play === 'function') {
            // Vérifier s'il y a d'autres popups actives qui nécessitent la pause
            const hasOtherPausingPopups = Array.from(this.activePopups).some(id => {
                const otherConfig = this.popupConfigs.get(id);
                return otherConfig && otherConfig.shouldPauseGame;
            });

            if (!hasOtherPausingPopups) {
                window.game.play();
                console.log(`Game resumed after ${popupId}`);
            }
        }

        // Callback de fermeture
        if (config.onClose) {
            config.onClose();
        }

        console.log(`Popup closed: ${popupId}`);
    }

    /**
     * Force l'ouverture d'une popup (pour les cas où l'observer ne détecte pas)
     */
    forceOpenPopup(popupId) {
        console.log(`PopupManager: Force opening ${popupId}`);
        this.openPopup(popupId);
    }

    /**
     * Force la fermeture d'une popup (pour les cas où l'observer ne détecte pas)
     */
    forceClosePopup(popupId) {
        console.log(`PopupManager: Force closing ${popupId}`);
        this.closePopup(popupId);
    }

    /**
     * Ferme toutes les popups actives
     */
    closeAllPopups() {
        const activePopups = Array.from(this.activePopups);
        activePopups.forEach(popupId => {
            this.closePopup(popupId);
        });
    }

    /**
     * Récupère la liste des popups actives
     */
    getActivePopups() {
        return Array.from(this.activePopups);
    }

    /**
     * Vérifie si une popup spécifique est active
     */
    isPopupActive(popupId) {
        return this.activePopups.has(popupId);
    }

    /**
     * Ajoute une nouvelle configuration de popup
     */
    addPopupConfig(popupId, config) {
        this.popupConfigs.set(popupId, config);
    }

    /**
     * Supprime une configuration de popup
     */
    removePopupConfig(popupId) {
        this.popupConfigs.delete(popupId);
    }

    /**
     * Nettoie toutes les ressources
     */
    cleanup() {
        this.closeAllPopups();
        // Réactiver les pointer-events sur tous les canvas si nécessaire
        const canvasElements = document.querySelectorAll('canvas');
        canvasElements.forEach(element => {
            if (element.classList.contains('pointer-events-disabled')) {
                element.classList.remove('pointer-events-disabled');
            }
        });
        console.log('PopupManager cleanup completed');
    }

    /**
     * S'assurer que les événements ne sont pas bloqués au démarrage
     */
    ensureEventsUnblocked() {
        // Vérifier et réactiver les pointer-events si nécessaire
        const canvasElements = document.querySelectorAll('canvas.pointer-events-disabled');
        canvasElements.forEach(element => {
            element.classList.remove('pointer-events-disabled');
        });
    }
}

// Créer une instance globale
const popupManager = new PopupManager();

// Exposer globalement
window.popupManager = popupManager;

// Vérifier que le PopupManager est bien initialisé
console.log('PopupManager initialized:', {
    instance: popupManager,
    configs: popupManager.popupConfigs.size,
    activePopups: popupManager.activePopups.size
});

// Gestion d'erreur globale
window.addEventListener('error', (e) => {
    if (popupManager.getActivePopups().length > 0) {
        console.warn('Error detected while popups are open, cleaning up');
        popupManager.cleanup();
    }
});

// Nettoyage lors de la fermeture de la page
window.addEventListener('beforeunload', () => {
    popupManager.cleanup();
});

console.log('PopupManager loaded and ready');
