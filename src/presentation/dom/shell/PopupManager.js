/**
 * PopupManager - Gestionnaire unifié pour toutes les popups
 * Utilise pointer-events CSS + EventBlocker pour désactiver les interactions jeu / canvas 3D
 */
import { registerAppService } from '../../../composition/appServices.js';
import EventBlocker from './EventBlocker.js';

/** @type {{ pauseGame?: () => void, playGame?: () => void } | null} */
let deps = null;

/**
 * @param {{ pauseGame?: () => void, playGame?: () => void }} panelDeps
 */
export function bindPopupManagerDeps(panelDeps) {
    deps = panelDeps;
}

const DEFAULT_BLOCK_EVENTS = ['mousedown', 'mouseup', 'mousemove', 'keydown', 'keyup'];

/**
 * @param {string} popupId
 * @returns {string[]}
 */
function excludeSelectorsForPopup(popupId) {
    return [`#${popupId}`, `#${popupId} *`];
}

class PopupManager {
    constructor() {
        this.activePopups = new Set();
        this.popupConfigs = new Map();
        this.eventBlocker = new EventBlocker();

        this.setupPopupConfigs();
        this.setupGlobalEventListeners();

        // S'assurer que les événements ne sont pas bloqués au démarrage
        this.ensureEventsUnblocked();
    }

    /**
     * Configure les paramètres pour chaque popup
     */
    setupPopupConfigs() {
        const blocking = {
            shouldBlockEvents: true,
            shouldPauseGame: true,
            eventsToBlock: [...DEFAULT_BLOCK_EVENTS],
            canvasSelectors: ['canvas'],
            onOpen: () => {},
            onClose: () => {},
        };

        for (const id of [
            'pause-overlay',
            'compte-de-resultat-panel',
            'info-building-overlay',
            'over-overlay',
            'loans-panel',
            'bilan-panel',
            'administrator-panel',
            'city-map-panel',
            'journal-panel',
            'food-traceability-panel',
            'news-event-modal',
        ]) {
            this.popupConfigs.set(id, { ...blocking });
        }

        // Popups de sélection d'objets (ne pas bloquer les événements clavier / souris jeu)
        this.popupConfigs.set('panel-layout', {
            shouldBlockEvents: false,
            shouldPauseGame: true,
            eventsToBlock: [],
            canvasSelectors: [],
            onOpen: () => {},
            onClose: () => {},
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
     * `[hidden]` gagne toujours : une modale masquée ne doit ni bloquer le canvas ni pauser.
     */
    isPopupOpen(element) {
        if (!element || element.hidden) {
            return false;
        }
        return element.classList.contains('active') ||
               element.classList.contains('visible') ||
               element.classList.contains('show');
    }

    /**
     * Popups actives qui doivent bloquer le clavier / souris jeu.
     * @returns {string[]}
     */
    getBlockingPopupIds() {
        return Array.from(this.activePopups).filter((id) => {
            const config = this.popupConfigs.get(id);
            return Boolean(config?.shouldBlockEvents);
        });
    }

    /**
     * Synchronise EventBlocker avec l'ensemble des popups bloquantes ouvertes.
     */
    syncEventBlocker() {
        const blockingIds = this.getBlockingPopupIds();

        if (this.eventBlocker.isEventsBlocked()) {
            this.eventBlocker.unblockEvents();
        }

        if (blockingIds.length === 0) {
            this.syncBackgroundInert([]);
            return;
        }

        const excludeSelectors = blockingIds.flatMap((id) => excludeSelectorsForPopup(id));
        this.eventBlocker.blockThreeJSEvents({
            blockCanvas: false, // canvas déjà géré via pointer-events-disabled
            excludeSelectors,
        });
        this.syncBackgroundInert(blockingIds);
    }

    /**
     * When a blocking dialog lives outside #game-window, inert the HUD so Tab
     * cannot reach controls behind the overlay (admin, bilan, carte, …).
     * Dialogs inside #game-window (pause, info-bâtiment) keep the window interactive
     * for their own controls; modalFocus traps Tab instead.
     * @param {string[]} blockingIds
     */
    syncBackgroundInert(blockingIds) {
        const gameWindow = document.getElementById('game-window');
        if (!gameWindow) return;

        const needsInert = blockingIds.some((id) => {
            const el = document.getElementById(id);
            return Boolean(el && !gameWindow.contains(el));
        });

        if (needsInert) {
            gameWindow.setAttribute('inert', '');
        } else {
            gameWindow.removeAttribute('inert');
        }
    }

    /**
     * @returns {boolean}
     */
    anyActivePopupNeedsCanvasBlock() {
        return Array.from(this.activePopups).some((id) => {
            const config = this.popupConfigs.get(id);
            return Boolean(config?.canvasSelectors?.length);
        });
    }

    /**
     * @param {string[]} selectors
     * @param {boolean} disabled
     */
    setCanvasPointerEventsDisabled(selectors, disabled) {
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((element) => {
                element.classList.toggle('pointer-events-disabled', disabled);
            });
        });
    }

    /**
     * Ouvre une popup avec gestion des événements
     */
    openPopup(popupId) {
        // Vérifier l'état réel du DOM plutôt que juste notre Set interne
        const element = document.getElementById(popupId);
        if (element?.hidden) {
            return;
        }
        const isActuallyActive = element && this.isPopupOpen(element);

        if (this.activePopups.has(popupId) && isActuallyActive) {
            this.syncEventBlocker();
            return;
        }

        // Si le popup est actif dans le DOM mais pas dans notre Set, on le synchronise
        if (isActuallyActive && !this.activePopups.has(popupId)) {
            this.activePopups.add(popupId);

            const config = this.popupConfigs.get(popupId);
            if (config) {
                if (config.canvasSelectors && config.canvasSelectors.length > 0) {
                    this.setCanvasPointerEventsDisabled(config.canvasSelectors, true);
                }
                if (config.shouldPauseGame) {
                    deps?.pauseGame?.();
                }
                if (config.onOpen) {
                    config.onOpen();
                }
            }
            this.syncEventBlocker();
            return;
        }

        const config = this.popupConfigs.get(popupId);
        if (!config) {
            console.warn(`PopupManager: No config found for ${popupId}`);
            return;
        }

        this.activePopups.add(popupId);

        if (config.canvasSelectors && config.canvasSelectors.length > 0) {
            this.setCanvasPointerEventsDisabled(config.canvasSelectors, true);
        }

        if (config.shouldPauseGame) {
            deps?.pauseGame?.();
        }

        if (config.onOpen) {
            config.onOpen();
        }

        this.syncEventBlocker();
    }

    /**
     * Ferme une popup avec gestion des événements
     */
    closePopup(popupId) {
        if (!this.activePopups.has(popupId)) return;

        const config = this.popupConfigs.get(popupId);
        if (!config) return;

        this.activePopups.delete(popupId);

        // Ne réactiver le canvas que si plus aucune popup ne le demande
        if (!this.anyActivePopupNeedsCanvasBlock()) {
            const selectors = config.canvasSelectors?.length
                ? config.canvasSelectors
                : ['canvas'];
            this.setCanvasPointerEventsDisabled(selectors, false);
        }

        if (config.shouldPauseGame) {
            const hasOtherPausingPopups = Array.from(this.activePopups).some((id) => {
                const otherConfig = this.popupConfigs.get(id);
                return otherConfig && otherConfig.shouldPauseGame;
            });

            if (!hasOtherPausingPopups) {
                deps?.playGame?.();
            }
        }

        if (config.onClose) {
            config.onClose();
        }

        this.syncEventBlocker();
    }

    /**
     * Force l'ouverture d'une popup (pour les cas où l'observer ne détecte pas)
     */
    forceOpenPopup(popupId) {
        this.openPopup(popupId);
    }

    /**
     * Force la fermeture d'une popup (pour les cas où l'observer ne détecte pas)
     */
    forceClosePopup(popupId) {
        this.closePopup(popupId);
    }

    /**
     * Ferme toutes les popups actives
     */
    closeAllPopups() {
        const activePopups = Array.from(this.activePopups);
        activePopups.forEach((popupId) => {
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
        if (this.eventBlocker.isEventsBlocked()) {
            this.eventBlocker.unblockEvents();
        }
        document.getElementById('game-window')?.removeAttribute('inert');
        const canvasElements = document.querySelectorAll('canvas');
        canvasElements.forEach((element) => {
            element.classList.remove('pointer-events-disabled');
        });
    }

    /**
     * S'assurer que les événements ne sont pas bloqués au démarrage
     */
    ensureEventsUnblocked() {
        if (this.eventBlocker.isEventsBlocked()) {
            this.eventBlocker.unblockEvents();
        }
        document.getElementById('game-window')?.removeAttribute('inert');
        const canvasElements = document.querySelectorAll('canvas.pointer-events-disabled');
        canvasElements.forEach((element) => {
            element.classList.remove('pointer-events-disabled');
        });
    }
}

// Créer une instance globale
const popupManager = new PopupManager();

registerAppService('popupManager', popupManager);

export { popupManager };
export default popupManager;

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
