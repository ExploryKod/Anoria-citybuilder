/**
 * Query (CQRS read): Supply view for info panel / UI.
 * Flat DTO — French copy stays in presentation (game.js).
 *
 * Market « maisons à portée » uses neighbor houses (legacy feature), not Manhattan.
 * isBuying / isCollecting are gated by OperationalGatePolicy (route + staff).
 */
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';
import { hasResourceRole, getConsumptionModeForRole, getResourceRoles } from '../../domain/policies/ResourceRolePolicy.js';

export class GetBuildingSupplyView {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {string} buildingId
   * @returns {Promise<object | null>}
   */
  async execute(buildingId) {
    if (!buildingId) return null;

    const view = await this.supplyBuildingRepository.findSupplyView(buildingId);
    if (!view) return null;

    const snapshot = await this.supplyBuildingRepository.findById(buildingId);
    const operational =
      snapshot &&
      isOperational({
        type: snapshot.type,
        roadCount: snapshot.roadCount,
        worker: snapshot.worker,
        workerNeed: snapshot.workerNeed,
      });

    const kind = classifySupplyKind(view.type);
    const base = {
      buildingId: view.id,
      kind,
      type: view.type,
      stocks: { ...view.stocks },
      maxStock: view.maxStock,
      // The step of its production cycle a producer is on (its `cycle` in the catalog), for the graphics.
      cycleStep: currentCycleStep(view),
    };

    if (kind === 'market') {
      return {
        ...base,
        isBuying: operational === true && view.isBuying,
        noFarmsNearby: view.noSourcesNearby,
        hasHousesNearby: neighborsMatch(view.neighbors, isHouseNeighbor),
        marketTooFar: view.distributorTooFar,
      };
    }

    if (kind === 'house') {
      return {
        ...base,
        marketTooFar: view.distributorTooFar,
      };
    }

    if (kind === 'farm') {
      return {
        ...base,
        salesToMarket: [...view.salesToDistributor],
        salesToHub: [...view.salesToHub],
        soldToHub: view.collectedByHub,
      };
    }

    if (kind === 'hub') {
      return {
        ...base,
        isCollecting: operational === true && view.isCollecting,
        lastCollection: view.lastCollection ? { ...view.lastCollection } : null,
        lastImport: view.lastImport ? { ...view.lastImport } : null,
        lastImportDetails: view.lastImportDetails
          ? { ...view.lastImportDetails }
          : null,
      };
    }

    return base;
  }
}

/**
 * @param {string} type
 * @returns {'market' | 'service' | 'hub' | 'farm' | 'house' | 'other'}
 *   UI/DTO vocabulary kept as-is for presentation compatibility — derived
 *   from the type's declarative resourceRoles (see ResourceRolePolicy.js),
 *   not a name-string match. A 'distributor' role splits into two kinds by
 *   its `consumption` mode: 'market' moves a depleting numeric stock
 *   (Market-Stall selling food), 'service' just marks nearby consumers
 *   "served this period" with no stock at all (Chapel's faith, School,
 *   Doctor, ... — see DistributeResourceToConsumers.js) — these need very
 *   different info-panel content (no stock to show, no buying-period
 *   state), previously both silently routed to the market panel.
 */
export function classifySupplyKind(type) {
  if (hasResourceRole(type, 'distributor')) {
    return getConsumptionModeForRole(type, 'distributor') === 'flag' ? 'service' : 'market';
  }
  if (hasResourceRole(type, 'hub')) return 'hub';
  // A house both consumes and gathers, so consumers are classified before producers.
  if (hasResourceRole(type, 'consumer')) return 'house';
  if (hasResourceRole(type, 'producer')) return 'farm';
  return 'other';
}

/** The id of the step a producer's cycle awaits, or null when it has no cycle. */
function currentCycleStep(view) {
  const entry = getResourceRoles(view.type).find((candidate) => candidate.role === 'producer' && candidate.cycle);
  if (!entry) return null;
  const index = view.cycleState?.[entry.categories[0]]?.index ?? 0;
  return entry.cycle[index]?.id ?? null;
}

function neighborsMatch(neighbors, predicate) {
  if (!Array.isArray(neighbors)) return false;
  return neighbors.some((n) => n && predicate(n));
}

/** Same filters as legacy game.js neighbor checks for houses. */
function isHouseNeighbor(neighbor) {
  const name = neighbor.type || neighbor.name || '';
  return name.includes('House') || name.includes('house');
}
