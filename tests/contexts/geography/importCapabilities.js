import { getCategoriesForRole, getTotalKeyForRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { addCategoryAmount } from '../../../src/contexts/supply/domain/value-objects/ResourceStock.js';
import { lotOrigin } from '../../../src/contexts/supply/domain/policies/HubLotsPolicy.js';
import { referenceHubSellingPrice } from '../../helpers/referencePriceBook.js';
import { getTradeCatalogEntry } from '../../../src/shared/trade-catalog/TradeCatalog.js';
import { openingGoodReview, openingGoodSatisfaction } from '../../../src/shared/trade-catalog/satisfaction.js';
import { embargoesIn } from '../../../src/contexts/geography/domain/policies/RelationMemoryPolicy.js';
import { createWorldReferencePrices } from '../../../src/composition/createWorldReferencePrices.js';

/** The world's reference price of a good, as the game computes it (the cities' prices are built on it). */
export const { referencePriceOf } = createWorldReferencePrices();

/** A relation row as the game opens it (createTradeContext.js): the cease state starts empty, every good at the middle of the satisfaction scale. */
export const openRelationRow = (fields) => ({
  status: 'active',
  goodSatisfaction: openingGoodSatisfaction(getTradeCatalogEntry(fields.cityId)),
  goodReview: openingGoodReview(),
  lastOrderMonth: null,
  contractEndMonth: null,
  ceased: null,
  importCeased: {},
  importFailures: {},
  exportCeased: {},
  exportFailures: {},
  ...fields,
});

/**
 * The import capabilities of RunMonthlyCityTradeCycle, as createTradeContext.js wires them (geography is injected
 * them, never importing supply's domain layer itself). `merchantLines`, `cityLines` and `deliveries` collect what the
 * cycle books and sells for an import.
 */
export function importCapabilities({ merchantLines = [], cityLines = [], deliveries = [], relationEventLog = [] } = {}) {
  return {
    referencePriceOf,
    // No limit by law, and the calendar of a 30-day month.
    volumeLimitOf: async () => null,
    daysPerMonth: () => 30,
    turnsPerYear: () => 360,
    // The relation's journal, in memory: what the cycle writes in it is in `relationEventLog`.
    relationEvents: {
      record: async (event) => { relationEventLog.push(event); },
      listOf: async (cityId) => relationEventLog.filter((event) => event.cityId === cityId),
      embargoesOf: async (cityId) => embargoesIn(relationEventLog.filter((event) => event.cityId === cityId)),
      lastCustoms: async (cityId, good, flow) => relationEventLog.filter((event) => event.cityId === cityId && event.kind.startsWith('customs_') && event.good === good && event.flow === flow).at(-1) ?? null,
    },
    recordMerchantLine: async (line) => {
      merchantLines.push(line);
      return { recorded: true };
    },
    recordCityLine: async (line) => {
      cityLines.push(line);
      return { recorded: true };
    },
    recordImportDelivery: async (delivery) => {
      deliveries.push(delivery);
    },
    hubSellingPrice: referenceHubSellingPrice,
    producerOfLot: (lotKey) => lotOrigin(lotKey).producerId || null,
    hubHolds: (hub, category) => getCategoriesForRole(hub.type, 'hub').includes(category),
    hubRoom: (hub) => Math.max(0, hub.maxStock - (hub.stocks[getTotalKeyForRole(hub.type, 'hub')] ?? 0)),
    addHubStock: (hub, category, amount) =>
      addCategoryAmount(hub.stocks, category, amount, getCategoriesForRole(hub.type, 'hub'), getTotalKeyForRole(hub.type, 'hub')),
  };
}
