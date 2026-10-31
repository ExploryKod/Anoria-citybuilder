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
    displayPopActiveTotal,
    displayHungerPop,
    displayDisettePop,
    displayHungerRisk,
    iconHungerRisk,
    iconDisette,
    iconPenurie,
    displayDeathsPop,
    displayLabor,
    popGroupPopNodes,
    popGroupWorkerNodes,
    popGroupLaborNodes,
    popLaborCauseNodes,
    popGroupLaborCauseNodes,
    popResourceCityNodes,
    popResourceNatureNodes,
    displayFunds,
    displayFundsCompact,
    infoObjectOverlay,
    infoObjectCloseBtn,
    overOverlay,
    overOverlayMessage,
    bulldozeSelected
} from './nodes.js';
import { formatEuroAmount, formatEuroCompact } from '../../../contexts/accounting/presentation/formatMoney.js';

/** The funds on screen: the exact figure, and the short one on the funds button (#hud-funds-compact in game.html) */
function showFunds(funds) {
    if (!displayFundsCompact) throw new Error('GameUI: #hud-funds-compact is missing from game.html');
    // Funds that are not known yet are "…" (the markup's initial state), never 0: a zero reads as an empty treasury.
    if (typeof funds !== 'number' || Number.isNaN(funds)) {
        throw new Error(`GameUI.updateFunds: funds must be a number, got ${funds}`);
    }
    displayFunds.textContent = formatEuroAmount(funds);
    displayFundsCompact.textContent = formatEuroCompact(funds);
}
import { TimeManager } from '../../../shared/time/TimeManager.js';
import { SEASON_KEYS } from '../../../shared/time/TimeCalendar.js';
import { msToSpeedLevel, SPEED_LEVEL_MAX } from '../../../shared/gameplay/SimulationDefaults.js';
import { getResidentialGroupTitle } from './ResidentialGroupLabels.js';
import { allSocialGroups } from '../../../composition/employmentCatalog.js';
import { laborSlotFromStats } from '../../../composition/hudPopulationAggregates.js';
import { getHudPopRailScope, HUD_POP_RAIL_SCOPE_EVENT } from './hudPopRailScope.js';
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
    // A count that is not a number is a count not known: it stays "…" (the loading state), it is never shown as 0.
    if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new Error(`GameUI.setHudCount: expected a number for ${el.className}, got ${value}`);
    }
    el.textContent = String(Math.max(0, Math.floor(value)));
}

/**
 * A percentage of the labour market. It carries no tooltip of its own: the whole row speaks (see `setLaborRowWords`).
 * @param {HTMLElement | null} el
 * @param {{ mode: 'lack' | 'unemployment' | 'both', display: string, count: number, unemployed: number, lack: number }} slot
 */
function setLaborCell(el, slot) {
    if (!(el instanceof HTMLElement)) return;
    el.textContent = slot.display;
    el.classList.toggle('pop-detail-value--lack', slot.mode !== 'unemployment');
    el.removeAttribute('title');
}

/** What a labour figure counts, in words: the people out of work (and their share), the posts left empty, or both. */
function laborFigures(slot) {
    const plural = (n) => (n === 1 ? '' : 's');
    const unemployedWords = `${slot.unemployed} chômeur${plural(slot.unemployed)}`;
    const lackWords = `${slot.lack} poste${plural(slot.lack)} vide${plural(slot.lack)}`;
    if (slot.mode === 'both') return `${unemployedWords} (${slot.display.split(' · ')[0]}) et ${lackWords}`;
    return slot.mode === 'lack' ? lackWords : `${unemployedWords} (${slot.display})`;
}

/** Who the figures on show are about, as the tooltips say it */
const SCOPE_WORDS = Object.freeze({ country: 'Pays', hamlet: 'Hameau visible' });

/**
 * The tooltip of a labour block's first row (the whole city's, or a class's): what the percentage is, then what it comes to in the scope on show.
 * The row's own icon says nothing else, so its own title goes.
 * @param {Element | null} row
 * @param {{ heading: string, definition: string, scope: 'country' | 'hamlet', slot: object }} words the slot is a `laborSlotFromStats` answer
 */
function setLaborRowWords(row, { heading, definition, scope, slot }) {
    if (!row) return;
    row.querySelector('.pop-detail-emoji, .pop-detail-labor-icon')?.removeAttribute('title');
    const lines = [heading, definition, `${SCOPE_WORDS[scope]} : ${laborFigures(slot)}`];
    row.setAttribute('title', lines.join('\n'));
    row.setAttribute('aria-label', lines.join('. '));
}

/**
 * What each cell under a labour percentage counts (the head count of people, or of posts), in full, for its tooltip. The two "unemployed" causes and the
 * two "posts" causes are the same counts read from the other side: the same people out of work are the same posts left empty when their skills do not match.
 */
const LABOR_CAUSE_WORDS = Object.freeze({
    unemployedNoSkill: { unit: 'chômeur', what: 'sans la compétence', hint: 'des postes sont vacants, mais ces chômeurs n\'ont pas la compétence demandée' },
    unemployedNoPosts: { unit: 'chômeur', what: 'sans poste libre', hint: 'aucun poste n\'est libre pour eux, même avec la compétence' },
    lackNoSkill: { unit: 'poste', what: 'vide faute de compétence', whatMany: 'vides faute de compétence', hint: 'des chômeurs sont disponibles, mais sans la compétence que ces postes demandent' },
    lackNoHands: { unit: 'poste', what: 'vide faute de bras', whatMany: 'vides faute de bras', hint: 'plus personne n\'est disponible pour occuper ces postes' },
    unemployedNoRoad: { unit: 'chômeur', what: 'sans route', hint: 'leur maison n\'est reliée à aucun lieu de travail' },
});

/**
 * @param {{ row: Element | null, value: Element | null }} nodes
 * @param {string} cause
 * @param {number} figure the count of the scope on show
 * @param {string} scopeTitle who the cell is about: the whole city, or a social category
 * @param {'country' | 'hamlet'} scope
 */
function setLaborCauseCell(nodes, cause, figure, scopeTitle, scope) {
    if (!nodes.row) return;
    setHudCount(nodes.value, figure);
    nodes.row.classList.toggle('is-zero', !(figure > 0));
    const { unit, what, whatMany = what, hint } = LABOR_CAUSE_WORDS[cause];
    const count = (n) => `${n} ${unit}${n === 1 ? '' : 's'} ${n === 1 ? what : whatMany}`;
    nodes.row.title = `${scopeTitle} : ${unit}s ${whatMany} — ${hint}`;
    nodes.row.setAttribute('aria-label', `${scopeTitle} — ${SCOPE_WORDS[scope].toLowerCase()} : ${count(figure)}. ${hint}`);
}

/**
 * @param {Record<string, { row: Element | null, value: Element | null }>} nodesByGroup
 * @param {Record<string, number> | null} counts the counts of the scope on show, by social group (null: not known yet, the cells stay as they are)
 */
function setGroupCounts(nodesByGroup, counts) {
    if (!counts) return;
    for (const group of allSocialGroups()) {
        const nodes = nodesByGroup[group];
        if (!nodes) continue;
        setHudCount(nodes.value, counts[group]);
    }
}

/**
 * What the population rail was last given, by kind, kept so that it can be drawn again for the other scope (hudPopRailScope.js) without asking the
 * game for its figures again. Each kind holds both scopes' figures; `drawRail*` writes the one of the scope on show.
 * @type {{ totals: object | null, famished: object | null, hungerRisk: object | null, group: object | null, resources: object | null }}
 */
const railHud = { totals: null, famished: null, hungerRisk: null, group: null, resources: null };

/** @returns {'country' | 'hamlet'} the scope on show */
function railScope() {
    return getHudPopRailScope();
}

function drawRailTotals() {
    const totals = railHud.totals?.[railScope()];
    if (!totals) return;
    setHudCount(displayPopTotal, totals.totalPop);
    setHudCount(displayPopActiveTotal, totals.workersCount);
}

function drawRailFamished() {
    const famished = railHud.famished?.[railScope()];
    if (!famished) return;
    setHudCount(displayDisettePop, famished.disette);
    setHudCount(displayHungerPop, famished.penurie);
}

function drawRailHungerRisk() {
    const risk = railHud.hungerRisk?.[railScope()];
    if (!risk) return;
    if (iconHungerRisk) {
        iconHungerRisk.textContent = HUNGER_RISK.icon;
        iconHungerRisk.title = `${HUNGER_RISK.label} : ${HUNGER_CAUSES.disette.label.toLowerCase()} ${risk.disette}, ${HUNGER_CAUSES.penurie.label.toLowerCase()} ${risk.penurie}`;
    }
    setHudCount(displayHungerRisk, risk.disette + risk.penurie);
}

function drawRailGroupHud() {
    const payload = railHud.group;
    if (!payload) return;
    const scope = railScope();
    const country = scope === 'country';
    // The payload carries both scopes (the game's read models); the rail shows one.
    const pick = (ofCountry, ofHamlet) => (country ? ofCountry : ofHamlet);

    setGroupCounts(popGroupPopNodes, pick(payload.popCountry ?? {}, payload.popHamlet ?? null));
    setGroupCounts(popGroupWorkerNodes, pick(payload.workersCountry ?? {}, payload.workersHamlet ?? null));

    const slot = laborSlotFromStats(pick(payload.laborCountry, payload.laborHamlet));
    setLaborCell(displayLabor, slot);
    setLaborRowWords(displayLabor?.closest('.pop-detail-labor-head'), {
        heading: 'Travail et chômage — toutes catégories',
        definition: 'Part des habitants qui cherchent un travail et n\'en ont pas, toutes catégories confondues. Le détail de ses causes est dessous.',
        scope,
        slot,
    });

    const groups = pick(payload.groupsCountry, payload.groupsHamlet);
    const groupCauses = pick(payload.groupCausesCountry, payload.groupCausesHamlet);
    for (const group of allSocialGroups()) {
        const nodes = popGroupLaborNodes[group];
        if (!nodes) continue;
        const groupTitle = getResidentialGroupTitle(group);
        const slotOfGroup = laborSlotFromStats(groups?.[group] ?? {});
        setLaborCell(nodes.value, slotOfGroup);
        setLaborRowWords(nodes.row, {
            heading: `Travail et chômage — ${groupTitle}`,
            definition: 'Part des habitants de cette catégorie qui cherchent un travail et n\'en ont pas. Le détail de ses causes est dessous.',
            scope,
            slot: slotOfGroup,
        });

        // The same situations under the class's own percentage, dimmed while they are at zero. The block is named as the catalog names the class.
        nodes.row?.closest('.pop-labor-group')?.setAttribute('aria-label', groupTitle);
        nodes.row?.closest('.pop-labor-group')?.querySelector('.pop-labor-causes')
            ?.setAttribute('aria-label', `Causes du chômage et des postes vides — ${groupTitle}`);
        for (const [cause, causeNodes] of Object.entries(popGroupLaborCauseNodes[group] ?? {})) {
            setLaborCauseCell(causeNodes, cause, groupCauses?.[group]?.[cause] ?? 0, groupTitle, scope);
        }
    }

    // Why people are out of work and why posts stay empty, the whole city's.
    const causes = pick(payload.causesCountry, payload.causesHamlet);
    for (const [cause, nodes] of Object.entries(popLaborCauseNodes)) {
        setLaborCauseCell(nodes, cause, causes?.[cause] ?? 0, 'Toutes catégories', scope);
    }
}

function drawRailResources() {
    const payload = railHud.resources;
    if (!payload) return;
    const country = railScope() === 'country';
    const city = country ? payload.cityCountry : payload.cityHamlet;
    const nature = country ? payload.natureCountry : payload.natureHamlet;
    for (const product of HUD_CITY_RESOURCE_PRODUCTS) {
        const nodes = popResourceCityNodes[product];
        if (!nodes) continue;
        setHudCount(nodes.value, city?.[product] ?? 0);
    }
    for (const product of HUD_NATURE_RESOURCE_PRODUCTS) {
        const nodes = popResourceNatureNodes[product];
        if (!nodes) continue;
        setHudCount(nodes.value, nature?.[product] ?? 0);
    }
}

function drawRail() {
    drawRailTotals();
    drawRailFamished();
    drawRailHungerRisk();
    drawRailGroupHud();
    drawRailResources();
}

// Another scope on show: the same figures, drawn for it.
window.addEventListener(HUD_POP_RAIL_SCOPE_EVENT, drawRail);

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
        railHud.totals = { country: { totalPop: totalPopulation, workersCount }, hamlet };
        drawRailTotals();
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
        railHud.famished = { country, hamlet };
        drawRailFamished();
    }

    /**
     * Updates the early warning of hunger (see HUNGER_RISK): the inhabitants whose house still misses part of its ration today. It is a forecast that moves
     * every day, apart from the famished counts (the month's consumption record); its tooltip tells the two causes apart.
     * @param {{ disette: number, penurie: number }} country
     * @param {{ disette: number, penurie: number }} [hamlet]
     */
    updateHungerRisk(country, hamlet = null) {
        railHud.hungerRisk = { country, hamlet };
        drawRailHungerRisk();
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
     *   groupCausesCountry?: Record<string, Record<string, number>>,
     *   groupCausesHamlet?: Record<string, Record<string, number>>,
     * }} payload
     */
    updateGroupHud(payload = {}) {
        railHud.group = payload;
        drawRailGroupHud();
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
        railHud.resources = payload;
        drawRailResources();
    }

    /**
     * Updates funds display
     * @param {number} funds - Funds amount
     */
    updateFunds(funds) {
        if (displayFunds) {
            showFunds(funds);
        }
    }

    /**
     * Initial HUD placeholders at city load (owned by GameUI, not scene).
     * The population rail's figures go back to "…" (not known yet, never 0); the caller syncs them right after (`syncPopRailHud`).
     * The funds are not reset here: they stay "…" until the treasury says what they are, and this runs after the scene is built,
     * possibly after they have arrived.
     */
    resetInitialHud() {
        // What the rail was given belongs to the city that went: a scope switch must not draw it again for the new one
        Object.assign(railHud, { totals: null, famished: null, hungerRisk: null, group: null, resources: null });
        for (const value of document.querySelectorAll('#hud-pop-rail .pop-detail-value')) {
            value.textContent = '…';
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

