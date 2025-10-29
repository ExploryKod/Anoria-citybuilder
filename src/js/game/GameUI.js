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
    displayFunds,
    infoObjectOverlay,
    infoObjectCloseBtn,
    overOverlay,
    overOverlayMessage,
    bulldozeSelected
} from '../ui/nodes.js';

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
     * Getter for the game render window element
     * @returns {HTMLElement | null}
     */
    get gameWindow() {
        return gameWindowElement; // From nodes.js
    }

    /**
     * Updates the time display
     * @param {number|string} time - Time value to display
     * @param {string} unit - Optional unit (e.g., 'jours')
     */
    updateTimeDisplay(time, unit = 'jours') {
        if (displayTime) {
            displayTime.textContent = typeof time === 'number' 
                ? `${time} ${unit}` 
                : time;
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
     * Updates pause UI elements (icons and display)
     * @param {boolean} paused - Current pause state
     */
    updatePauseUI(paused) {
        if (paused) {
            // Game paused
            if (infoPanelClockIcon) infoPanelClockIcon.style.display = 'none';
            if (infoPanelNoClockIcon) infoPanelNoClockIcon.style.display = 'block';
            this.updateTimeDisplay('pause');
        } else {
            // Game playing
            if (infoPanelClockIcon) infoPanelClockIcon.style.display = 'block';
            if (infoPanelNoClockIcon) infoPanelNoClockIcon.style.display = 'none';
            this.updateTimeDisplay('play');
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
     * Updates population display
     * @param {number} population - Population count
     */
    updatePopulation(population) {
        if (displayPop) {
            displayPop.textContent = population?.toString() || '0';
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

