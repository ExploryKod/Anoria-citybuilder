import EventBlocker from '../shell/EventBlocker.js';

/** @type {{
 *   pauseGame?: () => void,
 *   playGame?: () => void,
 *   registerAppService?: (name: string, instance: unknown) => void,
 *   getTimeManager?: () => { refreshCache?: () => Promise<void> } | null,
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

        this.setupEventListeners();
        this.loadValues();
    }

    setupEventListeners() {
        const clonedButton = this.openButton.cloneNode(true);
        this.openButton.parentNode.replaceChild(clonedButton, this.openButton);
        this.openButton = clonedButton;

        this.openButton.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
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
    }

    async loadValues() {
        try {
            const eventsConfig = await import('../../../config/events.js');

            if (this.eventsEnabledToggle) {
                this.eventsEnabledToggle.checked = eventsConfig.isEventsEnabled();
            }

            if (this.eventProbabilityInput) {
                this.eventProbabilityInput.value = eventsConfig.getEventProbability();
            }

            if (this.daysPerMonthInput) {
                this.daysPerMonthInput.value = eventsConfig.getDaysPerMonth();
            }
        } catch (error) {
            console.error('[ParametersPanel] Error loading values:', error);
        }
    }

    async handleEventsEnabledChange(enabled) {
        try {
            const eventsConfig = await import('../../../config/events.js');
            eventsConfig.setEventsEnabled(enabled);
        } catch (error) {
            console.error('[ParametersPanel] Error setting events enabled:', error);
        }
    }

    async handleEventProbabilityChange(probability) {
        try {
            const eventsConfig = await import('../../../config/events.js');
            eventsConfig.setEventProbability(probability);
        } catch (error) {
            console.error('[ParametersPanel] Error setting event probability:', error);
        }
    }

    async handleDaysPerMonthChange(days) {
        try {
            const eventsConfig = await import('../../../config/events.js');
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
        if (!this.isVisible) return;

        const target = event.target;
        if (target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('#parameters-panel')
        )) {
            if (event.key === 'Escape') {
                event.preventDefault();
                this.hide();
            }
            return;
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            this.hide();
        }
    }

    handleOutsideClick(event) {
        if (!this.isVisible) return;

        if (!this.panel.contains(event.target) && event.target !== this.openButton) {
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
 * }} panelDeps
 */
export function initParametersPanel(panelDeps) {
    deps = panelDeps;
    const parametersPanel = new ParametersPanel();
    deps.registerAppService?.('parametersPanel', parametersPanel);
    return parametersPanel;
}
