import { getResourceCategoryPresentation } from '../../domain/catalogs/ResourceCategoryCatalog.js';
import { buildHubStorageLines } from '../../domain/policies/HubStorageOrdersPolicy.js';
import { buildHubStoragePieSegments } from '../../domain/policies/HubStoragePiePolicy.js';
import { getMaxStockForBuilding } from '../../domain/policies/ResourceRolePolicy.js';
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
   */
  execute({ hubKind, buildingRow, stocks = null, maxStock = null }) {
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
      buildingRow.lastCollection,
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
      title: 'Grenier — Moulin',
      workers: buildingRow.employees?.worker ?? 0,
      workerNeed: buildingRow.employees?.worker_need ?? 0,
      ...storage,
      lines,
      // What is left from before the last harvest, and how long the stock lasts at last month's pace.
      carryOverTotal: lines.reduce((sum, line) => sum + line.carryOver, 0),
      autonomyMonths: computeAutonomyMonths(storage.currentTotal, buildingRow.lastOutflow?.units),
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
