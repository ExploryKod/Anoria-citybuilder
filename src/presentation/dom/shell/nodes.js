import { getSuppliedCategories } from '../../../shared/building-catalog/resourceRoleQueries.js';
import { listDepositKinds } from '../../../shared/building-catalog/depositQueries.js';
import { renderHudResourceRows } from './hudResourceRows.js';
import { getResidentialGroupLabel } from './ResidentialGroupLabels.js';
// game.js
export const displayTime = document.querySelector('.info-panel .display-time');
export const displaySeason = document.querySelector('.info-panel .hud-season');
export const displaySpeed = document.querySelector('.hud-actions .display-speed');

// Initialiser l'affichage du temps avec "Chargement..." si l'élément existe
if (displayTime) {
    const visual = displayTime.querySelector('.display-time__visual');
    const sr = displayTime.querySelector('.display-time__sr');
    if (visual && sr) {
        visual.textContent = 'Chargement...';
        sr.textContent = 'Chargement...';
    } else {
        displayTime.textContent = 'Chargement...';
    }
}
export const speedChangeIndicator = document.querySelector('.hud-actions .speed-change-indicator');
export const overOverlay = document.querySelector('#over-overlay');
export const overOverlayMessage = document.querySelector('#over-overlay .over-overlay__text');
export const infoObjectOverlay = document.querySelector('.info-building-overlay');
export const infoObjectCloseBtn = document.querySelector('.info-building-overlay .panel-close-btn');
export {
    buildingsObjects,
    farms,
} from '../../../shared/building-catalog/index.js';
export { houses, commerce } from '../../three/assets/buildingCategories.js';

export const infoPanelClock = document.querySelector('.info-panel .clock-box');
export const infoPanelClockIcon = document.querySelector('.info-panel svg.lucide-clock-4')
export const infoPanelNoClockIcon = document.querySelector('.info-panel svg.lucide-alarm-clock-off')
export const delayBox = document.querySelector('.info-panel .delay-box');
// scene.js
export const gameWindow = document.getElementById('game-window');
// HUD population — left vertical rail
const popHudRoot = '#hud-pop-rail';

export const displayPopTotal = document.querySelector(`${popHudRoot} .pop-total.pop-detail-value--country`);
export const displayPopTotalHamlet = document.querySelector(`${popHudRoot} .pop-total--hamlet`);
export const displayPopActiveTotal = document.querySelector(`${popHudRoot} .pop-active-total.pop-detail-value--country`);
export const displayPopActiveTotalHamlet = document.querySelector(`${popHudRoot} .pop-active-total--hamlet`);
export const displayHungerRisk = document.querySelector(`${popHudRoot} .display-hunger-risk.pop-detail-value--country`);
export const displayHungerRiskHamlet = document.querySelector(`${popHudRoot} .display-hunger-risk--hamlet`);
export const iconHungerRisk = document.querySelector(`${popHudRoot} .pop-detail-icon--hunger-risk`);
export const displayDisettePop =document.querySelector(`${popHudRoot} .display-disette-pop.pop-detail-value--country`);
export const displayDisettePopHamlet = document.querySelector(`${popHudRoot} .display-disette-pop--hamlet`);
export const iconDisette = document.querySelector(`${popHudRoot} .pop-detail-icon--disette`);
export const iconPenurie = document.querySelector(`${popHudRoot} .pop-detail-hunger .pop-detail-icon`);
export const displayHungerPop =document.querySelector(`${popHudRoot} .display-hunger-pop.pop-detail-value--country`);
export const displayHungerPopHamlet = document.querySelector(`${popHudRoot} .display-hunger-pop--hamlet`);
export const displayDeathsPop = document.querySelector(`${popHudRoot} .display-deaths-pop`);
export const displayLaborCountry = document.querySelector(`${popHudRoot} .pop-labor-value--country`);
export const displayLaborHamlet = document.querySelector(`${popHudRoot} .pop-labor-value--hamlet`);

// The social categories the rail has a row for. The administrators have a population row only: they look for no job, so they have no workers or
// labour-market row (their rows in those metrics do not exist, and a missing row is left alone).
const POP_SOCIAL_GROUPS = ['artisans', 'merchants', 'scholars', 'administrators'];

/**
 * @param {'pop' | 'workers' | 'labor'} metric
 * @returns {Record<string, { row: Element | null, country: Element | null, hamlet: Element | null }>}
 */
function queryGroupMetricNodes(metric) {
    return Object.fromEntries(
        POP_SOCIAL_GROUPS.map((group) => {
            const row = document.querySelector(
                `${popHudRoot} [data-metric="${metric}"][data-social-group="${group}"]`
            );
            // The row is named by its category, as the catalog names it (the name of its house), whatever the page says.
            const emoji = row?.querySelector('.pop-detail-emoji');
            if (emoji) emoji.title = getResidentialGroupLabel(group);
            return [
                group,
                {
                    row,
                    country: row?.querySelector('.pop-detail-value--country') ?? null,
                    hamlet: row?.querySelector('.pop-detail-value--hamlet') ?? null,
                },
            ];
        })
    );
}

export const popGroupPopNodes = queryGroupMetricNodes('pop');
export const popGroupWorkerNodes = queryGroupMetricNodes('workers');
export const popGroupLaborNodes = queryGroupMetricNodes('labor');

const LABOR_CAUSES = ['unemployedNoSkill', 'unemployedNoPosts', 'unemployedNoRoad', 'lackNoSkill', 'lackNoHands'];

/** The rows that say why people are out of work and why posts are empty, by cause (see computeCityEmploymentSummary.js). */
export const popLaborCauseNodes = Object.fromEntries(
    LABOR_CAUSES.map((cause) => {
        const row = document.querySelector(`${popHudRoot} [data-metric="cause"][data-cause="${cause}"]`);
        return [
            cause,
            {
                row,
                country: row?.querySelector('.pop-detail-value--country') ?? null,
                hamlet: row?.querySelector('.pop-detail-value--hamlet') ?? null,
            },
        ];
    })
);

// Goods the citizens eat that a hub stores, straight from the catalog — no good is named here.
const POP_RESOURCE_CITY_PRODUCTS = getSuppliedCategories();
// Deposits of the map, straight from the catalog too.
const POP_RESOURCE_NATURE_PRODUCTS = listDepositKinds();

// The rows are made from those lists before they are looked up: the page markup names no good.
renderHudResourceRows({ root: popHudRoot, destination: 'city', panelId: 'hud-pop-panel-ressources-ville', products: POP_RESOURCE_CITY_PRODUCTS });
renderHudResourceRows({ root: popHudRoot, destination: 'nature', panelId: 'hud-pop-panel-ressources-nature', products: POP_RESOURCE_NATURE_PRODUCTS });

/**
 * @param {'city' | 'nature'} destination
 * @param {ReadonlyArray<string>} products
 * @returns {Record<string, { row: Element | null, country: Element | null, hamlet: Element | null }>}
 */
function queryResourceProductNodes(destination, products) {
    return Object.fromEntries(
        products.map((product) => {
            const row = document.querySelector(
                `${popHudRoot} [data-metric="resource"][data-destination="${destination}"][data-product="${product}"]`
            );
            return [
                product,
                {
                    row,
                    country: row?.querySelector('.pop-detail-value--country') ?? null,
                    hamlet: row?.querySelector('.pop-detail-value--hamlet') ?? null,
                },
            ];
        })
    );
}

export const popResourceCityNodes = queryResourceProductNodes('city', POP_RESOURCE_CITY_PRODUCTS);
export const popResourceNatureNodes = queryResourceProductNodes(
    'nature',
    POP_RESOURCE_NATURE_PRODUCTS
);
export const displayDelay = document.querySelector('.info-panel .display-delay');
export const displayDelayUI = document.querySelector('.delay-ui');
export const bulldozeSelected = document.querySelector('.bulldoze-btn');
export const displayFunds = document.querySelector('.info-panel .display-funds');
export const displayDebt = document.querySelector('.info-panel .display-debt');

// index.html
export const panelLayout = document.getElementById('panel-layout')
export const panelLayoutInner = document.getElementById('panel-inner')

export const loaderButton = document.getElementById('loader');

export const toolBarButtons = document.querySelectorAll('.toolbar-btn');

export const fasterButton = document.getElementById('faster-btn');
export const slowerButton = document.getElementById('slower-btn');

export const roadButton = document.getElementById('roads-btn');
export const bullDozeButton = document.getElementById('bulldoze-btn');
export const selectButton = document.getElementById('select-btn');
export const playerButton = document.getElementById('player-btn');
export const housesButton = document.getElementById('residential-btn');
export const infrastructureButton = document.getElementById('infrastructure-btn');
export const bookshopButton = document.getElementById('bookshop-btn');

export const panelLayoutCloseBtn = document.querySelector('.panel-layout .panel-close-btn')

export const pauseOverlay = document.querySelector('#pause-overlay');

export const pauseButton = document.getElementById('pause-btn');
export const playButton = document.getElementById('play-btn');
export const replayButton = document.getElementById('play-again-btn');
export const resetButton = document.getElementById('replay-btn');

export const objectiveModal = document.querySelector('.objective-modal');