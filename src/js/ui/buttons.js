import {
    bullDozeButton,
    displaySpeed,
    farmsButton,
    fasterButton,
    housesButton,
    infoObjectCloseBtn,
    infoObjectOverlay,
    loaderButton,
    marketButton,
    othersButton,
    panelLayout,
    panelLayoutCloseBtn,
    panelLayoutInner,
    pauseButton,
    pauseOverlay,
    playButton,
    replayButton,
    roadButton,
    selectButton,
    slowerButton,
    toolBarButtons
} from "./nodes.js";
import { createGame } from '../game/game.js';
import gameStore from "../stores/GameStore.js";
import housesStore from "../stores/HousesStore.js";
import AssetManager from "../meshs/AssetManager.js";

let buttonData;
let toolIds;

function updateSpeedDisplay() {
    const speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
    displaySpeed.textContent = `Vitesse du jeu: ${speed} ms`;
}

// Animation panel buttons
let animateButton = function(e) {

    e.preventDefault();
    //reset animation
    e.target.classList.remove('animate');

    e.target.classList.add('animate');
    setTimeout(function(){
        e.target.classList.remove('animate');
    },700);
};

const bubblyButtons = document.getElementsByClassName("bubbly-button");



function getButtonsUnactive() {
    toolBarButtons.forEach(button => {
        button.classList.remove('selected')
    })
}

function getButtonsDisabled() {
    toolBarButtons.forEach(button => {
        if(button.classList.contains('disabled')) {
            button.classList.remove('disabled')
        } else {
            button.classList.add('disabled')
        }

    })
}

function closeModal() {
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
    }
}

function toggleModal(e) {



    switch(e.target.dataset.group) {
        case 'residential':
            getButtonsUnactive()
            getButtonsDisabled()
            e.target.classList.toggle('selected')

            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                createHousesButtons(buttonData);
                panelLayout.classList.add('active');
            }

            break;
        case 'farms':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                loaderButton.classList.add('active');
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createFarmsButtons(buttonData);
            }
            break;
        case 'markets':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createMarketsStallsButtons(buttonData)
            }
            break;
        case 'others':
            getButtonsUnactive()
            getButtonsDisabled()
            panelLayoutInner.classList.add('loading-objects')
            if(!panelLayout.classList.contains('active')) {
                panelLayout.classList.add('active');
                e.target.classList.toggle('selected')
                createOthersButtons(buttonData)
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
    const svgBigHouse = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-castle"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/>
                        </svg>`
    let buttonsDuplicate = [];
    buttonData.filter(buttonInfo => houseToolIDs.includes(buttonInfo.tool)).forEach(buttonInfo => {
        if (!buttonsDuplicate.includes(buttonInfo.tool)) {
            buttonsDuplicate.push(buttonInfo.tool);
            if(buttonInfo.tool === 'House-2Story') {
                makeNewButton(buttonInfo, svgBigHouse)
            } else {
                makeNewButton(buttonInfo, svg)
            }

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
    const svgFarmTools = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-tractor"><path d="m10 11 11 .9a1 1 0 0 1 .8 1.1l-.665 4.158a1 1 0 0 1-.988.842H20"/><path d="M16 18h-5"/><path d="M18 5a1 1 0 0 0-1 1v5.573"/><path d="M3 4h8.129a1 1 0 0 1 .99.863L13 11.246"/><path d="M4 11V4"/><path d="M7 15h.01"/><path d="M8 10.1V4"/><circle cx="18" cy="18" r="2"/><circle cx="7" cy="15" r="5"/>
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
                makeNewButton(buttonInfo, svgFarmTools);
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

function makeNewButton(buttonInfo, svg="") {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = buttonInfo.tool;
    button.dataset.toolid = buttonInfo.tool;
    button.classList.add('toolbar-btn');
    button.classList.add('panel-btn');

    button.innerHTML = svg;

    button.addEventListener('click', (e) => {
        setActiveTool(e);
    });

    panelLayoutInner.appendChild(button);
    panelLayoutInner.classList.remove('loading-objects')
    loaderButton.classList.remove('active')
}


window.onload = async () => {

    // Root initialization
    const assetManager = new AssetManager();
    let selectedControl = document.getElementById('bulldoze-btn');
    await assetManager.initializeTerrains()
    await assetManager.initializeBuildings('houses')
    await assetManager.initializeBuildings('markets')
    await assetManager.initializeBuildings('farms')
    buttonData = assetManager.getButtonData();
    toolIds = assetManager.getToolIds();





    updateSpeedDisplay();

    for (let i = 0; i < bubblyButtons.length; i++) {
        bubblyButtons[i].addEventListener('click', animateButton, false);
    }

    infoObjectCloseBtn.addEventListener('click', () => {
        if(infoObjectOverlay.classList.contains('active')) {
            infoObjectOverlay.classList.remove('active')
            window.game.play()
        }
    })

    playButton.addEventListener('click', () => {
        pauseOverlay.classList.remove('active')
        window.game.play()
    })

    pauseButton.addEventListener('click', () => {
        pauseOverlay.classList.add('active')
        window.game.pause()
    })

    replayButton.addEventListener('click', () => {
        window.game.replay()
    })

    fasterButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        if(speed <= 0) {
            return
        }

        speed -= 500;
        localStorage.setItem('speed', speed.toString());
        window.game.startInterval()
        updateSpeedDisplay();
    });

    slowerButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        speed += 500;
        localStorage.setItem('speed', speed.toString());
        window.game.startInterval()
        updateSpeedDisplay();
    });

    bullDozeButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    selectButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    roadButton.addEventListener('click', (e) => {
        setActiveTool(e);
    })

    housesButton.addEventListener('click', toggleModal)

    farmsButton.addEventListener('click', toggleModal)

    marketButton.addEventListener('click', toggleModal)

    othersButton.addEventListener('click', toggleModal)

    panelLayoutCloseBtn.addEventListener('click', closeModal)
    window.game = createGame(housesStore, gameStore, assetManager);
    window.setActiveTool = (e) => {
        getButtonsUnactive(e)
        if(e.target.classList.contains('panel-btn')) {
            getButtonsDisabled()
        }
        toggleModal(e)
        selectedControl = e.currentTarget;
        selectedControl.classList.add('selected');
        window.game.setActiveToolId(e.target.dataset.toolid);
    }
}