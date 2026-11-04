import { requireActiveHamletId } from '../core/persistence/hamlet/hamletSession.js';

/**
 * What the supply needs to decide which houses a bounded service building reaches first: the order, by one of the rules the catalog
 * names (`capacity.serveFirst`). The supply knows no citizen; the rules are read here, from the citizens registry.
 *
 * - `lowestHealth`: the houses whose inhabitants are the least healthy first (their average), a house nobody lives in last, ties by id
 *   so the order never depends on the order the houses were listed in.
 *
 * @param {import('../shared/citizens/DexieCitizenRegistry.js').DexieCitizenRegistry} citizens
 */
export function createServiceQueuePort(citizens) {
  const rules = {
    lowestHealth: async (houses) => {
      const byHouse = await citizens.forHamlet(requireActiveHamletId());
      const averageOf = (houseId) => {
        const inhabitants = byHouse.get(houseId) ?? [];
        return inhabitants.length === 0 ? Infinity : inhabitants.reduce((sum, citizen) => sum + citizen.health, 0) / inhabitants.length;
      };
      return [...houses].sort((a, b) => {
        const gap = averageOf(a.id) - averageOf(b.id);
        if (gap !== 0 && !Number.isNaN(gap)) return gap;
        return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      });
    },
  };
  return {
    /**
     * @param {string} rule a `serveFirst` of the catalog
     * @param {Array<{ id: string, pop: number }>} houses
     * @returns {Promise<Array<{ id: string, pop: number }>>}
     */
    async order(rule, houses) {
      const order = rules[rule];
      if (!order) throw new Error(`[supply] the service queue knows no rule "${rule}" (known: ${Object.keys(rules).join(', ')})`);
      return order(houses);
    },
  };
}
