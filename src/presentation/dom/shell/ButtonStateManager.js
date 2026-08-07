import { registerAppService } from '../../../composition/appServices.js';

/**
 * ButtonStateManager - Manages the enabled/disabled state of building buttons
 * 
 * Following SOLID principles:
 * - Single Responsibility: Only manages button state
 * - Open/Closed: Extensible without modification
 * - Liskov Substitution: Can be replaced by similar implementations
 * - Interface Segregation: Clean, minimal interface
 * - Dependency Inversion: Depends on abstractions (string IDs), not concrete elements
 */
class ButtonStateManager {
    constructor() {
        this.stateMap = new Map(); // Map<buttonId, isEnabled>
        this.listeners = new Map(); // Map<buttonId, Set<callbacks>>
        this.buttonElements = new Map(); // Map<buttonId, HTMLElement>
    }

    /**
     * Register a button element with the manager
     * @param {string} buttonId - Unique identifier for the button
     * @param {HTMLElement} element - The button DOM element
     */
    registerButton(buttonId, element) {
        if (!buttonId || !element) {
            console.warn('ButtonStateManager: Cannot register button with invalid ID or element');
            return;
        }

        this.buttonElements.set(buttonId, element);
        
        // Initialize state as enabled by default, or use pre-set state
        if (!this.stateMap.has(buttonId)) {
            this.stateMap.set(buttonId, true);
        }

        // Apply current state (this will respect any pre-set state)
        this.#applyState(buttonId);
        
        // Log if the button was pre-disabled
        if (this.stateMap.get(buttonId) === false) {
        }
    }

    /**
     * Enable a button
     * @param {string} buttonId - The ID of the button to enable
     * @returns {boolean} - True if successful, false otherwise
     */
    enable(buttonId) {
        // If button is not registered yet, try to find and register it
        if (!this.isRegistered(buttonId)) {
            this.#tryRegisterExistingButton(buttonId);
        }
        return this.#setState(buttonId, true);
    }

    /**
     * Disable a button
     * @param {string} buttonId - The ID of the button to disable
     * @returns {boolean} - True if successful, false otherwise
     */
    disable(buttonId) {
        // If button is not registered yet, try to find and register it
        if (!this.isRegistered(buttonId)) {
            this.#tryRegisterExistingButton(buttonId);
        }
        return this.#setState(buttonId, false);
    }

    /**
     * Toggle button state
     * @param {string} buttonId - The ID of the button to toggle
     * @returns {boolean} - True if successful, false otherwise
     */
    toggle(buttonId) {
        if (!this.stateMap.has(buttonId)) {
            console.warn(`ButtonStateManager: Cannot toggle unregistered button: ${buttonId}`);
            return false;
        }

        const currentState = this.stateMap.get(buttonId);
        return this.#setState(buttonId, !currentState);
    }

    /**
     * Check if a button is enabled
     * @param {string} buttonId - The ID of the button to check
     * @returns {boolean} - True if enabled, false if disabled or not registered
     */
    isEnabled(buttonId) {
        return this.stateMap.get(buttonId) || false;
    }

    /**
     * Get the current state of a button
     * @param {string} buttonId - The ID of the button
     * @returns {boolean|null} - True if enabled, false if disabled, null if not registered
     */
    getState(buttonId) {
        if (!this.stateMap.has(buttonId)) {
            return null;
        }
        return this.stateMap.get(buttonId);
    }

    /**
     * Enable multiple buttons at once
     * @param {string[]} buttonIds - Array of button IDs to enable
     * @returns {number} - Number of successfully enabled buttons
     */
    enableMultiple(buttonIds) {
        if (!Array.isArray(buttonIds)) {
            console.warn('ButtonStateManager: enableMultiple expects an array');
            return 0;
        }

        let successCount = 0;
        buttonIds.forEach(buttonId => {
            if (this.enable(buttonId)) {
                successCount++;
            }
        });
        return successCount;
    }

    /**
     * Disable multiple buttons at once
     * @param {string[]} buttonIds - Array of button IDs to disable
     * @returns {number} - Number of successfully disabled buttons
     */
    disableMultiple(buttonIds) {
        if (!Array.isArray(buttonIds)) {
            console.warn('ButtonStateManager: disableMultiple expects an array');
            return 0;
        }

        let successCount = 0;
        buttonIds.forEach(buttonId => {
            if (this.disable(buttonId)) {
                successCount++;
            }
        });
        return successCount;
    }

    /**
     * Get all registered button IDs
     * @returns {string[]} - Array of registered button IDs
     */
    getRegisteredButtons() {
        return Array.from(this.stateMap.keys());
    }

    /**
     * Check if a button is registered
     * @param {string} buttonId - The ID of the button to check
     * @returns {boolean} - True if registered, false otherwise
     */
    isRegistered(buttonId) {
        return this.stateMap.has(buttonId);
    }

    /**
     * Remove a button from the manager
     * @param {string} buttonId - The ID of the button to remove
     */
    unregisterButton(buttonId) {
        this.stateMap.delete(buttonId);
        this.buttonElements.delete(buttonId);
        this.listeners.delete(buttonId);
    }

    /**
     * Subscribe to button state changes
     * @param {string} buttonId - The ID of the button
     * @param {function} callback - Function to call when state changes
     * @returns {function} - Unsubscribe function
     */
    subscribe(buttonId, callback) {
        if (!this.listeners.has(buttonId)) {
            this.listeners.set(buttonId, new Set());
        }
        
        this.listeners.get(buttonId).add(callback);

        // Return unsubscribe function
        return () => {
            const buttonListeners = this.listeners.get(buttonId);
            if (buttonListeners) {
                buttonListeners.delete(callback);
            }
        };
    }

    /**
     * Internal method to set button state
     * @private
     * @param {string} buttonId - The ID of the button
     * @param {boolean} enabled - The desired state
     * @returns {boolean} - True if successful
     */
    #setState(buttonId, enabled) {
        // Try to register the button if it exists in DOM but not in stateMap
        if (!this.stateMap.has(buttonId)) {
            this.#tryRegisterExistingButton(buttonId);
            
            // If still not registered after trying, the button doesn't exist yet
            // (tool panels create buttons lazily). Store desired state silently —
            // registerButton / #applyState will pick it up when the DOM node appears.
            if (!this.stateMap.has(buttonId)) {
                this.stateMap.set(buttonId, enabled);
                return true;
            }
        }

        const previousState = this.stateMap.get(buttonId);
        this.stateMap.set(buttonId, enabled);
        
        this.#applyState(buttonId);
        this.#notifyListeners(buttonId, enabled, previousState);
        
        return true;
    }

    /**
     * Apply the current state to the button element
     * @private
     * @param {string} buttonId - The ID of the button
     */
    #applyState(buttonId) {
        const element = this.buttonElements.get(buttonId);
        const isEnabled = this.stateMap.get(buttonId);

        if (!element) {
            // Element not registered yet, wait for registration
            return;
        }

        if (isEnabled) {
            element.classList.remove('button-disabled');
            element.style.pointerEvents = '';
            element.style.opacity = '';
            element.style.cursor = '';
        } else {
            element.classList.add('button-disabled');
            element.style.pointerEvents = 'none';
            element.style.opacity = '0.5';
            element.style.cursor = 'not-allowed';
        }
    }

    /**
     * Try to register an existing button from the DOM
     * @private
     * @param {string} buttonId - The ID of the button to find and register
     */
    #tryRegisterExistingButton(buttonId) {
        const element = document.getElementById(buttonId);
        if (element) {
            this.registerButton(buttonId, element);
        }
    }

    /**
     * Notify all listeners about state change
     * @private
     * @param {string} buttonId - The ID of the button
     * @param {boolean} newState - The new state
     * @param {boolean} oldState - The previous state
     */
    #notifyListeners(buttonId, newState, oldState) {
        const buttonListeners = this.listeners.get(buttonId);
        if (buttonListeners) {
            buttonListeners.forEach(callback => {
                try {
                    callback(newState, oldState, buttonId);
                } catch (error) {
                    console.error(`ButtonStateManager: Error in listener callback for ${buttonId}:`, error);
                }
            });
        }
    }
}

// Create singleton instance
const buttonStateManager = new ButtonStateManager();

registerAppService('buttonStateManager', buttonStateManager);

// Export singleton instance for module access
export { buttonStateManager };

// Also export the class for cases where multiple instances might be needed
export default ButtonStateManager;

