import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getResourceCategoryPresentation } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { buildHubStorageLines } from '../../domain/policies/HubStorageOrdersPolicy.js';
import { buildHubStoragePieSegments } from '../../domain/policies/HubStoragePiePolicy.js';
import { getMaxStockForBuilding, getCollectionSchedule } from '../../domain/policies/ResourceRolePolicy.js';
import { monthsUntilNextMatch } from '../../domain/policies/ResourceSchedulePolicy.js';
import { computeCarryOver, computeAutonomyMonths } from '../../domain/policies/HubCapacityPolicy.js';

/**
 * Read model for windmill hub info overlay (Cesar III inspired).
 */
export class GetHubStorageInfoView {
  /**
   * @param {object} params
   * @param {'hub'} params.hubKind
   * @param {object|null|undefined} params.buildingRow
   * @param {Record<string, number>|null|undefined} [params.stocks]
   * @param {number|null|undefined} [params.maxStock]
   * @param {((monthsAhead: number) => object)|null} [params.timeContextAhead] Calendar from now, to say when the hub next collects
   * @param {(producerId: string) => string | null} [params.resolveProducerType] Producer instance id →
   *   catalog type, for the pie chart's origin breakdown (see HubStoragePiePolicy.js) — this view has
   *   no repository of its own, so the caller resolves it (createSupplyContext.js).
   * @param {(producerId: string) => string | null} [params.resolveProducerName] Lot key of a trade city → its name.
   */
  execute({ hubKind, buildingRow, stocks = null, maxStock = null, timeContextAhead = null, resolveProducerType = () => null, resolveProducerName = () => null }) {
    if (!buildingRow) {
      return Object.freeze({ hubKind, lines: Object.freeze([]), pieSegments: Object.freeze([]) });
    }

    const hubStocks = stocks ?? buildingRow.stocks ?? {};
    const totalCapacity = maxStock ?? getMaxStockForBuilding(buildingRow.type);
    const storage = buildHubStorageLines({
      buildingType: buildingRow.type,
      stocks: hubStocks,
      rawOrders: buildingRow.hubStorageOrders,
      emptying: buildingRow.hubEmptying,
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
        return Object.freeze({ ...line, emoji, label, carryOver: carryOver[line.productId] ?? 0, lots: buildingRow.lots?.[line.productId] ?? {} });
      })
    );

    // A hub that holds goods of different flows (a trade warehouse: what it sells, what it buys) declares them as
    // `storageViews`: one chart per flow, each leaving the others' goods out as one grey slice.
    const declaredViews = getResourceRoles(buildingRow.type).find((entry) => entry.role === 'hub')?.storageViews ?? [];
    const storageViews = Object.freeze(
      declaredViews.map((declared) => {
        const viewLines = lines.filter((line) => declared.categories.includes(line.productId));
        const elsewhereLines = lines.filter((line) => !declared.categories.includes(line.productId));
        const elsewhereAmount = elsewhereLines.reduce((sum, line) => sum + line.amount, 0);
        const otherLabels = declaredViews.filter((other) => other.id !== declared.id).map((other) => other.label);
        return Object.freeze({
          id: declared.id,
          label: declared.label,
          lines: Object.freeze(viewLines),
          total: viewLines.reduce((sum, line) => sum + line.amount, 0),
          pieSegments: buildHubStoragePieSegments({
            lines: viewLines,
            totalCapacity,
            elsewhere: { amount: elsewhereAmount, label: otherLabels.join(' · ') },
            resolveProducerType,
            resolveProducerName,
          }),
        });
      })
    );

    return Object.freeze({
      hubKind,
      buildingType: buildingRow.type,
      title: `Stockage — ${getBuildingDefinition(buildingRow.type)?.displayName ?? '…'}`,
      workers: buildingRow.employees?.worker ?? 0,
      workerNeed: buildingRow.employees?.worker_need ?? 0,
      ...storage,
      lines,
      // What is left from before the last harvest, and how long the stock lasts at last month's pace.
      carryOverTotal: lines.reduce((sum, line) => sum + line.carryOver, 0),
      autonomyMonths: computeAutonomyMonths(storage.currentTotal, buildingRow.lastOutflow?.units),
      // Months until the hub's own collection schedule next fires (its harvest), when a calendar is given.
      harvestInMonths: timeContextAhead
        ? monthsUntilNextMatch(getCollectionSchedule(buildingRow.type), timeContextAhead)
        : null,
      pieSegments: buildHubStoragePieSegments({
        lines,
        totalCapacity,
        resolveProducerType,
        resolveProducerName,
      }),
      storageViews,
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
