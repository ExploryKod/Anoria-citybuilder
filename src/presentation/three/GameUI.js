/**
 * GameUI - Centralizes DOM queries and UI state management
 * Inspired by simcity-threejs-clone's GameUI pattern
 */

import {
    displayTime,
    displaySpeed,
    infoPanelClockIcon,
    infoPanelNoClockIcon,
    gameWindow as gameWindowElement,
    displayPop,
    displayHungerPop,
    displayUnemployedPop,
    displayWorkerLack,
    displayFunds,
    infoObjectOverlay,
    infoObjectCloseBtn,
    overOverlay,
    overOverlayMessage,
    bulldozeSelected
} from '../../js/ui/nodes.js';
import { formatGameTime } from '../../js/acl/appRuntime.js';
import { getGameScene } from '../../js/acl/appRuntime.js';

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
     * Updates the time display
     * @param {number|string|undefined} time - Time value to display (number of days)
     * @param {string} unit - Optional unit (ignored if time is number, uses TimeManager)
     */
    updateTimeDisplay(time, unit = 'jours') {
        if (displayTime) {
            // Vérifier si time est un nombre valide
            if (typeof time === 'number' && !isNaN(time) && time >= 0) {
                // Stocker le temps actuel pour pouvoir le réafficher même en pause
                this.currentTime = time;
                // Utiliser le TimeManager pour formater le temps avec jours, mois et saisons
                const formattedTime = formatGameTime(time);
                // S'assurer que le formatage n'a pas retourné undefined
                if (formattedTime && formattedTime !== 'undefined') {
                    displayTime.textContent = formattedTime;
                } else {
                    displayTime.textContent = 'Chargement...';
                }
            } else {
                // Si le temps n'est pas encore défini ou invalide, afficher "Chargement..."
                displayTime.textContent = 'Chargement...';
            }
        }
    }

    /**
     * Updates the game speed display
     * @param {number} speed - Speed value in milliseconds
     */
    updateSpeedDisplay(speed) {
        if (displaySpeed) {
            displaySpeed.textContent = speed.toString();
        }
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
            displayTime.textContent = formatGameTime(this.currentTime);
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
     * Population totale avec détail (citoyens, élites).
     * @param {number} totalPopulation
     * @param {number} citizenPopulation
     * @param {number} elitePopulation
     */
    updatePopulationBreakdown(totalPopulation, citizenPopulation, elitePopulation) {
        if (displayPop) {
            const total = Math.max(0, Math.floor(totalPopulation) || 0);
            const citizens = Math.max(0, Math.floor(citizenPopulation) || 0);
            const elites = Math.max(0, Math.floor(elitePopulation) || 0);
            displayPop.textContent = `${total} (${citizens}, ${elites})`;
        }
    }

    /** @deprecated Use updatePopulationBreakdown */
    updateCitizenPopulation(citizenPopulation) {
        this.updatePopulationBreakdown(citizenPopulation, citizenPopulation, 0);
    }

    /** @deprecated Use updatePopulationBreakdown */
    updatePopulation(population) {
        this.updatePopulationBreakdown(population, population, 0);
    }

    /** @deprecated Use updatePopulationBreakdown */
    updateElitePopulation(elitePopulation) {
        this.updatePopulationBreakdown(elitePopulation, 0, elitePopulation);
    }

    /**
     * Updates famished (hungry) population display
     * @param {number} famishedPopulation - Number of famished people
     */
    updateFamishedPopulation(famishedPopulation) {
        if (displayHungerPop) {
            displayHungerPop.textContent = (famishedPopulation || 0).toString();
        }
    }

    /**
     * Updates global worker shortage (lack) — standalone number, no icon, always red.
     * @param {number} lack - Missing workers on road-eligible workplaces
     */
    updateWorkerLack(lack = 0) {
        if (displayWorkerLack) {
            displayWorkerLack.textContent = String(Math.max(0, Math.floor(lack) || 0));
        }
    }

    /**
     * Updates unemployed population display (chômage — surplus labor, with icon).
     * @param {number} unemployedPopulation - Number of unemployed people
     * @param {number} unemploymentPercentage - Unemployment percentage (optional)
     */
    updateUnemployedPopulation(unemployedPopulation, unemploymentPercentage = null) {
        if (displayUnemployedPop) {
            if (unemploymentPercentage !== null && unemploymentPercentage !== undefined) {
                displayUnemployedPop.textContent = `${unemployedPopulation || 0} (${unemploymentPercentage}%)`;
            } else {
                displayUnemployedPop.textContent = (unemployedPopulation || 0).toString();
            }
            displayUnemployedPop.style.color = '';
        }
    }

    /**
     * Updates funds display
     * @param {number} funds - Funds amount
     */
    updateFunds(funds) {
        if (displayFunds) {
            displayFunds.textContent = funds?.toString() || '0';
        }
    }

    /**
     * Updates title bar with city information (population, funds, etc.)
     * Similar to simcity's updateTitleBar pattern
     * @param {Object} data - City data object
     * @param {string} data.name - City name (optional)
     * @param {number} data.population - Population count
     * @param {number} data.funds - Current funds
     */
    updateTitleBar(data = {}) {
        if (data.population !== undefined) {
            this.updatePopulation(data.population);
        }
        if (data.funds !== undefined) {
            this.updateFunds(data.funds);
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
                let sceneObj = getGameScene();
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
                let sceneObj = getGameScene();
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

