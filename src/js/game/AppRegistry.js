/**
 * AppRegistry - Centralized namespace for application globals
 * Inspired by simcity's minimal global surface pattern
 * 
 * Instead of many window.* globals, use window.app.* for better organization
 * Maintains backwards compatibility by also exposing on window.*
 */

class AppRegistry {
    constructor() {
        // Core game systems
        this.game = null;
        this.gameStore = null;
        this.housesStore = null;
        
        // UI systems
        this.gameUI = null;
        this.popupManager = null;
        this.objectivesTracker = null;
        this.objectivesHistory = null;
        this.tutorialManager = null;
        
        // Managers
        this.budgetManager = null;
        this.inputManager = null;
        this.buttonStateManager = null;
        
        // Stores
        this.objectivesStore = null;
        
        // Utilities
        this.EventBlocker = null;
        
        // Functions (kept for backwards compatibility)
        this.setActiveTool = null;
        this.processLoanPayments = null;
        this.loadBudgetStates = null;
        this.generateCityMap = null;
        this.refreshBudgetStatesModal = null;
        this.startObjectives = null;
        this.closeObjectives = null;
        this.startTutorial = null;
        this.closeTutorial = null;
    }

    /**
     * Registers a core game instance
     * @param {string} name - Name of the instance
     * @param {*} instance - The instance to register
     * @param {boolean} exposeOnWindow - Also expose on window.* for backwards compatibility (default: true)
     */
    register(name, instance, exposeOnWindow = true) {
        if (!this.hasOwnProperty(name)) {
            console.warn(`AppRegistry: Unknown property "${name}" - adding dynamically`);
        }
        
        this[name] = instance;
        
        // Maintain backwards compatibility
        if (exposeOnWindow) {
            window[name] = instance;
        }
    }

    /**
     * Gets a registered instance
     * @param {string} name - Name of the instance
     * @returns {*} The instance or null
     */
    get(name) {
        return this[name] || null;
    }

    /**
     * Checks if an instance is registered
     * @param {string} name - Name of the instance
     * @returns {boolean}
     */
    has(name) {
        return this[name] !== null && this[name] !== undefined;
    }

    /**
     * Gets all registered instances (for debugging)
     * @returns {Object} Map of all registered instances
     */
    getAll() {
        return {
            game: this.game,
            gameStore: this.gameStore,
            housesStore: this.housesStore,
            gameUI: this.gameUI,
            popupManager: this.popupManager,
            objectivesTracker: this.objectivesTracker,
            objectivesHistory: this.objectivesHistory,
            tutorialManager: this.tutorialManager,
            budgetManager: this.budgetManager,
            inputManager: this.inputManager,
            buttonStateManager: this.buttonStateManager,
            objectivesStore: this.objectivesStore,
            EventBlocker: this.EventBlocker,
        };
    }
}

// Create singleton instance
const appRegistry = new AppRegistry();

// Expose as window.app (following simcity's pattern of minimal, organized globals)
window.app = appRegistry;

export default appRegistry;

