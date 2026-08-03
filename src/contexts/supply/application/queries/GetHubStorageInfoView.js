import {
  HUB_KIND,
  getHubProductEmoji,
  getHubProductLabel,
} from '../../domain/catalogs/HubStorageCatalog.js';
import { createEmptyCommerceStocks } from '../../domain/catalogs/BarnCommerceCatalog.js';
import {
  getBarnCapacitySummary,
} from '../../domain/policies/BarnStockPolicy.js';
import { buildHubStorageLines } from '../../domain/policies/HubStorageOrdersPolicy.js';
import { buildHubStoragePieSegments } from '../../domain/policies/HubStoragePiePolicy.js';

/**
 * Read model for barn / windmill hub info overlay (Cesar III inspired).
 */
export class GetHubStorageInfoView {
  /**
   * @param {object} params
   * @param {'barn'|'windmill'} params.hubKind
   * @param {object|null|undefined} params.buildingRow
   * @param {Record<string, number>|null|undefined} [params.stocks]
   * @param {number|null|undefined} [params.maxStock]
   */
  execute({ hubKind, buildingRow, stocks = null, maxStock = null }) {
    if (!buildingRow) {
      return Object.freeze({ hubKind, lines: Object.freeze([]), pieSegments: Object.freeze([]) });
    }

    if (hubKind === HUB_KIND.BARN) {
      const commerceStocks = createEmptyCommerceStocks(
        stocks ?? buildingRow.commerceStocks ?? {}
      );
      const capacity = getBarnCapacitySummary(buildingRow, commerceStocks);
      const storage = buildHubStorageLines({
        hubKind,
        stocks: commerceStocks,
        rawOrders: buildingRow.hubStorageOrders,
        totalCapacity: capacity.maxTotal,
      });

      const lines = Object.freeze(
        storage.lines.map((line) =>
          Object.freeze({
            ...line,
            emoji: getHubProductEmoji(line.productId),
            label: getHubProductLabel(hubKind, line.productId),
          })
        )
      );

      return Object.freeze({
        hubKind,
        title: 'Entrepôt commerce',
        workers: capacity.workers,
        workerNeed: buildingRow.employees?.worker_need ?? 0,
        ...storage,
        lines,
        pieSegments: buildHubStoragePieSegments({
          lines,
          totalCapacity: capacity.maxTotal,
        }),
      });
    }

    const hubStocks = stocks ?? buildingRow.stocks ?? {};
    const totalCapacity = maxStock ?? buildingRow.maxStock ?? 1000;
    const storage = buildHubStorageLines({
      hubKind,
      stocks: hubStocks,
      rawOrders: buildingRow.hubStorageOrders,
      totalCapacity,
    });

    const lines = Object.freeze(
      storage.lines.map((line) =>
        Object.freeze({
          ...line,
          emoji: getHubProductEmoji(line.productId),
          label: getHubProductLabel(hubKind, line.productId),
        })
      )
    );

    return Object.freeze({
      hubKind,
      title: 'Grenier — Moulin',
      workers: buildingRow.employees?.worker ?? 0,
      workerNeed: buildingRow.employees?.worker_need ?? 0,
      ...storage,
      lines,
      pieSegments: buildHubStoragePieSegments({
        lines,
        totalCapacity,
      }),
    });
  }
}
