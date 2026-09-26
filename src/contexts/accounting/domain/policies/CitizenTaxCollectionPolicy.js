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

    const taxPerHouse = Math.round(pop * taxPerCapita);

    taxBreakdown[houseType] = Math.round(taxBreakdown[houseType] + taxPerHouse);

    taxBreakdown.total = Math.round(taxBreakdown.total + taxPerHouse);
    taxBreakdown.population += pop;
  }

  return taxBreakdown;
}
