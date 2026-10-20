import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../../../../shared/building-identity/index.js';

/** The journal lines that are a producer's sale to a house: goods (producer_revenue) and services (service_sales), both HT. */
const SALE_TYPES = new Set(['producer_revenue', 'service_sales']);

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * Application query — the HT revenue of each producer of the active hamlet in one month: what its sales to the houses brought
 * in, goods and services, read from the journal. A sale is a line of the seller's account whose counterparty is a house.
 * Read, never written: the journal stays the only record of money.
 */
export class GetProducerRevenues {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {() => Promise<Map<string, string>>} deps.getBuildingTypes each building of the hamlet, by id, with its type
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {number} year
   * @param {number} monthIndex
   * @returns {Promise<Array<{ buildingId: string, buildingType: string, revenueHT: number }>>} the largest revenue first
   */
  async execute(year, monthIndex) {
    const month = monthIndex + 1;
    const entries = await this.deps.getJournalEntries();
    const types = await this.deps.getBuildingTypes();
    const typeOf = (buildingId) => {
      const type = types.get(buildingId);
      if (!type) throw new Error(`[producer] building ${buildingId} is not in the hamlet: its sales cannot be ranked`);
      return type;
    };

    const revenues = new Map();
    for (const entry of entries) {
      if (!SALE_TYPES.has(entry.type) || entry.year !== year || entry.month !== month) continue;
      if (!entry.accountBuildingId || !entry.counterpartyBuildingId) continue;
      if (resolveBuildingKind(typeOf(entry.counterpartyBuildingId)) !== BUILDING_KIND_HOUSE) continue;
      const current = revenues.get(entry.accountBuildingId) ?? {
        buildingId: entry.accountBuildingId,
        buildingType: typeOf(entry.accountBuildingId),
        revenueHT: 0,
      };
      current.revenueHT = centimes(current.revenueHT + entry.amount);
      revenues.set(entry.accountBuildingId, current);
    }
    return [...revenues.values()].sort((a, b) => b.revenueHT - a.revenueHT);
  }
}
