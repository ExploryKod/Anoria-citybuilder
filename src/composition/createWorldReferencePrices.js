import { buildingCatalog } from '../shared/building-catalog/buildingCatalog.js';
import { MARGIN_BY_STAGE, unitPriceAtStage } from '../shared/resource-catalog/ValueChainCatalog.js';
import { standardUnitCostOf } from '../contexts/supply/domain/policies/StandardUnitCostPolicy.js';
import { START_WAGE_BASE, START_WAGE_BY_SKILL } from '../contexts/accounting/domain/catalogs/LabourMarketCatalog.js';
import { DEFAULT_HAMLET_FISCAL_RATES } from '../contexts/accounting/domain/catalogs/FiscalRateCatalog.js';

/**
 * The world's reference price of each good: what a producer sells it at when it is made at the WORLD's reference wage (the labour market's starting wages: a first wage is the
 * world's yardstick), with the world's contributions and the catalog's upkeep and inputs. It is the same standard cost as the price book's (StandardUnitCostPolicy), but at the
 * world's wage instead of the hamlet's own: so a partner city's prices (`reference price × its living standard × its premium`, see WorldPricePolicy) do not follow our wages.
 * When our wages rise above the reference our goods cost more than the world's; when they fall, less: the market of the world answers what we decide at home.
 *
 * A good no building with a workforce makes (what a cooperative makes, or an import) has no cost to read: its reference is the value chain's producer price. A good made by
 * several types takes the cheapest. The inputs of a good are bought at the hub price of their own reference. Nothing is stored: it is read from the catalogs, and cached.
 *
 * @returns {{ referencePriceOf: (good: string) => number }}
 */
export function createWorldReferencePrices() {
  /** @type {Map<string, number>} */
  const cache = new Map();
  const inProgress = new Set();

  const makerTypesOf = (good) =>
    Object.entries(buildingCatalog)
      .filter(([, definition]) =>
        definition.employment?.workerNeed &&
        definition.employment.requiredSkill &&
        (definition.resourceRoles ?? []).some((role) => role.role === 'producer' && role.categories.includes(good)))
      .map(([type]) => type);

  const hubPriceOf = (good) => referencePriceOf(good) * (1 + MARGIN_BY_STAGE.hub);

  function referencePriceOf(good) {
    if (cache.has(good)) return cache.get(good);
    if (inProgress.has(good)) throw new Error(`[world-price] the reference price of "${good}" depends on itself (a recipe that needs what it makes)`);
    inProgress.add(good);
    const costs = makerTypesOf(good).map((buildingType) =>
      standardUnitCostOf({
        buildingType,
        category: good,
        wageRateOf: (skill) => START_WAGE_BY_SKILL[skill] ?? START_WAGE_BASE,
        maintenanceCostOf: (type) => buildingCatalog[type].accounting?.maintenance ?? 0,
        employerContributionRate: DEFAULT_HAMLET_FISCAL_RATES.employerContributionRate,
        inputPriceOf: hubPriceOf,
      }));
    inProgress.delete(good);
    const price = costs.length > 0 ? Math.min(...costs) * (1 + MARGIN_BY_STAGE.producer) : unitPriceAtStage('producer', good);
    if (!(price > 0)) throw new Error(`[world-price] the reference price of "${good}" is ${price}: a good has a price above 0`);
    cache.set(good, price);
    return price;
  }

  return { referencePriceOf };
}
