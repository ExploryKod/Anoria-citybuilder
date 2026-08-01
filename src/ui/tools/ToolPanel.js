import {
  loaderButton,
  panelLayout,
  panelLayoutInner,
  toolBarButtons,
} from '../shell/nodes.js';
import {
  getPopupManager,
  getButtonStateManager,
  invokeSetActiveTool,
  playGame,
} from '../../js/acl/appRuntime.js';

let buttonData;
let toolIds;

export function setToolPanelAssets(data, ids) {
  buttonData = data;
  toolIds = ids;
}

export function getButtonsUnactive() {
    toolBarButtons.forEach(button => {
        button.classList.remove('selected')
    })
}

export function getButtonsDisabled() {
    toolBarButtons.forEach(button => {
        if(button.classList.contains('disabled')) {
            button.classList.remove('disabled')
        } else {
            button.classList.add('disabled')
        }

    })
}

export function closeModal() {
    toolBarButtons.forEach(button => {
        if (button.classList.contains('disabled')) {
            button.classList.remove('disabled')
        }
    });
    toolBarButtons.forEach(button => {
        if(button.classList.contains('selected')) {
            button.classList.remove('selected')
        }
    })
    if(panelLayout.classList.contains('active')) {
        panelLayout.classList.remove('active');
        
        // Re-enable pointer events on 3D scene
        const canvas = document.querySelector('canvas');
        if (canvas) {
            canvas.classList.remove('pointer-events-disabled');
        }
        
        // Resume the game when closing building selection modal
        playGame();
    }
}

export function toggleModal(e) {
    // Get the button element (in case click was on SVG or other child)
    const button = e.target.closest('.toolbar-btn') || e.target;
    const group = button.dataset.group;

    switch(group) {
        case 'residential':
            getButtonsUnactive()
            getButtonsDisabled()
            button.classList.toggle('selected')

            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                createHousesButtons(buttonData);
                panelLayout.classList.add('active');
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }

            break;
        case 'farms':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createFarmsButtons(buttonData);
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        case 'industry':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createIndustryButtons(buttonData);
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        case 'markets':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createMarketsStallsButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        case 'infrastructure':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createInfrastructureButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        case 'public':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createPublicButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        case 'palaces':
            // Check if palace button is disabled
            if (getButtonStateManager() && !getButtonStateManager().isEnabled('palace-btn')) {
                console.warn('🏛️ Palace button is disabled');
                return; // Don't open panel if disabled
            }
            
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createPalacesButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        case 'nature':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                button.classList.toggle('selected')
                createNatureButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        case 'roads':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createRoadsButtons(buttonData)
                
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceOpenPopup('panel-layout');
                }
            } else {
                // Utiliser PopupManager pour gérer les événements
                if (getPopupManager()) {
                    getPopupManager().forceClosePopup('panel-layout');
                }
            }
            break;
        default:
            e.target.classList.toggle('selected')
            panelLayout.classList.remove('active');
            break;
    }
}

function createHousesButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const houseToolIDs = toolIds.houses || [];
    const svg =  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-home">
            <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>`
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => houseToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, svg)
        }

    });
}

function createPalacesButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const palaceToolIDs = toolIds.palaces || [];
    const svgBigHouse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>
                        </svg>`
    let buttonsDuplicate = [];
    const filteredButtons = buttonData.filter(buttonInfo => palaceToolIDs.includes(buttonInfo.tool));
    filteredButtons.forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, svgBigHouse)
        }

    });
}

function createMarketsStallsButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const marketsToolIDs = toolIds.markets || [];

    const svgCloth =  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shirt">
                    <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.47a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.47a2 2 0 0 0-1.34-2.23z"/>
                    </svg>`
    const svgFurniture = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-armchair"><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0Z"/><path d="M5 18v2"/><path d="M19 18v2"/>
                              </svg>`
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => marketsToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, svgCloth)
        }
    });
}

function createFarmsButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const farmToolIDs = toolIds.farms || [];

    const svgCarrot = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-carrot">
                        <path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/>
                        <path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/>
                    </svg>`
    const svgWheat = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-wheat">
                            <path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>
                            <path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/>
                            <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/>
                            <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>
                            <path d="M15.47 13.47 17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>
                            <path d="M19.47 9.47 21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z"/>
                        </svg>`
    const svgCabbage = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                            class="lucide lucide-leafy-green"><path d="M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22"/><path d="M2 22 17 7"/>
                            </svg>`
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => farmToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Farm-Carrot') {
                makeNewButton(buttonInfo, svgCarrot);
            } else if (buttonInfo.tool === 'Farm-Wheat') {
                makeNewButton(buttonInfo, svgWheat)
            } else if (buttonInfo.tool === 'Farm-Cabbage') {
                makeNewButton(buttonInfo, svgCabbage)
            } else {
                makeNewButton(buttonInfo, svgCabbage)
            }
        }
    });
}

function createIndustryButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const industryToolIDs = toolIds.industry || [];

    const svgWindmill = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cog"><circle cx="12" cy="12" r="3"/><path d="M12 5L7 7l2 5M12 5l5 2-2 5M7 17l2-5M17 17l-2-5M7 7L2 7l5 10M17 7l5 0-5 10"/></svg>`
    const svgBarn = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-warehouse"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>`
    const svgCrate = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package">
        <path d="m7.5 4.27 9 5.15"/>
        <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
        <path d="m3.3 7 8.7 5 8.7-5"/>
        <path d="M12 22V12"/>
    </svg>`
    
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => industryToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Windmill-001') {
                makeNewButton(buttonInfo, svgWindmill)
            } else if (buttonInfo.tool === 'Barn-001') {
                makeNewButton(buttonInfo, svgBarn)
            } else if (buttonInfo.tool === 'Crate-001') {
                makeNewButton(buttonInfo, svgCrate)
            } else {
                makeNewButton(buttonInfo, svgBarn)
            }
        }
    });
}

function createOthersButtons(buttonData) {
    panelLayoutInner.innerHTML = ''
    const tombToolIDs = toolIds.tombs || [];

    function makeTumbSVG(color) {
        return `<svg fill="none" height="24" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="m19 21v-11c0-3.86599-3.134-7-7-7-3.86599 0-7 3.13401-7 7v11m-2 0h18" stroke="${color}" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"/>
                </svg>`
    }

    let buttonsDuplicate = [];
    let tumbColors = [{"Tombstone-1": "#000", "Tombstone-2": "#7aee1a", "Tombstone-3": "#f3e90b"}]
    buttonData.filter(buttonInfo => tombToolIDs.includes(buttonInfo.tool)).forEach((buttonInfo, index) => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            makeNewButton(buttonInfo, makeTumbSVG(tumbColors[0][buttonInfo.tool]));
        }
    });
}

function createInfrastructureButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    const infrastructureToolIDs = toolIds.infrastructure || [];

    // Réutiliser des SVG existants
    const svgWell = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-droplet"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4.5-4-6.5c-.5 2-1.5 3.9-3 5.5S5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
    const svgFountain = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
    const svgStreetlight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-lamp"><path d="M8 2h8l4 10H4L8 2Z"/><path d="M12 12v6"/><path d="M8 22v-2c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v2H8Z"/></svg>`;

    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => infrastructureToolIDs.includes(buttonInfo.tool) && buttonInfo.tool !== 'StonePath-001').forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Well-001') {
                makeNewButton(buttonInfo, svgWell);
            } else if (buttonInfo.tool === 'Fountain-001') {
                makeNewButton(buttonInfo, svgFountain);
            } else if (buttonInfo.tool === 'Streetlight-001') {
                makeNewButton(buttonInfo, svgStreetlight);
            } else {
                makeNewButton(buttonInfo, svgWell); // Default
            }
        }
    });
}

function createRoadsButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    const infrastructureToolIDs = toolIds.infrastructure || [];

    // Different SVG icons for different road types
    const svgRoadStraight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="8" y1="8" x2="8" y2="10"/><line x1="16" y1="8" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="16"/><line x1="16" y1="14" x2="16" y2="16"/></svg>`;
    const svgRoadRight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L12 12 L22 12"/><line x1="8" y1="8" x2="8" y2="10"/><line x1="14" y1="16" x2="16" y2="16"/></svg>`;
    const svgRoadLeft = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 L12 12 L2 12"/><line x1="16" y1="8" x2="16" y2="10"/><line x1="8" y1="16" x2="6" y2="16"/></svg>`;
    const svgRoadCross = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg>`;
    const svgModernRoad = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="10" x2="9" y2="14"/><line x1="15" y1="10" x2="15" y2="14"/></svg>`;

    // Add roads button first (modern road using texture material)
    if (infrastructureToolIDs.includes('roads')) {
        makeNewButton({
            text: 'Modern Road',
            tool: 'roads',
            group: 'Road'
        }, svgModernRoad);
    }

    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => infrastructureToolIDs.includes(buttonInfo.tool) && buttonInfo.tool.startsWith('StonePath-')).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            
            // Choose appropriate icon based on road type
            let svg = svgRoadStraight;
            if (buttonInfo.tool === 'StonePath-Right-001') {
                svg = svgRoadRight;
            } else if (buttonInfo.tool === 'StonePath-Left-001') {
                svg = svgRoadLeft;
            } else if (buttonInfo.tool === 'StonePath-Cross-001') {
                svg = svgRoadCross;
            }
            
            makeNewButton(buttonInfo, svg);
        }
    });
}

function createPublicButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    
    // Check if toolIds is available
    if (!toolIds || !toolIds.public) {
        console.warn('[createPublicButtons] toolIds not initialized or public category missing');
        panelLayoutInner.classList.remove('loading-objects');
        return;
    }
    
    const publicToolIDs = toolIds.public || [];
    const svgBigHouse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>
                        </svg>`

    let buttonsDuplicate = [];
    let foundChurch = false;
    
    // Filter to only show Church-002 (BookShop-001 will be autonomous button)
    buttonData.filter(buttonInfo => {
        // Check if it's in public category and is Church-002
        return publicToolIDs.includes(buttonInfo.tool) && buttonInfo.tool === 'Church-002';
    }).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Church-002') {
                makeNewButton(buttonInfo, svgBigHouse);
                foundChurch = true;
            }
        }
    });
    
    // If Church-002 not found in buttonData, create it manually from toolIds
    if (!foundChurch && publicToolIDs.includes('Church-002')) {
        console.warn('[createPublicButtons] Church-002 not in buttonData, creating manually');
        makeNewButton({
            text: 'Church',
            tool: 'Church-002',
            group: 'Public'
        }, svgBigHouse);
    }
    
    panelLayoutInner.classList.remove('loading-objects');
}

function createNatureButtons(buttonData) {
    panelLayoutInner.innerHTML = '';
    const natureToolIDs = toolIds.nature || [];

    const svgTree = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trees">
        <path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-2.1-5.2l.3-.3h.2a2.5 2.5 0 0 1 2-4l.4-.4a2 2 0 0 1 2.9-.2 1 1 0 0 0 1.4 0"/>
        <path d="M14 10v.2A3 3 0 0 0 15.1 16H19a3 3 0 0 0 2.1-5.2l-.3-.3h-.2a2.5 2.5 0 0 0-2-4l-.4-.4a2 2 0 0 0-2.9-.2 1 1 0 0 1-1.4 0"/>
        <path d="M12 22v-8"/>
        <path d="M12 2v4"/>
    </svg>`;
    
    const svgBoulder = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-mountain">
        <path d="m8 3 4 8 5-5 5 15H2L8 3z"/>
    </svg>`;

    const svgRoad = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-route">
        <circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/>
        <circle cx="18" cy="5" r="3"/>
    </svg>`;

    const filteredButtons = buttonData.filter(buttonInfo => natureToolIDs.includes(buttonInfo.tool));

    let buttonsDuplicate = [];
    filteredButtons.forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if (buttonInfo.tool === 'Boulder-001') {
                makeNewButton(buttonInfo, svgBoulder);
            } else {
                makeNewButton(buttonInfo, svgTree);
            }
        }
    });
}

function makeNewButton(buttonInfo, svg="") {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = buttonInfo.tool;
    button.dataset.toolid = buttonInfo.tool;
    button.classList.add('toolbar-btn');
    button.classList.add('panel-btn');

    button.innerHTML = svg;

    button.addEventListener('click', (e) => {
        // Check if button is disabled before allowing click
        if (getButtonStateManager() && getButtonStateManager().isEnabled(buttonInfo.tool)) {
            invokeSetActiveTool(e);
        }
    });

    panelLayoutInner.appendChild(button);
    panelLayoutInner.classList.remove('loading-objects')
    loaderButton.classList.remove('active')
    
    // Register button with ButtonStateManager if available
    if (getButtonStateManager()) {
        getButtonStateManager().registerButton(buttonInfo.tool, button);
    }
}
