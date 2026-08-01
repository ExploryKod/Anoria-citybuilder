import {
    bullDozeButton,
    displaySpeed,
    speedChangeIndicator,
    farmsButton,
    industryButton,
    fasterButton,
    housesButton,
    palacesButton,
    infrastructureButton,
    infoObjectCloseBtn,
    infoObjectOverlay,
    loaderButton,
    marketButton,
    panelLayout,
    panelLayoutCloseBtn,
    panelLayoutInner,
    pauseButton,
    pauseOverlay,
    playButton,
    replayButton,
    resetButton,
    roadButton,
    selectButton,
    slowerButton,
    toolBarButtons,
    workshopButton
} from "./nodes.js";
import {
    registerAppService,
    registerAppFunction,
    getGame,
    getGameScene,
    playGame,
    pauseGame,
    replayGame,
    getPopupManager,
    getButtonStateManager,
    invokeSetActiveTool,
} from '../acl/appRuntime.js';
import { createGame } from '../../presentation/three/game.js';
import { getOrCreateGameSessionContext } from "../acl/gameSession.js";
import AssetManager from '../../presentation/three/meshs/AssetManager.js';
import { initRealtimeBudgetPopup } from "./budget/RealtimeBudgetManager.js";
import { initBudgetStatesPopup, refreshBudgetStatesModal } from "./budget/BudgetStatesManager.js";
import { initBalanceSheetPopup } from './budget/BalanceSheetPanel.js';
import { initCityMapPopup } from './city-map/CityMapPanel.js';
import { initLoansPopup, updateLoansDisplay, contractLoan, loadActiveLoans, processLoanPayments, initLoanPaymentSystem } from "./loans/LoansManager.js";
import { initJournalPopup, loadJournalEntries, exportJournalToJSON, exportJournalToPDF } from "./journal/JournalManager.js";
import { initFoodTraceabilityPopup, initializeFoodTraceabilityTabs, loadFoodTraceabilityEntries, loadFoodCharts } from "./food-traceability/FoodTraceabilityManager.js";
import { initUrbanAdviceCenter } from "./urban-advice/UrbanAdviceManager.js";
import {
  setToolPanelAssets,
  getButtonsUnactive,
  getButtonsDisabled,
  closeModal,
  toggleModal,
} from './tools/ToolPanel.js';
import { showCitySizeSelection } from './boot/CitySizeSelectionModal.js';

window.onload = async () => {

    // Root initialization
    const assetManager = new AssetManager();
    let selectedControl = document.getElementById('bulldoze-btn');

    registerAppFunction('setActiveTool', (e) => {
        getButtonsUnactive(e);
        if (e.target.classList.contains('panel-btn')) {
            getButtonsDisabled();
            closeModal();

            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.classList.remove('pointer-events-disabled');
                canvas.style.pointerEvents = 'auto';
                canvas.style.touchAction = 'none';
                canvas.classList.add('canvas-interactive');
            }

            if (getPopupManager()) {
                getPopupManager().forceClosePopup('panel-layout');
            }
        } else if (e.target.dataset.toolid) {
            // Toolbar buttons with data-toolid — no modal
        } else {
            toggleModal(e);
        }
        selectedControl = e.currentTarget;
        selectedControl.classList.add('selected');
        getGame()?.setActiveToolId(e.target.dataset.toolid);
    });
    
    // OPTIMIZATION: Break up asset loading into smaller chunks to reduce TBT
    // Load critical assets first, then defer the rest
    await assetManager.initializeTerrains();
    
    // OPTIMIZATION: Use requestIdleCallback to defer house loading slightly
    // This prevents blocking the main thread for too long (>50ms chunks)
    const loadHouses = async () => {
        await assetManager.initializeBuildings('houses'); // Critical for gameplay
    };
    
    // Load houses in next idle period to reduce TBT
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(loadHouses, { timeout: 500 });
    } else {
        setTimeout(loadHouses, 0);
    }
    
    // OPTIMIZATION: Defer non-critical assets using requestIdleCallback
    // This prevents blocking the main thread during initial load
    const loadNonCriticalAssets = () => {
        Promise.all([
            assetManager.initializeBuildings('palaces'),
            assetManager.initializeBuildings('markets'),
            assetManager.initializeBuildings('farms'),
            assetManager.initializeBuildings('industry'),  // Includes crates now
            assetManager.initializeBuildings('infrastructure'),
            assetManager.initializeBuildings('public'),
            assetManager.initializeBuildings('nature'),
            assetManager.initializeBuildings('workshop')
        ]).catch(() => {
            // Silently fail - assets will load when needed
        });
    };
    
    // Use requestIdleCallback if available, otherwise setTimeout
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(loadNonCriticalAssets, { timeout: 3000 });
    } else {
        setTimeout(loadNonCriticalAssets, 500);
    }
    
    // OPTIMIZATION: Defer UI initialization to reduce TBT
    // These operations can wait until browser is idle
    const initUI = () => {
        setToolPanelAssets(assetManager.getButtonData(), assetManager.getToolIds());

        updateSpeedDisplay();
    };
    
    // Defer UI initialization to reduce TBT
    if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(initUI, { timeout: 1000 });
    } else {
        setTimeout(initUI, 100);
    }
    
    // Initialize button states for game start
    if (getButtonStateManager()) {
        // Register category buttons
        const palaceBtn = document.getElementById('palace-btn');
        if (palaceBtn) {
            getButtonStateManager().registerButton('palace-btn', palaceBtn);
        }
        
        const infrastructureBtn = document.getElementById('infrastructure-btn');
        if (infrastructureBtn) {
            getButtonStateManager().registerButton('infrastructure-btn', infrastructureBtn);
        }
        
        const workshopBtn = document.getElementById('workshop-btn');
        if (workshopBtn) {
            getButtonStateManager().registerButton('workshop-btn', workshopBtn);
        }
        
        // Disable initial unavailable buildings
        // All buttons are now enabled by default
        // Disable functionality is kept for future use
        const initialDisabledBuildings = [
            // Empty array - all buttons enabled
        ];
        
        initialDisabledBuildings.forEach(buildingId => {
            const button = document.getElementById(buildingId);
            if (button) {
                getButtonStateManager().disable(buildingId);
            } else {
                console.warn(`⚠️ Button ${buildingId} not found in DOM, will be disabled when created`);
            }
        });
    } else {
        console.warn('⚠️ ButtonStateManager not available');
    }

    for (let i = 0; i < bubblyButtons.length; i++) {
        bubblyButtons[i].addEventListener('click', animateButton, false);
    }

    infoObjectCloseBtn.addEventListener('click', () => {
        if(infoObjectOverlay.classList.contains('active')) {
            infoObjectOverlay.classList.remove('active')
            
            // Re-enable pointer events on 3D scene when info overlay closes
            const canvas = document.querySelector('canvas');
            if (canvas) {
                canvas.classList.remove('pointer-events-disabled');
            }
            
            // Re-enable OrbitControls when modal closes
            // Try to access scene through various paths
            let sceneObj = getGameScene();
            if (sceneObj && sceneObj.controls) {
                sceneObj.controls.enabled = true;
            }
            if (sceneObj && sceneObj.suppressInput) {
                sceneObj.suppressInput(200);
            }
            
            playGame()
        }
    })

    playButton.addEventListener('click', () => {
        pauseOverlay.classList.remove('active')
        
        // Utiliser PopupManager pour gérer les événements
        if (getPopupManager()) {
            getPopupManager().forceClosePopup('pause-overlay');
        }
        
        playGame()
    })

    pauseButton.addEventListener('click', () => {
        pauseOverlay.classList.add('active')
        
        // Utiliser PopupManager pour gérer les événements
        if (getPopupManager()) {
            getPopupManager().forceOpenPopup('pause-overlay');
        }
        
        pauseGame()
    })

    replayButton.addEventListener('click', () => {
        replayGame()
    })

    resetButton.addEventListener('click', () => {
        // Show confirmation modal
        showResetConfirmModal();
    })

    // Function to show reset confirmation modal
    function showResetConfirmModal() {
        const modal = document.getElementById('reset-confirm-panel');
        if (!modal) {
            console.error('Reset confirm panel not found');
            return;
        }
        
        // Prevent duplicate listeners
        if (modal.classList.contains('listeners-attached')) {
            modal.classList.add('visible');
            return;
        }
        
        modal.classList.add('visible');
        modal.classList.add('listeners-attached');
        
        // Get buttons
        const cancelBtn = modal.querySelector('.reset-confirm-cancel-btn');
        const resetBtn = modal.querySelector('.reset-confirm-reset-btn');
        
        // Cancel button
        cancelBtn.addEventListener('click', () => {
            modal.classList.remove('visible');
        });
        
        // Reset button
        resetBtn.addEventListener('click', async () => {
            modal.classList.remove('visible');
            await performReset();
        });
        
        // Close on Escape
        const handleEscape = (e) => {
            if (e.key === 'Escape' && modal.classList.contains('visible')) {
                modal.classList.remove('visible');
            }
        };
        document.addEventListener('keydown', handleEscape);
    }

    /**
     * Reset localStorage completely - this is the single place where localStorage is cleared
     * Removes all items individually first, then calls clear() to ensure complete cleanup
     */
    function resetLocalStorage() {
        // Remove all items individually first to ensure complete cleanup
        const localStorageKeys = Object.keys(localStorage);
        localStorageKeys.forEach(key => {
            localStorage.removeItem(key);
        });
        // Then clear all remaining items
        localStorage.clear();
    }

    // Function to perform the actual reset
    async function performReset() {
        // Hard reload - unregister service worker and clear caches
        try {
            // Unregister service worker
            if ('serviceWorker' in navigator) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (let registration of registrations) {
                    await registration.unregister();
                }
            }
            
            // Clear all caches
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                for (let cacheName of cacheNames) {
                    await caches.delete(cacheName);
                }
            }
            
            // Clear localStorage completely - using dedicated function
            resetLocalStorage();
            
            // Clear IndexedDB - for all databases
            if ('indexedDB' in window) {
                indexedDB.databases().then(databases => {
                    databases.forEach(db => {
                        if (db.name) {
                            indexedDB.deleteDatabase(db.name);
                        }
                    });
                });
            }
            
            // Small delay to ensure localStorage clear is fully processed before reload
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Reload the page
            window.location.reload(true);
        } catch (error) {
            console.error('Error during reset:', error);
            // Fallback: just reload
            window.location.reload(true);
        }
    }

    fasterButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        const previousSpeed = speed;
        
        // Apply speed limits: minimum 500ms, maximum 20,000ms
        speed = Math.max(500, speed - 500);
        
        localStorage.setItem('speed', speed.toString());
        getGame()?.startInterval()
        
        // Show '+' indicator badge if speed actually changed
        const changeDirection = (speed !== previousSpeed) ? '+' : '';
        updateSpeedDisplay(changeDirection);
        
        // Hide indicator after 1 second
        if (changeDirection) {
            setTimeout(() => {
                speedChangeIndicator.classList.remove('active');
            }, 1000);
        }
    });

    slowerButton.addEventListener('click', () => {
        let speed = parseInt(localStorage.getItem('speed'), 10) || 3000;
        const previousSpeed = speed;
        
        // Apply speed limits: minimum 500ms, maximum 20,000ms
        speed = Math.min(20000, speed + 500);
        
        localStorage.setItem('speed', speed.toString());
        getGame()?.startInterval()
        
        // Show '−' indicator badge if speed actually changed
        const changeDirection = (speed !== previousSpeed) ? '−' : '';
        updateSpeedDisplay(changeDirection);
        
        // Hide indicator after 1 second
        if (changeDirection) {
            setTimeout(() => {
                speedChangeIndicator.classList.remove('active');
            }, 1000);
        }
    });

    bullDozeButton.addEventListener('click', (e) => {
        invokeSetActiveTool(e);
    })

    selectButton.addEventListener('click', (e) => {
        invokeSetActiveTool(e);
    })

    if (roadButton) {
        roadButton.addEventListener('click', (e) => {
            invokeSetActiveTool(e);
        });
    }

    housesButton.addEventListener('click', (e) => {
        invokeSetActiveTool(e);
    })
    
    palacesButton.addEventListener('click', (e) => {
        // Check if palace button is disabled before toggling modal
        if (getButtonStateManager() && !getButtonStateManager().isEnabled('palace-btn')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        toggleModal(e);
    })

    farmsButton.addEventListener('click', toggleModal)
    
    industryButton.addEventListener('click', toggleModal)

    marketButton.addEventListener('click', (e) => {
        invokeSetActiveTool(e);
    })
    
    infrastructureButton.addEventListener('click', (e) => {
        // Check if infrastructure button is disabled before toggling modal
        if (getButtonStateManager() && !getButtonStateManager().isEnabled('infrastructure-btn')) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
        toggleModal(e);
    })
    
    const bookshopButton = document.getElementById('bookshop-btn');
    if (bookshopButton) {
        bookshopButton.addEventListener('click', (e) => {
            invokeSetActiveTool(e);
        });
    }

    if (workshopButton) {
        workshopButton.addEventListener('click', (e) => {
            invokeSetActiveTool(e);
        });
    }

    const natureButton = document.getElementById('nature-btn');
    if (natureButton) {
        natureButton.addEventListener('click', toggleModal);
    }

    panelLayoutCloseBtn.addEventListener('click', closeModal)
    
    // Legend dropdown functionality
    const legendToggle = document.getElementById('legend-toggle');
    const legendDropdown = document.getElementById('legend-dropdown');
    const commandToggle = document.getElementById('command-toggle');
    const commandDropdown = document.getElementById('command-dropdown');
    const financeToggle = document.getElementById('finance-toggle');
    const financeDropdown = document.getElementById('finance-dropdown');
    
    if (legendToggle && legendDropdown) {
        legendToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyHidden = legendDropdown.classList.contains('hidden');
            
            // Close other dropdowns if they're open
            if (commandDropdown && !commandDropdown.classList.contains('hidden')) {
                commandDropdown.classList.add('hidden');
            }
            if (financeDropdown && !financeDropdown.classList.contains('hidden')) {
                financeDropdown.classList.add('hidden');
            }
            
            // Toggle legend dropdown
            if (isCurrentlyHidden) {
                legendDropdown.classList.remove('hidden');
            } else {
                legendDropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.legend-dropdown-container')) {
                legendDropdown.classList.add('hidden');
            }
        });
    }

    // Finance dropdown functionality
    if (financeToggle && financeDropdown) {
        financeToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyHidden = financeDropdown.classList.contains('hidden');
            
            // Close other dropdowns if they're open
            if (legendDropdown && !legendDropdown.classList.contains('hidden')) {
                legendDropdown.classList.add('hidden');
            }
            if (commandDropdown && !commandDropdown.classList.contains('hidden')) {
                commandDropdown.classList.add('hidden');
            }
            
            // Toggle finance dropdown
            if (isCurrentlyHidden) {
                financeDropdown.classList.remove('hidden');
            } else {
                financeDropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.finance-dropdown-container')) {
                financeDropdown.classList.add('hidden');
            }
        });
    }
    
    // Command dropdown functionality
    if (commandToggle && commandDropdown) {
        commandToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isCurrentlyHidden = commandDropdown.classList.contains('hidden');
            
            // Close other dropdowns if they're open
            if (legendDropdown && !legendDropdown.classList.contains('hidden')) {
                legendDropdown.classList.add('hidden');
            }
            if (financeDropdown && !financeDropdown.classList.contains('hidden')) {
                financeDropdown.classList.add('hidden');
            }
            
            // Toggle command dropdown
            if (isCurrentlyHidden) {
                commandDropdown.classList.remove('hidden');
            } else {
                commandDropdown.classList.add('hidden');
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.command-dropdown-container')) {
                commandDropdown.classList.add('hidden');
            }
        });
    }
    
    // Mobile toolbar/camera toggle functionality
    const toolbarMobileToggle = document.getElementById('toolbar-mobile-toggle');
    const mobileControlsToggle = document.getElementById('mobile-controls-toggle');
    const toolbarElement = document.getElementById('toolbar');
    const mobileControlsElement = document.getElementById('mobile-camera-controls');
    const narrowToolbarQuery = window.matchMedia('(max-width: 768px)');
    const landscapeToolbarQuery = window.matchMedia('(max-width: 1024px) and (orientation: landscape)');

    const closeMobileToolbar = () => {
        if (!toolbarElement) return;
        toolbarElement.classList.remove('mobile-visible');
        toolbarElement.classList.add('mobile-hidden');
        if (toolbarMobileToggle) {
            toolbarMobileToggle.classList.remove('active');
            toolbarMobileToggle.setAttribute('aria-pressed', 'false');
        }
    };

    const closeMobileControls = () => {
        if (!mobileControlsElement) return;
        mobileControlsElement.classList.remove('mobile-visible');
        mobileControlsElement.classList.add('mobile-hidden');
        if (mobileControlsToggle) {
            mobileControlsToggle.classList.remove('active');
            mobileControlsToggle.setAttribute('aria-pressed', 'false');
        }
    };

    const isMobileViewport = () => {
        return narrowToolbarQuery.matches || landscapeToolbarQuery.matches;
    };

    const applyToolbarResponsiveState = () => {
        if (!toolbarElement) return;
        if (isMobileViewport()) {
            if (!toolbarElement.classList.contains('mobile-visible')) {
                toolbarElement.classList.add('mobile-hidden');
            }
        } else {
            toolbarElement.classList.remove('mobile-hidden');
            toolbarElement.classList.remove('mobile-visible');
            if (toolbarMobileToggle) {
                toolbarMobileToggle.classList.remove('active');
                toolbarMobileToggle.setAttribute('aria-pressed', 'false');
            }
        }
    };

    const applyMobileControlsResponsiveState = () => {
        if (!mobileControlsElement) return;
        if (isMobileViewport()) {
            if (!mobileControlsElement.classList.contains('mobile-visible')) {
                mobileControlsElement.classList.add('mobile-hidden');
            }
        } else {
            mobileControlsElement.classList.remove('mobile-hidden');
            mobileControlsElement.classList.remove('mobile-visible');
            if (mobileControlsToggle) {
                mobileControlsToggle.classList.remove('active');
                mobileControlsToggle.setAttribute('aria-pressed', 'false');
            }
        }
    };

    if (toolbarMobileToggle && toolbarElement) {
        toolbarMobileToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isMobileViewport()) {
                // On desktop, no need to toggle manually
                return;
            }
            const willShow = !toolbarElement.classList.contains('mobile-visible');
            if (willShow) {
                toolbarElement.classList.add('mobile-visible');
                toolbarElement.classList.remove('mobile-hidden');
            } else {
                closeMobileToolbar();
            }
            toolbarMobileToggle.classList.toggle('active', willShow);
            toolbarMobileToggle.setAttribute('aria-pressed', willShow ? 'true' : 'false');
        });
    }

    document.addEventListener('click', (e) => {
        if (!toolbarElement || !toolbarElement.classList.contains('mobile-visible')) {
            return;
        }
        if (!isMobileViewport()) {
            return;
        }
        if (!e.target.closest('#toolbar') && !e.target.closest('#toolbar-mobile-toggle')) {
            closeMobileToolbar();
        }
    });

    // Make toolbar draggable on mobile only
    const toolbarDragHeader = document.getElementById('toolbarheader');
    if (toolbarDragHeader && toolbarElement) {
        // Function to make element draggable (adapted from W3Schools)
        function dragElement(elmnt) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

            // Helper function to check if target is a button or interactive element
            function isInteractiveElement(target) {
                if (!target) return false;
                // Check if it's a button, link, or inside a button container
                return target.tagName === 'BUTTON' ||
                       target.tagName === 'A' ||
                       target.closest('.toolbar-btn') !== null ||
                       target.closest('.toolbar__buttons') !== null ||
                       target.closest('.toolbar__container') !== null;
            }

            // Handle icon can always drag
            if (toolbarDragHeader) {
                toolbarDragHeader.onmousedown = dragMouseDown;
                toolbarDragHeader.ontouchstart = dragTouchStart;
            }

            // Allow dragging from anywhere on toolbar except buttons
            elmnt.addEventListener('mousedown', (e) => {
                // Don't drag if clicking on a button or interactive element
                if (isInteractiveElement(e.target)) return;
                dragMouseDown(e);
            });

            elmnt.addEventListener('touchstart', (e) => {
                // Don't drag if touching a button or interactive element
                if (isInteractiveElement(e.target)) return;
                dragTouchStart(e);
            });

            function dragMouseDown(e) {
                e.preventDefault();
                e.stopPropagation();
                // Get the mouse cursor position at startup
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                // Call a function whenever the cursor moves
                document.onmousemove = elementDrag;
            }

            function dragTouchStart(e) {
                e.preventDefault();
                e.stopPropagation();
                const touch = e.touches[0];
                pos3 = touch.clientX;
                pos4 = touch.clientY;
                document.ontouchend = closeDragElement;
                document.ontouchmove = elementDragTouch;
            }

            function elementDrag(e) {
                e.preventDefault();
                // Calculate the new cursor position
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                // Get actual visual position (accounting for transform)
                const rect = elmnt.getBoundingClientRect();
                // Set the element's new position relative to viewport
                const newTop = (rect.top - pos2);
                const newLeft = (rect.left - pos1);
                elmnt.style.top = newTop + "px";
                elmnt.style.left = newLeft + "px";
                // Remove transform, bottom, and percentage-based positioning to allow manual positioning
                elmnt.style.transform = "none";
                elmnt.style.bottom = "auto";
            }

            function elementDragTouch(e) {
                e.preventDefault();
                const touch = e.touches[0];
                // Calculate the new touch position
                pos1 = pos3 - touch.clientX;
                pos2 = pos4 - touch.clientY;
                pos3 = touch.clientX;
                pos4 = touch.clientY;
                // Get actual visual position (accounting for transform)
                const rect = elmnt.getBoundingClientRect();
                // Set the element's new position relative to viewport
                const newTop = (rect.top - pos2);
                const newLeft = (rect.left - pos1);
                elmnt.style.top = newTop + "px";
                elmnt.style.left = newLeft + "px";
                // Remove transform, bottom, and percentage-based positioning to allow manual positioning
                elmnt.style.transform = "none";
                elmnt.style.bottom = "auto";
            }

            function closeDragElement() {
                // Stop moving when mouse/touch is released
                document.onmouseup = null;
                document.onmousemove = null;
                document.ontouchend = null;
                document.ontouchmove = null;
            }
        }

        // Initialize dragging on all breakpoints
        dragElement(toolbarElement);
    }

    // Toolbar tab switching
    const toolbarTabs = document.querySelectorAll('.toolbar-tab');
    const toolbarSections = document.querySelectorAll('.toolbar-section');

    if (toolbarTabs.length > 0 && toolbarSections.length > 0) {
        toolbarTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                const targetSection = tab.getAttribute('data-tab');
                
                // Update active tab
                toolbarTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Update active section
                toolbarSections.forEach(section => {
                    if (section.getAttribute('data-section') === targetSection) {
                        section.classList.add('active');
                    } else {
                        section.classList.remove('active');
                    }
                });
            });
        });
    }

    if (mobileControlsToggle && mobileControlsElement) {
        mobileControlsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!isMobileViewport()) {
                return;
            }
            const isVisible = mobileControlsElement.classList.contains('mobile-visible');
            if (isVisible) {
                closeMobileControls();
            } else {
                mobileControlsElement.classList.remove('mobile-hidden');
                mobileControlsElement.classList.add('mobile-visible');
                mobileControlsToggle.classList.add('active');
                mobileControlsToggle.setAttribute('aria-pressed', 'true');
            }
        });
    }

    document.addEventListener('click', (e) => {
        if (!mobileControlsElement || !mobileControlsElement.classList.contains('mobile-visible')) {
            return;
        }
        if (!isMobileViewport()) {
            return;
        }
        if (!e.target.closest('#mobile-camera-controls') && !e.target.closest('#mobile-controls-toggle')) {
            closeMobileControls();
        }
    });

    const handleResponsiveChange = () => {
        applyToolbarResponsiveState();
        applyMobileControlsResponsiveState();
    };

    const addMediaListener = (mq) => {
        if (mq.addEventListener) {
            mq.addEventListener('change', handleResponsiveChange);
        } else if (mq.addListener) {
            mq.addListener(handleResponsiveChange);
        }
    };

    addMediaListener(narrowToolbarQuery);
    addMediaListener(landscapeToolbarQuery);
    handleResponsiveChange();
    
    // Budget panel functionality - get elements directly to avoid timing issues
    // Budget button now opens the centered balance sheet modal
    // The old budget-panel slide-in functionality is replaced by balance-sheet-panel
    // Note: budget-panel code is kept for backwards compatibility but not used
    
    const selectionResult = await showCitySizeSelection();
    const selectedCitySize = selectionResult.size || selectionResult;
    const multiplayerEnabled = selectionResult.multiplayer || false;
    const playerPseudo = selectionResult.pseudo || null;

    const gameSession = getOrCreateGameSessionContext();
    const game = createGame(gameSession, assetManager, selectedCitySize);
    registerAppService('game', game);
    
    // Activer le multijoueur uniquement si l'utilisateur a explicitement créé/rejoint un salon
    if (multiplayerEnabled && playerPseudo && (selectionResult.action === 'create' || selectionResult.action === 'join')) {
        try {
            const { getMultiplayerManager } = await import('../../infrastructure/multiplayer/MultiplayerManager.js');
            const multiplayerManager = getMultiplayerManager(game, game.scene);
            
            // Déterminer l'action et les paramètres
            const action = selectionResult.action;
            let roomIdOrCitySize;
            let roomName = null;
            if (action === 'join' && selectionResult.roomId) {
                // Rejoindre un salon existant
                roomIdOrCitySize = selectionResult.roomId;
            } else if (action === 'create') {
                // Créer un nouveau salon avec la taille choisie
                roomIdOrCitySize = selectedCitySize;
                roomName = selectionResult.roomName || null;
            }
            
            // Importer la configuration WebSocket
            const getWebSocketUrl = (await import('../../config/websocket.js')).default;
            const wsUrl = getWebSocketUrl();
            
            await multiplayerManager.enable(wsUrl, playerPseudo, roomIdOrCitySize, action, roomName);
            registerAppService('multiplayerManager', multiplayerManager);
        } catch (error) {
            console.error('[Multiplayer] Erreur d\'activation:', error);
            
            // Les erreurs sont gérées par MultiplayerManager :
            // - MAX_PLAYERS_REACHED → showConnectionRefusedAlert
            // - Autres erreurs → showConnectionFailedAlert (propose le mode solo)
            // Le jeu continue normalement en mode solo si l'utilisateur accepte
        }
    }
    
    // Initialize real-time budget popup
    initRealtimeBudgetPopup();

    // Initialize urban advice center
    initUrbanAdviceCenter();
    
    // Initialize budget states popup
    initBudgetStatesPopup();
    
    // Initialize city map popup
    initCityMapPopup();
    
    // Initialize loans popup
    initLoansPopup();
    
    // Initialize loan payment system
    initLoanPaymentSystem();
    
    // Initialize journal popup
    initJournalPopup();
    initFoodTraceabilityPopup();
    
    // Initialize balance sheet popup
    initBalanceSheetPopup();
    
    // Initialize administrator panel
    if (typeof initAdministratorPanel === 'function') {
        initAdministratorPanel();
    }
}

// Real-time Budget Popup Functions - Moved to budget/RealtimeBudgetManager.js

// Budget States Popup Functions - Moved to budget/BudgetStatesManager.js

// Urban Advice Center Functions - Moved to urban-advice/UrbanAdviceManager.js

// Loan System Functions - Moved to loans/LoansManager.js

registerAppFunction('loadBudgetStates', (period = '3', showLoading = true) => loadBudgetStates(period, showLoading));

// Global refresh function for budget states modal
// refreshBudgetStatesModal - Moved to budget/BudgetStatesManager.js
// Already exported globally from the module

// Journal Popup Functions - Moved to journal/JournalManager.js


// Food Traceability Popup Functions - Moved to food-traceability/FoodTraceabilityManager.js
