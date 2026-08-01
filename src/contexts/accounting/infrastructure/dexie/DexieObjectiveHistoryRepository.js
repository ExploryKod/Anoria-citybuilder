import db from '../../../../core/persistence/dexie/db.js';

/**
 * Dexie adapter — objective success/failure history (`objectives` table).
 */
export class DexieObjectiveHistoryRepository {
  constructor(database = db) {
    this.db = database;
  }

  async recordObjectiveFailure(failureData) {
    const failure = {
      name: `failure_${Date.now()}`,
      objectiveId: failureData.objectiveId,
      failureType: failureData.type || 'threshold_spiral',
      failureTurn: failureData.turn,
      failureReason: failureData.reason,
      failureDetails: failureData.details || {},
      recordedAt: new Date().toISOString(),
    };

    try {
      if (!this.db.objectives) {
        console.error('[DexieObjectiveHistoryRepository] objectives table not available');
        return failure;
      }
      await this.db.objectives.add(failure);
      return failure;
    } catch (error) {
      console.error('[DexieObjectiveHistoryRepository] Error recording failure:', error);
      throw error;
    }
  }

  async getAllFailures() {
    try {
      return await this.db.objectives.toArray();
    } catch (error) {
      console.error('[DexieObjectiveHistoryRepository] Error retrieving failures:', error);
      return [];
    }
  }

  async getFailuresForObjective(objectiveId) {
    try {
      const allFailures = await this.db.objectives.toArray();
      return allFailures.filter((failure) => failure.objectiveId === objectiveId);
    } catch (error) {
      console.error('[DexieObjectiveHistoryRepository] Error retrieving failures for objective:', error);
      return [];
    }
  }

  async recordObjectiveSuccess(successData) {
    const success = {
      name: `success_${Date.now()}`,
      objectiveId: successData.objectiveId,
      successTurn: successData.turn,
      successDetails: successData.details || {},
      recordedAt: new Date().toISOString(),
    };

    try {
      if (!this.db.objectives) {
        console.error('[DexieObjectiveHistoryRepository] objectives table not available');
        return success;
      }
      await this.db.objectives.add(success);
      return success;
    } catch (error) {
      console.error('[DexieObjectiveHistoryRepository] Error recording success:', error);
      throw error;
    }
  }
}
