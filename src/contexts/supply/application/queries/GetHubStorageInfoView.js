import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getResourceCategoryPresentation } from '../../domain/catalogs/ResourceCategoryCatalog.js';
import { buildHubStorageLines } from '../../domain/policies/HubStorageOrdersPolicy.js';
import { buildHubStoragePieSegments } from '../../domain/policies/HubStoragePiePolicy.js';
import { getMaxStockForBuilding, getScheduleForRole } from '../../domain/policies/ResourceRolePolicy.js';
import { monthsUntilNextMatch } from '../../domain/policies/ResourceSchedulePolicy.js';
import { computeCarryOver, computeAutonomyMonths } from '../../domain/policies/HubCapacityPolicy.js';

/**
 * Read model for windmill hub info overlay (Cesar III inspired).
 */
export class GetHubStorageInfoView {
  /**
   * @param {object} params
   * @param {'windmill'} params.hubKind
   * @param {object|null|undefined} params.buildingRow
   * @param {Record<string, number>|null|undefined} [params.stocks]
   * @param {number|null|undefined} [params.maxStock]
   * @param {((monthsAhead: number) => object)|null} [params.timeContextAhead] Calendar from now, to say when the hub next collects
   */
  execute({ hubKind, buildingRow, stocks = null, maxStock = null, timeContextAhead = null }) {
    if (!buildingRow) {
      return Object.freeze({ hubKind, lines: Object.freeze([]), pieSegments: Object.freeze([]) });
    }

    const hubStocks = stocks ?? buildingRow.stocks ?? {};
    const totalCapacity = maxStock ?? getMaxStockForBuilding(buildingRow.type);
    const storage = buildHubStorageLines({
      buildingType: buildingRow.type,
      stocks: hubStocks,
      rawOrders: buildingRow.hubStorageOrders,
      totalCapacity,
    });

    const carryOver = computeCarryOver(
      hubStocks,
      buildingRow.carryOver?.stocks,
      buildingRow.carryOver?.harvested,
      storage.lines.map((line) => line.productId)
    );
    const lines = Object.freeze(
      storage.lines.map((line) => {
        const { emoji, label } = getResourceCategoryPresentation(line.productId);
        return Object.freeze({ ...line, emoji, label, carryOver: carryOver[line.productId] ?? 0 });
      })
    );

    return Object.freeze({
      hubKind,
      title: `Stockage — ${getBuildingDefinition(buildingRow.type)?.displayName ?? buildingRow.type}`,
      workers: buildingRow.employees?.worker ?? 0,
      workerNeed: buildingRow.employees?.worker_need ?? 0,
      ...storage,
      lines,
      // What is left from before the last harvest, and how long the stock lasts at last month's pace.
      carryOverTotal: lines.reduce((sum, line) => sum + line.carryOver, 0),
      autonomyMonths: computeAutonomyMonths(storage.currentTotal, buildingRow.lastOutflow?.units),
      // Months until the hub's own collection schedule next fires (its harvest), when a calendar is given.
      harvestInMonths: timeContextAhead
        ? monthsUntilNextMatch(getScheduleForRole(buildingRow.type, 'collector'), timeContextAhead)
        : null,
      pieSegments: buildHubStoragePieSegments({
        lines,
        totalCapacity,
      }),
      linkedMarkets: Object.freeze(
        (buildingRow.linkedDistributors ?? []).map((entry) =>
          Object.freeze({
            marketId: entry.distributorId,
            x: entry.x,
            y: entry.y,
            allocatedStocks: Object.freeze({ ...entry.allocatedStocks }),
          })
        )
      ),
    });
  }
}
