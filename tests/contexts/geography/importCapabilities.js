import { getCategoriesForRole, getTotalKeyForRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { addCategoryAmount } from '../../../src/contexts/supply/domain/value-objects/ResourceStock.js';
import { lotOrigin } from '../../../src/contexts/supply/domain/policies/HubLotsPolicy.js';
import { referenceHubSellingPrice } from '../../helpers/referencePriceBook.js';

/** A relation row as the game opens it (createTradeContext.js): the cease state starts empty. */
export const openRelationRow = (fields) => ({
  status: 'active',
  satisfactionScore: 50,
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
export function importCapabilities({ merchantLines = [], cityLines = [], deliveries = [] } = {}) {
  return {
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
