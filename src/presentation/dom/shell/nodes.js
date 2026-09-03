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
    palaces,
    farms,
    factories,
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

export const displayPop = document.querySelector(`${popHudRoot} .pop-breakdown`);
export const displayPopTotal = document.querySelector(`${popHudRoot} .pop-total.pop-detail-value--country`);
export const displayPopTotalHamlet = document.querySelector(`${popHudRoot} .pop-total--hamlet`);
export const displayPopActiveTotal = document.querySelector(`${popHudRoot} .pop-active-total.pop-detail-value--country`);
export const displayPopActiveTotalHamlet = document.querySelector(`${popHudRoot} .pop-active-total--hamlet`);
export const displayPopCitizens = document.querySelector(
    `${popHudRoot} .pop-segment--citizen .pop-segment-value.pop-detail-value--country`
);
export const displayPopCitizensHamlet = document.querySelector(
    `${popHudRoot} .pop-segment--citizen .pop-segment-value--hamlet`
);
export const displayPopElites = document.querySelector(
    `${popHudRoot} .pop-segment--elite .pop-segment-value.pop-detail-value--country`
);
export const displayPopElitesHamlet = document.querySelector(
    `${popHudRoot} .pop-segment--elite .pop-segment-value--hamlet`
);
export const displayPopServants = document.querySelector(
    `${popHudRoot} .pop-segment--servant .pop-segment-value.pop-detail-value--country`
);
export const displayPopServantsHamlet = document.querySelector(
    `${popHudRoot} .pop-segment--servant .pop-segment-value--hamlet`
);
export const displayHungerPop = document.querySelector(`${popHudRoot} .display-hunger-pop.pop-detail-value--country`);
export const displayHungerPopHamlet = document.querySelector(`${popHudRoot} .display-hunger-pop--hamlet`);
export const displayDeathsPop = document.querySelector(`${popHudRoot} .display-deaths-pop`);
export const displayLaborCountry = document.querySelector(`${popHudRoot} .pop-labor-value--country`);
export const displayLaborHamlet = document.querySelector(`${popHudRoot} .pop-labor-value--hamlet`);

const POP_SOCIAL_GROUPS = ['artisans', 'merchants', 'scholars'];

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

const POP_RESOURCE_CITY_PRODUCTS = [
    'wheat',
    'cabbage',
    'carrot',
    'wood',
    'furniture',
    'figs',
];
const POP_RESOURCE_COMMERCE_PRODUCTS = ['wood', 'furniture', 'figs'];
const POP_RESOURCE_NATURE_PRODUCTS = ['wood', 'rock', 'clay', 'iron', 'gold'];

/**
 * @param {'city' | 'commerce' | 'nature'} destination
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
export const popResourceCommerceNodes = queryResourceProductNodes(
    'commerce',
    POP_RESOURCE_COMMERCE_PRODUCTS
);
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
export const palacesButton = document.getElementById('palace-btn');
export const farmsButton = document.getElementById('farm-btn');
export const industryButton = document.getElementById('industry-btn');
export const marketButton = document.getElementById('market-btn');
export const infrastructureButton = document.getElementById('infrastructure-btn');
export const workshopButton = document.getElementById('workshop-btn');
export const bookshopButton = document.getElementById('bookshop-btn');

export const panelLayoutCloseBtn = document.querySelector('.panel-layout .panel-close-btn')

export const pauseOverlay = document.querySelector('#pause-overlay');

export const pauseButton = document.getElementById('pause-btn');
export const playButton = document.getElementById('play-btn');
export const replayButton = document.getElementById('play-again-btn');
export const resetButton = document.getElementById('replay-btn');

export const objectiveModal = document.querySelector('.objective-modal');