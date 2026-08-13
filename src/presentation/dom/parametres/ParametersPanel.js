import EventBlocker from '../shell/EventBlocker.js';
import { getFocusableElements } from '../shell/modalFocus.js';
import * as eventsConfig from '../../../config/events.js';
import { isTouchModeEnabled, setTouchModeEnabled } from '../../../config/touchMode.js';
import { isCameraDpadEnabled, setCameraDpadEnabled } from '../../../config/cameraDpad.js';
import { readStoredTileGridVisibility } from '../../three/managers/TileGridOverlay.js';
import { getLastPwaUpdateAt, installLatestPwaUpdate } from '../../../pwa.js';

/** @type {{
 *   pauseGame?: () => void,
 *   playGame?: () => void,
 *   registerAppService?: (name: string, instance: unknown) => void,
 *   getTimeManager?: () => { refreshCache?: () => Promise<void> } | null,
 *   getScene?: () => {
 *     setTileGridVisible?: (visible: boolean) => void,
 *     isTileGridVisible?: () => boolean,
 *   } | null,
 * } | null} */
let deps = null;

class ParametersPanel {
    constructor() {
        this.panel = null;
        this.openButton = null;
        this.closeButton = null;
        this.prevButton = null;
        this.nextButton = null;
        this.isVisible = false;
        this.eventBlocker = new EventBlocker();
        this.lastFocusedElement = null;

        this.eventsEnabledToggle = null;
        this.eventProbabilityInput = null;
        this.daysPerMonthInput = null;
        this.tileGridToggle = null;
        this.touchModeToggle = null;
        this.cameraDpadToggle = null;
        this.pwaUpdateInstallBtn = null;
        this.pwaUpdateStatus = null;

        this.handleDocumentKeyDown = this.handleDocumentKeyDown.bind(this);
        this.handleOutsideClick = this.handleOutsideClick.bind(this);

        this.init();
    }

    init() {
        if (this.panel) return;

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.init());
            return;
        }

        this.panel = document.getElementById('parameters-panel');
        this.openButton = document.getElementById('parameters-btn');

        if (!this.panel || !this.openButton) {
            console.warn('[ParametersPanel] Missing panel or open button in DOM');
            return;
        }

        this.closeButton = this.panel.querySelector('.parameters-close-btn');
        this.prevButton = this.panel.querySelector('.parameters-previous-btn');
        this.nextButton = this.panel.querySelector('.parameters-next-btn');

        this.eventsEnabledToggle = this.panel.querySelector('#events-enabled-toggle');
        this.eventProbabilityInput = this.panel.querySelector('#event-probability-input');
        this.daysPerMonthInput = this.panel.querySelector('#days-per-month-input');
        this.tileGridToggle = this.panel.querySelector('#tile-grid-toggle');
        this.touchModeToggle = this.panel.querySelector('#touch-mode-toggle');
        this.cameraDpadToggle = this.panel.querySelector('#camera-dpad-toggle');
        this.pwaUpdateInstallBtn = this.panel.querySelector('#pwa-update-install-btn');
        this.pwaUpdateStatus = this.panel.querySelector('#pwa-update-status');

        this.setupEventListeners();
        this.loadValues();
        this.refreshPwaUpdateStatus();
    }

    setupEventListeners() {
        const clonedButton = this.openButton.cloneNode(true);
        this.openButton.parentNode.replaceChild(clonedButton, this.openButton);
        this.openButton = clonedButton;

        this.openButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            event.stopImmediatePropagation();
            this.show();
        }, true);

        if (this.closeButton) {
            this.closeButton.addEventListener('click', (event) => {
                event.preventDefault();
                this.hide();
            });
        }

        const disabledHandler = (event) => {
            event.preventDefault();
        };

        if (this.prevButton) {
            this.prevButton.addEventListener('click', disabledHandler);
        }

        if (this.nextButton) {
            this.nextButton.addEventListener('click', disabledHandler);
        }

        if (this.eventsEnabledToggle) {
            this.eventsEnabledToggle.addEventListener('change', (e) => {
                this.handleEventsEnabledChange(e.target.checked);
            });
        }

        if (this.eventProbabilityInput) {
            this.eventProbabilityInput.addEventListener('change', (e) => {
                this.handleEventProbabilityChange(parseInt(e.target.value, 10));
            });
            this.eventProbabilityInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value === '' || value === '-') return;
                const numValue = parseInt(value, 10);
                if (!isNaN(numValue)) {
                    if (numValue < 0) {
                        e.target.value = 0;
                    } else if (numValue > 100) {
                        e.target.value = 100;
                    }
                }
            });
        }

        if (this.daysPerMonthInput) {
            this.daysPerMonthInput.addEventListener('change', (e) => {
                this.handleDaysPerMonthChange(parseInt(e.target.value, 10));
            });
            this.daysPerMonthInput.addEventListener('input', (e) => {
                const value = e.target.value;
                if (value === '' || value === '-') return;
                const numValue = parseInt(value, 10);
                if (!isNaN(numValue)) {
                    if (numValue < 1) {
                        e.target.value = 1;
                    } else if (numValue > 30) {
                        e.target.value = 30;
                    }
                }
            });
        }

        if (this.tileGridToggle) {
            this.tileGridToggle.addEventListener('change', (e) => {
                this.handleTileGridChange(e.target.checked);
            });
        }

        if (this.touchModeToggle) {
            this.touchModeToggle.addEventListener('change', (e) => {
                this.handleTouchModeChange(e.target.checked);
            });
        }

        if (this.cameraDpadToggle) {
            this.cameraDpadToggle.addEventListener('change', (e) => {
                this.handleCameraDpadChange(e.target.checked);
            });
        }

        if (this.pwaUpdateInstallBtn) {
            this.pwaUpdateInstallBtn.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                void this.handlePwaUpdateInstall();
            });
        }
    }

    async loadValues() {
        try {
            if (this.eventsEnabledToggle) {
                this.eventsEnabledToggle.checked = eventsConfig.isEventsEnabled();
            }

            if (this.eventProbabilityInput) {
                this.eventProbabilityInput.value = eventsConfig.getEventProbability();
            }

            if (this.daysPerMonthInput) {
                this.daysPerMonthInput.value = eventsConfig.getDaysPerMonth();
            }

            if (this.tileGridToggle) {
                const scene = deps?.getScene?.();
                this.tileGridToggle.checked =
                    scene?.isTileGridVisible?.() ?? readStoredTileGridVisibility();
            }

            if (this.touchModeToggle) {
                this.touchModeToggle.checked = isTouchModeEnabled();
            }

            if (this.cameraDpadToggle) {
                this.cameraDpadToggle.checked = isCameraDpadEnabled();
            }
        } catch (error) {
            console.error('[ParametersPanel] Error loading values:', error);
        }
    }

    handleTouchModeChange(enabled) {
        try {
            setTouchModeEnabled(enabled);
        } catch (error) {
            console.error('[ParametersPanel] Error toggling touch mode:', error);
        }
    }

    handleCameraDpadChange(enabled) {
        try {
            setCameraDpadEnabled(enabled);
        } catch (error) {
            console.error('[ParametersPanel] Error toggling camera D-pad:', error);
        }
    }

    refreshPwaUpdateStatus() {
        if (!this.pwaUpdateStatus) return;
        const iso = getLastPwaUpdateAt();
        if (!iso) {
            this.pwaUpdateStatus.hidden = true;
            this.pwaUpdateStatus.textContent = '';
            return;
        }
        try {
            const formatted = new Date(iso).toLocaleString('fr-FR', {
                dateStyle: 'short',
                timeStyle: 'short',
            });
            this.pwaUpdateStatus.hidden = false;
            this.pwaUpdateStatus.textContent = `Dernière installation : ${formatted}`;
        } catch {
            this.pwaUpdateStatus.hidden = true;
        }
    }

    async handlePwaUpdateInstall() {
        if (!this.pwaUpdateInstallBtn) return;
        const btn = this.pwaUpdateInstallBtn;
        const previousLabel = btn.textContent;
        btn.disabled = true;
        btn.textContent = 'Installation…';
        try {
            await installLatestPwaUpdate();
            this.refreshPwaUpdateStatus();
        } finally {
            // Reload usually follows; restore UI if it did not.
            btn.disabled = false;
            btn.textContent = previousLabel || 'Installer';
        }
    }

    handleTileGridChange(enabled) {
        try {
            const scene = deps?.getScene?.();
            if (scene?.setTileGridVisible) {
                scene.setTileGridVisible(enabled);
                return;
            }
            try {
                localStorage.setItem('anoria.tileGridVisible', enabled ? '1' : '0');
            } catch {
                /* ignore */
            }
        } catch (error) {
            console.error('[ParametersPanel] Error toggling tile grid:', error);
        }
    }

    async handleEventsEnabledChange(enabled) {
        try {
            eventsConfig.setEventsEnabled(enabled);
        } catch (error) {
            console.error('[ParametersPanel] Error setting events enabled:', error);
        }
    }

    async handleEventProbabilityChange(probability) {
        try {
            eventsConfig.setEventProbability(probability);
        } catch (error) {
            console.error('[ParametersPanel] Error setting event probability:', error);
        }
    }

    async handleDaysPerMonthChange(days) {
        try {
            eventsConfig.setDaysPerMonth(days);

            const timeManager = deps?.getTimeManager?.();
            if (timeManager && typeof timeManager.refreshCache === 'function') {
                await timeManager.refreshCache();
            }
        } catch (error) {
            console.error('[ParametersPanel] Error setting days per month:', error);
        }
    }

    handleDocumentKeyDown(event) {
        if (!this.isVisible || !this.panel) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            this.hide();
            return;
        }

        if (event.key !== 'Tab') return;

        const focusables = getFocusableElements(this.panel);
        if (focusables.length === 0) {
            event.preventDefault();
            this.panel.focus();
            return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active = document.activeElement;

        if (event.shiftKey) {
            if (active === first || !this.panel.contains(active)) {
                event.preventDefault();
                last.focus();
            }
            return;
        }

        if (active === last || !this.panel.contains(active)) {
            event.preventDefault();
            first.focus();
        }
    }

    handleOutsideClick(event) {
        if (!this.isVisible) return;

        const target = event.target;
        if (
            target === this.openButton
            || (this.openButton && this.openButton.contains(target))
        ) {
            return;
        }

        if (!this.panel.contains(event.target)) {
            event.preventDefault();
            event.stopPropagation();
            this.hide();
        }
    }

    blockGameEvents() {
        if (this.eventBlocker && !this.eventBlocker.isEventsBlocked()) {
            this.eventBlocker.blockThreeJSEvents({
                excludeSelectors: [
                    '#parameters-panel',
                    '#parameters-panel *',
                    '.parameters-panel',
                    '.parameters-panel *'
                ]
            });
        }
    }

    unblockGameEvents() {
        if (this.eventBlocker && this.eventBlocker.isEventsBlocked()) {
            this.eventBlocker.unblockEvents();
        }
    }

    show() {
        if (this.isVisible) return;

        this.isVisible = true;
        this.lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        this.loadValues();
        this.refreshPwaUpdateStatus();

        this.panel.classList.add('visible');
        this.panel.setAttribute('aria-hidden', 'false');

        requestAnimationFrame(() => {
            this.panel.focus();
        });

        document.addEventListener('keydown', this.handleDocumentKeyDown);
        document.addEventListener('click', this.handleOutsideClick, true);

        this.blockGameEvents();

        deps?.pauseGame?.();
    }

    hide() {
        if (!this.isVisible) return;

        this.isVisible = false;
        this.panel.classList.remove('visible');
        this.panel.setAttribute('aria-hidden', 'true');

        document.removeEventListener('keydown', this.handleDocumentKeyDown);
        document.removeEventListener('click', this.handleOutsideClick, true);

        this.unblockGameEvents();

        deps?.playGame?.();

        if (this.lastFocusedElement && typeof this.lastFocusedElement.focus === 'function') {
            this.lastFocusedElement.focus();
        }
    }
}

/**
 * @param {{
 *   pauseGame?: () => void,
 *   playGame?: () => void,
 *   registerAppService?: (name: string, instance: unknown) => void,
 *   getTimeManager?: () => { refreshCache?: () => Promise<void> } | null,
 *   getScene?: () => {
 *     setTileGridVisible?: (visible: boolean) => void,
 *     isTileGridVisible?: () => boolean,
 *   } | null,
 * }} panelDeps
 */
export function initParametersPanel(panelDeps) {
    deps = panelDeps;
    const parametersPanel = new ParametersPanel();
    deps.registerAppService?.('parametersPanel', parametersPanel);
    return parametersPanel;
}
