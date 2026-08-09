// game.js
export const displayTime = document.querySelector('.info-panel .display-time');
export const displaySeason = document.querySelector('.info-panel .hud-season');
export const displaySpeed = document.querySelector('.hud-actions .display-speed');

// Initialiser l'affichage du temps avec "Chargement..." si l'élément existe
if (displayTime) {
    displayTime.textContent = 'Chargement...';
}
export const speedChangeIndicator = document.querySelector('.hud-actions .speed-change-indicator');
export const overOverlay = document.querySelector('#over-overlay');
export const overOverlayMessage = document.querySelector('#over-overlay .over-overlay__text');
export const infoObjectOverlay = document.querySelector('.info-building-overlay');
export const infoObjectCloseBtn = document.querySelector('.info-building-overlay .panel-close-btn');
export {
    buildingsObjects,
    houses,
    firstHouses,
    palaces,
    farms,
    commerce,
    factories,
} from '../../../shared/building-catalog/index.js';

export const infoPanelClock = document.querySelector('.info-panel .clock-box');
export const infoPanelClockIcon = document.querySelector('.info-panel svg.lucide-clock-4')
export const infoPanelNoClockIcon = document.querySelector('.info-panel svg.lucide-alarm-clock-off')
export const delayBox = document.querySelector('.info-panel .delay-box');
// scene.js
export const gameWindow = document.getElementById('game-window');
// HUD population — left vertical rail
const popHudRoot = '#hud-pop-rail';

export const displayPop = document.querySelector(`${popHudRoot} .pop-breakdown`);
export const displayPopTotal = document.querySelector(`${popHudRoot} .pop-total`);
export const displayPopActiveTotal = document.querySelector(`${popHudRoot} .pop-active-total`);
export const displayPopCitizens = document.querySelector(
    `${popHudRoot} .pop-segment--citizen .pop-segment-value`
);
export const displayPopElites = document.querySelector(
    `${popHudRoot} .pop-segment--elite .pop-segment-value`
);
export const displayPopServants = document.querySelector(
    `${popHudRoot} .pop-segment--servant .pop-segment-value`
);
export const displayHungerPop = document.querySelector(`${popHudRoot} .display-hunger-pop`);
export const displayDeathsPop = document.querySelector(`${popHudRoot} .display-deaths-pop`);
export const displayUnemployedPop = document.querySelector(`${popHudRoot} .display-unemployed-pop`);
export const displayUnemployedPct = document.querySelector(`${popHudRoot} .display-unemployed-pct`);
export const displayWorkerLack = document.querySelector(`${popHudRoot} .display-worker-lack`);
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