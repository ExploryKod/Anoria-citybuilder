import { tickPerfEnabled } from '../../../../../core/diagnostics/tickPerf.js';

/**
 * Inhabitants who left because a house's standing changed (its population was brought back to
 * the cap of the lower level), and the requirements that no longer held.
 * @param {Array<{ previousPop?: number, targetPop?: number, unmetRequirements?: Array<{ kind: string, category?: string }> }>} changes
 * @returns {{ count: number, houses: number, unmet: Array<{ kind: string, category?: string }> } | null}
 */
function summarizeDeparture(changes) {
  const leaving = changes.filter((change) => (change.previousPop ?? 0) > (change.targetPop ?? 0));
  if (leaving.length === 0) return null;

  const unmet = new Map();
  for (const change of leaving) {
    for (const { kind, category } of change.unmetRequirements ?? []) {
      unmet.set(`${kind}:${category ?? ''}`, { kind, category });
    }
  }
  return {
    count: leaving.reduce((sum, change) => sum + (change.previousPop - change.targetPop), 0),
    houses: leaving.length,
    unmet: [...unmet.values()],
  };
}

/**
 * Command: evaluate and persist house evolution for every residential building.
 */
export class EvolveAllHouseBuildings {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   * @param {import('./EvolveHouseBuilding.js').EvolveHouseBuilding} evolveHouseBuilding
   */
  constructor(housingBuildingRepository, evolveHouseBuilding) {
    this.repository = housingBuildingRepository;
    this.evolveHouseBuilding = evolveHouseBuilding;
  }

  /**
   * @param {object} [params]
   * @param {number} [params.periodKey] Current month index, forwarded to
   *   every house — only needed by tiers with a `serviceCoverage`
   *   requirement (see HouseLevelPolicy.js).
   * @returns {Promise<{
   *   housesProcessed: number,
   *   housesChanged: number,
   *   changes: Array<{
   *     houseId: string,
   *     previousId: string,
   *     previousType: string,
   *     targetType: string,
   *     previousLevel?: 1 | 2,
   *     targetLevel?: 1 | 2,
   *     previousPop: number,
   *     targetPop: number,
   *     reason?: string,
   *   }>,
   * }>}
   */
  async execute({ periodKey } = {}) {
    const startedAt = performance.now();
    const houses = await this.repository.findResidentialHouses();
    const changes = [];
    this.evolveHouseBuilding.timings = {};

    for (const house of houses) {
      const result = await this.evolveHouseBuilding.execute({ houseId: house.id, periodKey });
      if (result.changed) {
        changes.push({
          houseId: result.houseId,
          previousId: result.previousId,
          previousType: result.previousType,
          targetType: result.targetType,
          previousLevel: result.previousLevel,
          targetLevel: result.targetLevel,
          previousPop: result.previousPop,
          targetPop: result.targetPop,
          reason: result.reason,
          unmetRequirements: result.unmetRequirements,
        });
      }
    }

    if (tickPerfEnabled()) {
      const steps = Object.entries(this.evolveHouseBuilding.timings).map(([step, ms]) => `${step}=${ms.toFixed(1)}`).join(' ');
      console.info(`[tick-perf] housing.evolution houses=${houses.length} total=${(performance.now() - startedAt).toFixed(1)}ms ${steps}`);
    }
    return {
      housesProcessed: houses.length,
      housesChanged: changes.length,
      changes,
      departure: summarizeDeparture(changes),
    };
  }
}
