import { createBuildingInstanceId } from '../../../../shared/building-identity/index.js';

/**
 * Orchestration: budget debit → persist building row.
 * Spatial sync (neighbors, roads) stays in Parcels after mesh placement.
 */
export class PlaceBuildingWithPayment {
  /**
   * @param {object} deps
   * @param {import('../ports/ConstructionBuildingRepository.js').ConstructionBuildingRepository} deps.repository
   * @param {(amount: number, reason: string) => Promise<object>} deps.recordExpense
   * @param {(amount: number, reason: string) => Promise<object>} deps.recordRefund
   */
  constructor({ repository, recordExpense, recordRefund }) {
    this.repository = repository;
    this.recordExpense = recordExpense;
    this.recordRefund = recordRefund;
    this.pendingAdditions = new Set();
    this.pendingTimeouts = new Map();
  }

  /** @param {string} instanceId */
  #setPendingTimeout(instanceId, timeoutMs = 5000) {
    if (this.pendingTimeouts.has(instanceId)) {
      clearTimeout(this.pendingTimeouts.get(instanceId));
    }

    const timeout = setTimeout(() => {
      if (this.pendingAdditions.has(instanceId)) {
        console.warn(
          `[Construction] Clearing stuck pending addition for ${instanceId} after timeout`
        );
        this.pendingAdditions.delete(instanceId);
        this.pendingTimeouts.delete(instanceId);
      }
    }, timeoutMs);

    this.pendingTimeouts.set(instanceId, timeout);
  }

  /** @param {string} instanceId */
  #clearPendingTimeout(instanceId) {
    if (this.pendingTimeouts.has(instanceId)) {
      clearTimeout(this.pendingTimeouts.get(instanceId));
      this.pendingTimeouts.delete(instanceId);
    }
  }

  /**
   * @param {object} data
   * @returns {Promise<object>}
   */
  async execute(data) {
    const instanceId = data.instanceId ?? data.id ?? createBuildingInstanceId();

    if (this.pendingAdditions.has(instanceId)) {
      console.warn(
        `[Construction] Building ${instanceId} is already being added, skipping duplicate request`
      );
      return {
        success: false,
        reason: 'duplicate',
        error: 'Building is already being added',
        message: 'Building is already being added. Please wait.',
      };
    }

    const existingHouse = await this.repository.findById(instanceId);
    if (existingHouse) {
      console.warn(`[Construction] Cannot add building ${instanceId}: already exists`);
      return {
        success: false,
        reason: 'duplicate',
        error: 'Building already exists at this location',
        message: 'Building already exists at this location',
      };
    }

    this.pendingAdditions.add(instanceId);
    this.#setPendingTimeout(instanceId, 5000);

    const expenseResult = await this.recordExpense(
      data.price,
      `Building: ${data.type}`
    );

    if (!expenseResult.success) {
      this.pendingAdditions.delete(instanceId);
      this.#clearPendingTimeout(instanceId);
      console.warn(`Cannot build ${data.type}: ${expenseResult.message}`);
      return expenseResult;
    }

    const addResult = await this.repository.addRecord({ ...data, instanceId });

    this.pendingAdditions.delete(instanceId);
    this.#clearPendingTimeout(instanceId);

    if (!addResult.success) {
      console.error('[Construction] Error adding building after payment:', addResult.error);

      if (addResult.reason === 'duplicate') {
        await this.recordRefund(data.price, `Refund for duplicate ${data.type}`);
        return {
          success: false,
          reason: 'duplicate',
          error: 'Building already exists at this location',
          message: 'Building already exists at this location',
        };
      }

      await this.recordRefund(data.price, `Refund for failed ${data.type}`);
      return { success: false, reason: 'database_error', error: addResult.error };
    }

    return {
      success: true,
      budget: expenseResult.budget,
      instanceId: addResult.instanceId,
    };
  }
}
