import {
  resolveCitizenStatusFromLevel,
  getCitizenStatusProfile,
} from '../../../../shared/population/CitizenStatusCatalog.js';

import { listResidentialTypes, normalizeResidentialTypeLabel } from '../../../../shared/building-identity/index.js';

/**
 * Level 1 (autarky / hunter-gatherer) houses are self-sufficient and pay no
 * citizen tax — only level 2 (group profession, road-connected) houses do.
 * Missing `level` defaults to 1 (matches Housing's own default for
 * un-migrated / freshly-placed rows), so it's exempt until promoted.
 *
 * Tax eligibility is determined by the shared population catalog.
 *
 * @param {Array<{ type?: string, pop?: number, level?: number }>} houses
 * @param {number} taxPerCapita
 */
export function computeCitizenTaxBreakdown(houses, taxPerCapita) {
  // One line per house type the catalog declares (keyed by its id), then the totals.
  const houseTypes = listResidentialTypes();
  const taxBreakdown = {
    ...Object.fromEntries(houseTypes.map((type) => [type, 0])),
    total: 0,
    population: 0,
  };

  for (const { houseType, amount, pop } of taxedHouses(houses, taxPerCapita)) {
    taxBreakdown[houseType] = Math.round(taxBreakdown[houseType] + amount);
    taxBreakdown.total = Math.round(taxBreakdown.total + amount);
    taxBreakdown.population += pop;
  }

  return taxBreakdown;
}

/**
 * The same tax, per house: what each taxed house owes this year, so it can be charged to that house's own account
 * (see RecordCitizenTaxIncome.js) — a house's citizen tax must be visible on its own Finances tab, not only folded
 * into the city's lump sum.
 * @param {Array<{ id?: string, type?: string, pop?: number, level?: number }>} houses
 * @param {number} taxPerCapita
 * @returns {Array<{ houseId: string, pop: number, amount: number }>}
 */
export function computeCitizenTaxByHouse(houses, taxPerCapita) {
  const byHouse = [];
  for (const { house, pop, amount } of taxedHouses(houses, taxPerCapita)) {
    if (amount <= 0) continue;
    if (!house.id) throw new Error('[citizen-tax] a taxed house has no id: its tax cannot be attributed to an account');
    byHouse.push({ houseId: house.id, pop, amount });
  }
  return byHouse;
}

/**
 * The houses that owe the citizen tax this year, each with its own amount — the eligibility rule shared by both
 * views above (per type, per house).
 * @param {Array<{ id?: string, type?: string, pop?: number, level?: number }>} houses
 * @param {number} taxPerCapita
 */
function* taxedHouses(houses, taxPerCapita) {
  const houseTypes = listResidentialTypes();
  for (const house of houses) {
    const houseType = house.type ? normalizeResidentialTypeLabel(house.type) : null;
    if (!houseType || !houseTypes.includes(houseType)) {
      continue;
    }

    const statusKey = resolveCitizenStatusFromLevel(house.level ?? 1);
    const profile = getCitizenStatusProfile(statusKey);

    if (!profile.accounting.paysCitizenTax) {
      continue;
    }

    const pop = house.pop || 0;
    if (pop <= 0) {
      continue;
    }

    yield { house, houseType, pop, amount: Math.round(pop * taxPerCapita) };
  }
}
