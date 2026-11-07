import { createBuildingInstanceId } from '../../../../shared/building-identity/index.js';
import { companiesOf, nextFreeCompanyId } from '../../../../shared/building-catalog/buildingCompanies.js';

/**
 * Orchestration: budget debit → persist building row.
 * Road access sync stays in Parcels after mesh placement.
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

  /** The types that list companies and have a placement being written: only one at a time (see `execute`). */
  #companyTypesInFlight = new Set();

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
    // A building that is one company of a catalog list takes its company from the buildings that stand: two placements at once would read the same ones and take the
    // same company, so a second one waits until the first is written.
    const companyType = companiesOf(data.type) ? data.type : null;
    if (companyType && this.#companyTypesInFlight.has(companyType)) {
      return {
        success: false,
        reason: 'company_pending',
        error: 'Another company of this kind is being founded',
        message: 'Une autre compagnie de ce type est en cours de fondation : réessayez dans un instant.',
      };
    }
    if (companyType) this.#companyTypesInFlight.add(companyType);
    try {
      return await this.#executePlacement(data);
    } catch (error) {
      console.error('[Construction] Unexpected placement error:', error);
      return {
        success: false,
        reason: 'database_error',
        error: error?.message ?? 'Unexpected placement error',
        message: error?.message ?? 'Unexpected placement error',
      };
    } finally {
      if (companyType) this.#companyTypesInFlight.delete(companyType);
    }
  }

  async #executePlacement(data) {
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

    // A building that is one company of a catalog list takes the first place no standing building holds, before it is paid: no place left throws.
    if (companiesOf(data.type)) {
      const standing = (await this.repository.listAllRows()).filter((row) => row.type === data.type);
      data = { ...data, companyId: nextFreeCompanyId(data.type, standing.map((row) => row.companyId)) };
    }

    this.pendingAdditions.add(instanceId);
    this.#setPendingTimeout(instanceId, 5000);

    let expenseResult = { success: true, budget: null };
    if (data.price > 0) {
      expenseResult = await this.recordExpense(
        data.price,
        `Building: ${data.type}`,
        { buildingInstanceId: instanceId }
      );

      if (!expenseResult.success) {
        this.pendingAdditions.delete(instanceId);
        this.#clearPendingTimeout(instanceId);
        console.warn(`Cannot build ${data.type}: ${expenseResult.message}`);
        return expenseResult;
      }
    }

    const addResult = await this.repository.addRecord({ ...data, instanceId });

    this.pendingAdditions.delete(instanceId);
    this.#clearPendingTimeout(instanceId);

    if (!addResult.success) {
      console.error('[Construction] Error adding building after payment:', addResult.error);

      try {
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
      } catch (refundError) {
        console.error('[Construction] Refund failed after insert error:', refundError);
      }

      return { success: false, reason: 'database_error', error: addResult.error };
    }

    return {
      success: true,
      budget: expenseResult.budget,
      instanceId: addResult.instanceId,
    };
  }
}
