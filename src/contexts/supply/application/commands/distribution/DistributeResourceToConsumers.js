import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { resolveInstanceIdFromNeighborRef } from '../../../../../shared/building-identity/BuildingRecord.js';
import { distributeRoundRobin } from '../../services/RoundRobinDistribution.js';

/**
 * Command: a source building distributes resource units to consumers in
 * range (market-to-houses monthly food sale today; resource-agnostic
 * otherwise via the `circuit` descriptor). Round-robin: each pass, every
 * eligible consumer may take 1 unit per still-available category.
 */
export class DistributeResourceToConsumers {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.sourceId
   * @param {object[]} params.consumerRefs
   * @param {object} params.period
   * @param {object} params.circuit
   * @returns {Promise<{
   *   distributed: boolean,
   *   reason?: string,
   *   transfers: Array<{ consumerId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ sourceId, consumerRefs = [], period, circuit }) {
    if (!circuit.canDistribute(period)) {
      return { distributed: false, reason: 'not_distribution_period', transfers: [], totalUnits: 0 };
    }

    const source = await this.supplyBuildingRepository.findById(sourceId);
    if (!source) {
      return { distributed: false, reason: 'source_not_found', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        roadCount: source.roadCount,
        worker: source.worker,
        workerNeed: source.workerNeed,
      })
    ) {
      return { distributed: false, reason: 'source_not_operational', transfers: [], totalUnits: 0 };
    }

    const sourceStock = createResourceStock(source.stocks, circuit.categories, circuit.totalKey);
    const availableTotal = circuit.categories.reduce(
      (sum, category) => sum + getCategoryAmount(sourceStock, category),
      0,
    );
    if (availableTotal <= 0) {
      return { distributed: false, reason: 'source_empty', transfers: [], totalUnits: 0 };
    }

    const consumerIds = [
      ...new Set(
        consumerRefs.map(resolveInstanceIdFromNeighborRef).filter((id) => typeof id === 'string' && id.length > 0),
      ),
    ];
    if (consumerIds.length === 0) {
      return { distributed: false, reason: 'no_consumers', transfers: [], totalUnits: 0 };
    }

    const { transfers, sourceStock: nextSourceStock } = await distributeRoundRobin({
      categories: circuit.categories,
      sourceStock,
      consumerIds,
      isEligible: (consumer) => consumer.roadCount > 0,
      repository: this.supplyBuildingRepository,
      createStock: (raw) => createResourceStock(raw, circuit.categories, circuit.totalKey),
      takeCategory: (stock, category, amount) =>
        takeCategoryAmount(stock, category, amount, circuit.categories, circuit.totalKey),
      addCategory: (stock, category, amount) =>
        addCategoryAmount(stock, category, amount, circuit.categories, circuit.totalKey),
      getAmount: getCategoryAmount,
    });

    if (transfers.length === 0) {
      return { distributed: false, reason: 'nothing_distributed', transfers: [], totalUnits: 0 };
    }

    await this.supplyBuildingRepository.saveStocks(sourceId, nextSourceStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { distributed: true, transfers, totalUnits };
  }
}
