import db from './db.js';

/**
 * ObjectivesStore - Gestion du store des objectifs (échecs, succès, etc.)
 */
class ObjectivesStore {
    constructor() {
        this.db = db;
    }

    /**
     * Enregistre un échec d'objectif
     * @param {Object} failureData - Données de l'échec
     */
    async recordObjectiveFailure(failureData) {
        const failure = {
            name: `failure_${Date.now()}`,
            objectiveId: failureData.objectiveId,
            failureType: failureData.type || 'threshold_spiral', // threshold_spiral, threshold_date, deadline, maintenance
            failureTurn: failureData.turn,
            failureReason: failureData.reason,
            failureDetails: failureData.details || {},
            recordedAt: new Date().toISOString()
        };

        try {
            if (!this.db.objectives) {
                console.error('Objectives store not available');
                return failure;
            }
            await this.db.objectives.add(failure);
            return failure;
        } catch (error) {
            console.error('Error recording objective failure:', error);
            throw error;
        }
    }

    /**
     * Récupère tous les échecs d'objectifs
     * @returns {Promise<Array>} Liste des échecs
     */
    async getAllFailures() {
        try {
            return await this.db.objectives.toArray();
        } catch (error) {
            console.error('Error retrieving objective failures:', error);
            return [];
        }
    }

    /**
     * Récupère les échecs pour un objectif spécifique
     * @param {string} objectiveId - ID de l'objectif
     * @returns {Promise<Array>} Liste des échecs pour cet objectif
     */
    async getFailuresForObjective(objectiveId) {
        try {
            const allFailures = await this.db.objectives.toArray();
            return allFailures.filter(failure => failure.objectiveId === objectiveId);
        } catch (error) {
            console.error('Error retrieving failures for objective:', error);
            return [];
        }
    }

    /**
     * Enregistre un succès d'objectif
     * @param {Object} successData - Données du succès
     */
    async recordObjectiveSuccess(successData) {
        const success = {
            name: `success_${Date.now()}`,
            objectiveId: successData.objectiveId,
            successTurn: successData.turn,
            successDetails: successData.details || {},
            recordedAt: new Date().toISOString()
        };

        try {
            if (!this.db.objectives) {
                console.error('Objectives store not available');
                return success;
            }
            await this.db.objectives.add(success);
            return success;
        } catch (error) {
            console.error('Error recording objective success:', error);
            throw error;
        }
    }
}

// Export an instance of the ObjectivesStore class
const objectivesStore = new ObjectivesStore();

// Expose globally for easy access
window.objectivesStore = objectivesStore;
// Also register with AppRegistry if available
if (window.app && window.app.register) {
    window.app.register('objectivesStore', objectivesStore);
}

export default objectivesStore;

