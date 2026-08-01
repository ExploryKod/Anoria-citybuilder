/**
 * Query (CQRS read): Supply view for info panel / UI.
 * Flat DTO — French copy stays in presentation (game.js).
 *
 * Market « maisons à portée » uses neighbor houses (legacy feature), not Manhattan.
 * isBuying / isCollecting are gated by OperationalGatePolicy (route + staff).
 */
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';

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
    };

    if (kind === 'market') {
      return {
        ...base,
        isBuying: operational === true && view.isBuying,
        noFarmsNearby: view.noFarmsNearby,
        hasHousesNearby: neighborsMatch(view.neighbors, isHouseNeighbor),
        marketTooFar: view.marketTooFar,
      };
    }

    if (kind === 'house') {
      return {
        ...base,
        marketTooFar: view.marketTooFar,
      };
    }

    if (kind === 'farm') {
      return {
        ...base,
        salesToMarket: [...view.salesToMarket],
        salesToWindmill: [...view.salesToWindmill],
        soldToWindmill: view.soldToWindmill,
      };
    }

    if (kind === 'windmill') {
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

/** @param {string} type */
export function classifySupplyKind(type) {
  const t = type || '';
  if (t.includes('Market') || t.includes('market')) return 'market';
  if (t.includes('Windmill') || t.includes('windmill')) return 'windmill';
  if (t.includes('Farm') || t.includes('farm')) return 'farm';
  if (t.includes('House') || t.includes('house')) return 'house';
  return 'other';
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
