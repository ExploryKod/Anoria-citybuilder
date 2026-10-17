/**
 * GameUI - Centralizes DOM queries and UI state management
 * Inspired by simcity-threejs-clone's GameUI pattern
 */

import { HUNGER_CAUSES, HUNGER_RISK } from '../../../shared/population/HungerCauseCatalog.js';
import {
    displayTime,
    displaySeason,
    displaySpeed,
    infoPanelClockIcon,
    infoPanelNoClockIcon,
    gameWindow as gameWindowElement,
    displayPopTotal,
    displayPopTotalHamlet,
    displayPopActiveTotal,
    displayPopActiveTotalHamlet,
    displayHungerPop,
    displayHungerPopHamlet,
    displayDisettePop,
    displayDisettePopHamlet,
    displayHungerRisk,
    displayHungerRiskHamlet,
    iconHungerRisk,
    iconDisette,
    iconPenurie,
    displayDeathsPop,
    displayLaborCountry,
    displayLaborHamlet,
    popGroupPopNodes,
    popGroupWorkerNodes,
    popGroupLaborNodes,
    popLaborCauseNodes,
    popResourceCityNodes,
    popResourceNatureNodes,
    displayFunds,
    infoObjectOverlay,
    infoObjectCloseBtn,
    overOverlay,
    overOverlayMessage,
    bulldozeSelected
} from './nodes.js';
import { formatEuroAmount } from '../../../contexts/accounting/presentation/formatMoney.js';
import { TimeManager } from '../../../shared/time/TimeManager.js';
import { SEASON_KEYS } from '../../../shared/time/TimeCalendar.js';
import { msToSpeedLevel, SPEED_LEVEL_MAX } from '../../../shared/gameplay/SimulationDefaults.js';
import { getResidentialGroupTitle } from './ResidentialGroupLabels.js';
import { allSocialGroups } from '../../../composition/employmentCatalog.js';
import { laborSlotFromStats } from '../../../composition/hudPopulationAggregates.js';
import {
    HUD_CITY_RESOURCE_PRODUCTS,
    HUD_NATURE_RESOURCE_PRODUCTS,
} from '../../../composition/hudResourceAggregates.js';

/** @type {{ getScene?: () => { controls?: { enabled: boolean } } | null } | null} */
let deps = null;

/**
 * @param {{ getScene?: () => { controls?: { enabled: boolean } } | null }} uiDeps
 */
export function bindGameUIDeps(uiDeps) {
    deps = uiDeps;
}

const HUD_SEASON_MODIFIER_CLASSES = [
    ...SEASON_KEYS.map((key) => `hud-season--${key}`),
    'hud-season--loading',
];

/**
 * @param {HTMLElement | null} el
 * @param {number} value
 */
function setHudCount(el, value) {
    if (!el) return;
    el.textContent = String(Math.max(0, Math.floor(value) || 0));
}

/**
 * @param {HTMLElement | null} el
 * @param {{ mode: 'lack' | 'unemployment' | 'both', display: string, count: number, unemployed: number, lack: number }} slot
 * @param {string} scopeLabel
 */
function setLaborCell(el, slot, scopeLabel) {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = slot.display;
    el.classList.toggle('pop-detail-value--lack', slot.mode !== 'unemployment');
    const plural = (n) => (n === 1 ? '' : 's');
    const unemployedWords = `${slot.unemployed} chômeur${plural(slot.unemployed)}`;
    const lackWords = `${slot.lack} poste${plural(slot.lack)} vide${plural(slot.lack)}`;
    const tooltip = slot.mode === 'both'
        ? `${scopeLabel} : ${unemployedWords} (${slot.display.split(' · ')[0]}) et ${lackWords}`
        : slot.mode === 'lack'
            ? `${scopeLabel} : ${lackWords}`
            : `${scopeLabel} : ${unemployedWords}`;
    el.title = tooltip;
    el.setAttribute('aria-label', tooltip);
}

/**
 * @param {Record<string, { row: Element | null, country: Element | null, hamlet: Element | null }>} nodesByGroup
 * @param {Record<string, number>} countryCounts
 * @param {Record<string, number> | null} hamletCounts
 */
function setGroupCounts(nodesByGroup, countryCounts, hamletCounts) {
    for (const group of allSocialGroups()) {
        const nodes = nodesByGroup[group];
        if (!nodes) continue;
        setHudCount(nodes.country, countryCounts?.[group] ?? 0);
        if (hamletCounts) {
            setHudCount(nodes.hamlet, hamletCounts[group] ?? 0);
        }
    }
}

/**
 * Visible HUD date stays abbreviated; screen readers get the full month name.
 * @param {number | null | undefined} days
 */
function setHudDateDisplay(days) {
    if (!displayTime) return;
    const loading = typeof days !== 'number' || Number.isNaN(days) || days < 0;
    const visual = loading ? 'Chargement...' : TimeManager.formatTime(days);
    const accessible = loading
        ? 'Chargement...'
        : TimeManager.formatTime(days, { abbreviated: false });

    const visualEl = displayTime.querySelector('.display-time__visual');
    const srEl = displayTime.querySelector('.display-time__sr');
    if (visualEl && srEl) {
        visualEl.textContent = visual;
        srEl.textContent = accessible;
    } else {
        displayTime.textContent = visual;
    }

    const clockBox = displayTime.closest('.clock-box');
    if (clockBox) {
        clockBox.title = loading ? 'Date en jeu' : accessible;
    }
}

class GameUI {
    /**
     * Currently selected tool ID
     * @type {string}
     */
    activeToolId = 'select-object';

    /**
     * Previously selected control element (for styling)
     * @type {HTMLElement | null}
     */
    selectedControl = null;

    /**
     * True if the game is currently paused
     * @type {boolean}
     */
    isPaused = false;

    /**
     * Current time value (number of days) - stored to keep displaying it even when paused
     * @type {number | null}
     */
    currentTime = null;

    /**
     * Getter for the game render window element
     * @returns {HTMLElement | null}
     */
    get gameWindow() {
        return gameWindowElement; // From nodes.js
    }

    /**
     * Updates season emoji in the time bar (before date).
     * @param {number} days
     */
    updateSeasonDisplay(days) {
        if (!displaySeason) return;
        displaySeason.classList.remove(...HUD_SEASON_MODIFIER_CLASSES);
        if (typeof days !== 'number' || Number.isNaN(days) || days < 0) {
            displaySeason.textContent = '…';
            displaySeason.title = 'Saison';
            displaySeason.setAttribute('aria-label', 'Saison : chargement…');
            displaySeason.classList.add('hud-season--loading');
            return;
        }
        const { emoji, title, ariaLabel, seasonKey } = TimeManager.getSeasonDisplayForDays(days);
        displaySeason.textContent = emoji;
        displaySeason.title = title;
        displaySeason.setAttribute('aria-label', ariaLabel);
        displaySeason.classList.add(`hud-season--${seasonKey}`);
    }

    /**
     * Updates the time display
     * @param {number|string|undefined} time - Time value to display (number of days)
     * @param {string} unit - Optional unit (ignored if time is number, uses TimeManager)
     */
    updateTimeDisplay(time, unit = 'jours') {
        if (displayTime) {
            if (typeof time === 'number' && !isNaN(time) && time >= 0) {
                this.currentTime = time;
                this.updateSeasonDisplay(time);
                setHudDateDisplay(time);
            } else {
                this.updateSeasonDisplay(NaN);
                setHudDateDisplay(null);
            }
        }
    }

    /**
     * Updates the game speed display
     * @param {number} speedOrLevel - Speed level (1..N) or legacy tick interval in ms
     */
    updateSpeedDisplay(speedOrLevel) {
        if (!displaySpeed) return;
        const level =
            Number.isInteger(speedOrLevel) && speedOrLevel >= 1 && speedOrLevel <= SPEED_LEVEL_MAX
                ? speedOrLevel
                : msToSpeedLevel(speedOrLevel);
        displaySpeed.textContent = String(level);
    }

    /**
     * Toggles the pause state of the game
     * @returns {boolean} New pause state
     */
    togglePause() {
        this.isPaused = !this.isPaused;
        this.updatePauseUI(this.isPaused);
        return this.isPaused;
    }

    /**
     * Sets the pause state
     * @param {boolean} paused - True to pause, false to resume
     */
    setPaused(paused) {
        this.isPaused = paused;
        this.updatePauseUI(paused);
    }

    /**
     * Updates pause UI elements (icons only - time display is not changed)
     * @param {boolean} paused - Current pause state
     */
    updatePauseUI(paused) {
        if (paused) {
            // Game paused - changer seulement les icônes
            if (infoPanelClockIcon) infoPanelClockIcon.style.display = 'none';
            if (infoPanelNoClockIcon) infoPanelNoClockIcon.style.display = 'block';
            // Ne pas modifier l'affichage du temps - il reste visible avec sa valeur actuelle
        } else {
            // Game playing - changer seulement les icônes
            if (infoPanelClockIcon) infoPanelClockIcon.style.display = 'block';
            if (infoPanelNoClockIcon) infoPanelNoClockIcon.style.display = 'none';
            // Ne pas modifier l'affichage du temps - il reste visible avec sa valeur actuelle
        }
        
        // Réafficher le temps stocké si disponible (pour s'assurer qu'il est toujours affiché)
        if (this.currentTime !== null && displayTime) {
            this.updateSeasonDisplay(this.currentTime);
            setHudDateDisplay(this.currentTime);
        }
    }

    /**
     * Handles tool selection (updates active tool and UI styling)
     * @param {HTMLElement} controlElement - The tool button element
     * @param {string} toolId - The tool ID to activate
     */
    onToolSelected(controlElement, toolId) {
        // Deselect previously selected button
        if (this.selectedControl) {
            this.selectedControl.classList.remove('selected');
        }

        // Select new button
        if (controlElement) {
            controlElement.classList.add('selected');
        }
        this.selectedControl = controlElement;
        this.activeToolId = toolId || (controlElement?.getAttribute('data-type') || 'select-object');
    }

    /**
     * The population of the houses (all their residents, the huts and the administrators included) and the workers placed in a workplace
     * (what the per-class worker rows add up to).
     * @param {number} totalPopulation
     * @param {number} workersCount
     * @param {{ totalPop: number, workersCount: number } | null} [hamlet] the active hamlet's own figures
     */
    updatePopulationTotals(totalPopulation, workersCount, hamlet = null) {
        setHudCount(displayPopTotal, totalPopulation);
        setHudCount(displayPopActiveTotal, workersCount);
        if (hamlet) {
            setHudCount(displayPopTotalHamlet, hamlet.totalPop);
            setHudCount(displayPopActiveTotalHamlet, hamlet.workersCount);
        }
    }

    /**
     * Updates the hunger displays, the two ways to go hungry told apart (see HungerCauseCatalog.js): the words and the disette icon come from the catalog.
     * @param {{ disette: number, penurie: number }} country - Country-wide famished counts
     * @param {{ disette: number, penurie: number }} [hamlet] - Active hamlet famished counts
     */
    updateFamishedPopulation(country, hamlet = null) {
        if (iconDisette) {
            iconDisette.textContent = HUNGER_CAUSES.disette.icon;
            iconDisette.title = HUNGER_CAUSES.disette.label;
        }
        if (iconPenurie) iconPenurie.title = HUNGER_CAUSES.penurie.label;
        setHudCount(displayDisettePop, country.disette);
        setHudCount(displayHungerPop, country.penurie);
        if (hamlet != null) {
            setHudCount(displayDisettePopHamlet, hamlet.disette);
            setHudCount(displayHungerPopHamlet, hamlet.penurie);
        }
    }

    /**
     * Updates the early warning of hunger (see HUNGER_RISK): the inhabitants whose house still misses part of its ration today. It is a forecast that moves
     * every day, apart from the famished counts (the month's consumption record); its tooltip tells the two causes apart.
     * @param {{ disette: number, penurie: number }} country
     * @param {{ disette: number, penurie: number }} [hamlet]
     */
    updateHungerRisk(country, hamlet = null) {
        const total = (risk) => risk.disette + risk.penurie;
        if (iconHungerRisk) {
            iconHungerRisk.textContent = HUNGER_RISK.icon;
            iconHungerRisk.title = `${HUNGER_RISK.label} : ${HUNGER_CAUSES.disette.label.toLowerCase()} ${country.disette}, ${HUNGER_CAUSES.penurie.label.toLowerCase()} ${country.penurie}`;
        }
        setHudCount(displayHungerRisk, total(country));
        if (hamlet != null) setHudCount(displayHungerRiskHamlet, total(hamlet));
    }

    /**
     * Updates cumulative deaths since game start (famine mortality).
     * @param {number} deaths
     */
    updateDeaths(deaths) {
        if (displayDeathsPop) {
            displayDeathsPop.textContent = String(Math.max(0, Math.floor(deaths) || 0));
        }
    }

    /**
     * Population / workers / labor market by social group (country + hamlet).
     * Labor cells show lack when present, otherwise unemployment %.
     *
     * @param {{
     *   popCountry?: Record<string, number>,
     *   popHamlet?: Record<string, number>,
     *   workersCountry?: Record<string, number>,
     *   workersHamlet?: Record<string, number>,
     *   laborCountry?: { unemployed?: number, unemploymentPercentage?: number, lack?: number },
     *   laborHamlet?: { unemployed?: number, unemploymentPercentage?: number, lack?: number },
     *   groupsCountry?: Record<string, { workerPool?: number, assigned?: number, unemployed?: number, unemploymentPercentage?: number, lack?: number }>,
     *   groupsHamlet?: Record<string, { workerPool?: number, assigned?: number, unemployed?: number, unemploymentPercentage?: number, lack?: number }>,
     *   causesCountry?: Record<string, number>,
     *   causesHamlet?: Record<string, number>,
     * }} payload
     */
    updateGroupHud(payload = {}) {
        setGroupCounts(popGroupPopNodes, payload.popCountry ?? {}, payload.popHamlet ?? null);
        setGroupCounts(popGroupWorkerNodes, payload.workersCountry ?? {}, payload.workersHamlet ?? null);

        const countrySlot = laborSlotFromStats(payload.laborCountry);
        const hamletSlot = laborSlotFromStats(payload.laborHamlet);
        setLaborCell(displayLaborCountry, countrySlot, 'Pays');
        setLaborCell(displayLaborHamlet, hamletSlot, 'Hameau visible');

        for (const group of allSocialGroups()) {
            const nodes = popGroupLaborNodes[group];
            if (!nodes) continue;
            const country = payload.groupsCountry?.[group] ?? {};
            const hamlet = payload.groupsHamlet?.[group] ?? {};
            const groupTitle = getResidentialGroupTitle(group);
            setLaborCell(nodes.country, laborSlotFromStats(country), `${groupTitle} — pays`);
            setLaborCell(nodes.hamlet, laborSlotFromStats(hamlet), `${groupTitle} — hameau visible`);
        }

        // Why people are out of work and why posts stay empty: a row each, dimmed while both scopes are at zero.
        for (const [cause, nodes] of Object.entries(popLaborCauseNodes)) {
            setHudCount(nodes.country, payload.causesCountry?.[cause] ?? 0);
            setHudCount(nodes.hamlet, payload.causesHamlet?.[cause] ?? 0);
            nodes.row?.classList.toggle('is-zero', !(payload.causesCountry?.[cause] > 0) && !(payload.causesHamlet?.[cause] > 0));
        }
    }

    /**
     * Dual-column resource rail: city and map nature deposits.
     *
     * @param {{
     *   cityCountry?: Record<string, number>,
     *   cityHamlet?: Record<string, number>,
     *   natureCountry?: Record<string, number>,
     *   natureHamlet?: Record<string, number>,
     * }} payload
     */
    updateResourcesHud(payload = {}) {
        for (const product of HUD_CITY_RESOURCE_PRODUCTS) {
            const nodes = popResourceCityNodes[product];
            if (!nodes) continue;
            setHudCount(nodes.country, payload.cityCountry?.[product] ?? 0);
            setHudCount(nodes.hamlet, payload.cityHamlet?.[product] ?? 0);
        }
        for (const product of HUD_NATURE_RESOURCE_PRODUCTS) {
            const nodes = popResourceNatureNodes[product];
            if (!nodes) continue;
            setHudCount(nodes.country, payload.natureCountry?.[product] ?? 0);
            setHudCount(nodes.hamlet, payload.natureHamlet?.[product] ?? 0);
        }
    }

    /**
     * Updates funds display
     * @param {number} funds - Funds amount
     */
    updateFunds(funds) {
        if (displayFunds) {
            displayFunds.textContent = formatEuroAmount(funds ?? 0);
        }
    }

    /** Initial HUD placeholders at city load (owned by GameUI, not scene). */
    resetInitialHud() {
        this.updatePopulationTotals(0, 0);
        if (displayFunds) {
            displayFunds.textContent = formatEuroAmount(0);
        }
        const debtBox = document.querySelector('.debt-box');
        if (debtBox) {
            debtBox.style.display = 'none';
        }
    }

    /**
     * Updates the info panel with selected object information
     * @param {THREE.Object3D | null} object - Selected object or null to hide panel
     * @param {Function} objectToHTML - Optional function to convert object to HTML string
     */
    updateInfoPanel(object, objectToHTML = null) {
        if (!infoObjectOverlay) return;

        if (object) {
            // Show info panel
            if (!infoObjectOverlay.classList.contains('active')) {
                infoObjectOverlay.classList.add('active');
                // Disable pointer events on 3D scene when info overlay is active
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.add('pointer-events-disabled');
                }
                // Disable OrbitControls to prevent scene movement
                // Try to access scene through various paths
                let sceneObj = deps?.getScene?.();
                if (sceneObj && sceneObj.controls) {
                    sceneObj.controls.enabled = false;
                }
            }

            // Update content if converter function provided
            // Note: Anoria uses makeInfoBuildingText, so this is a placeholder for future use
            if (objectToHTML && typeof objectToHTML === 'function') {
                const content = infoObjectOverlay.querySelector('.info-content');
                if (content) {
                    content.innerHTML = objectToHTML(object);
                }
            }
        } else {
            // Hide info panel
            if (infoObjectOverlay.classList.contains('active')) {
                infoObjectOverlay.classList.remove('active');
                // Re-enable pointer events on 3D scene
                const canvas = document.querySelector('canvas');
                if (canvas) {
                    canvas.classList.remove('pointer-events-disabled');
                }
                // Re-enable OrbitControls when modal closes
                // Try to access scene through various paths
                let sceneObj = deps?.getScene?.();
                if (sceneObj && sceneObj.controls) {
                    sceneObj.controls.enabled = true;
                }
                if (sceneObj && sceneObj.suppressInput) {
                    sceneObj.suppressInput(200);
                }
            }
        }
    }

    /**
     * Shows loading text/element
     */
    showLoadingText() {
        // Anoria uses LoaderManager, so this is a placeholder for compatibility
        // Can be extended if needed
    }

    /**
     * Hides loading text/element
     */
    hideLoadingText() {
        // Anoria uses LoaderManager, so this is a placeholder for compatibility
        // Can be extended if needed
    }

    /**
     * Shows game over overlay
     * @param {string} message - Optional message to display
     */
    showGameOver(message = null) {
        if (overOverlay) {
            overOverlay.classList.add('active');
            overOverlay.removeAttribute('inert');
            overOverlay.setAttribute('aria-hidden', 'false');
            const playAgain = overOverlay.querySelector('#play-again-btn');
            playAgain?.removeAttribute('tabindex');
            if (message && overOverlayMessage) {
                overOverlayMessage.textContent = message;
            }
        }
    }

    /**
     * Hides game over overlay
     */
    hideGameOver() {
        if (overOverlay) {
            overOverlay.classList.remove('active');
            overOverlay.setAttribute('inert', '');
            overOverlay.setAttribute('aria-hidden', 'true');
            const playAgain = overOverlay.querySelector('#play-again-btn');
            playAgain?.setAttribute('tabindex', '-1');
        }
    }

    /**
     * Checks if bulldoze tool is active
     * @returns {boolean}
     */
    isBulldozeActive() {
        return bulldozeSelected?.classList.contains('selected') || false;
    }
}

// Export singleton instance (similar to simcity's window.ui pattern)
export default new GameUI();

