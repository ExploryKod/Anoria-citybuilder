// game.js
export const displayTime = document.querySelector('.info-panel .display-time');
export const displaySpeed = document.querySelector('.info-panel .display-speed');
export const overOverlay = document.querySelector('#over-overlay');
export const overOverlayMessage = document.querySelector('#over-overlay .over-overlay__text');
export const infoObjectOverlay = document.querySelector('.info-building-overlay');
export const infoObjectCloseBtn = document.querySelector('.info-building-overlay .panel-close-btn');
export const buildingsObjects = [
    'House-Red', 'House-Purple', 'House-Blue', 'House-2Story', 'Market-Stall', 
    'Tombstone-1', 'Farm-Carrot', 'Farm-Wheat', 'Farm-Cabbage'
];

export const infoPanelClock = document.querySelector('.info-panel .clock-box');
export const infoPanelClockIcon = document.querySelector('.info-panel svg.lucide-clock-4')
export const infoPanelNoClockIcon = document.querySelector('.info-panel svg.lucide-alarm-clock-off')
export const delayBox = document.querySelector('.info-panel .delay-box');
// scene.js
export const gameWindow = document.getElementById('game-window');
export const displayPop = document.querySelector('.info-panel .display-pop');
export const displayDelay = document.querySelector('.info-panel .display-delay');
export const displayDelayUI = document.querySelector('.delay-ui');
export const bulldozeSelected = document.querySelector('.bulldoze-btn');
export const displayFunds = document.querySelector('.info-panel .display-funds');
export const displayDebt = document.querySelector('.info-panel .display-debt');
export const houses = ['House-Red', 'House-Purple', 'House-Blue', 'House-2Story'];
export const firstHouses = ['House-Red', 'House-Purple', 'House-Blue'];
export const bigHouses = ['House-2Story'];
export const farms = ['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage'];
export const commerce = ['Market-Stall'];

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
export const farmsButton = document.getElementById('farm-btn');
export const marketButton = document.getElementById('market-btn');
export const othersButton = document.getElementById('others-btn');

export const panelLayoutCloseBtn = document.querySelector('.panel-layout .panel-close-btn')

export const pauseOverlay = document.querySelector('#pause-overlay');

export const pauseButton = document.getElementById('pause-btn');
export const playButton = document.getElementById('play-btn');
export const replayButton = document.getElementById('play-again-btn');
