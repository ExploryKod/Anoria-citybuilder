import {
  getHubProductEmoji,
  getHubProductLabel,
} from '../../domain/catalogs/HubStorageCatalog.js';
import { buildHubStorageLines } from '../../domain/policies/HubStorageOrdersPolicy.js';
import { buildHubStoragePieSegments } from '../../domain/policies/HubStoragePiePolicy.js';

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
      linkedMarkets: Object.freeze(
        (buildingRow.linkedMarkets ?? []).map((entry) =>
          Object.freeze({
            marketId: entry.marketId,
            x: entry.x,
            y: entry.y,
            allocatedStocks: Object.freeze({ ...entry.allocatedStocks }),
          })
        )
      ),
    });
  }
}
