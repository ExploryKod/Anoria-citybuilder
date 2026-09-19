/**
 * Regression guard — a tier gate must never depend on a service that can only
 * be staffed by houses already past that gate.
 *
 * A house ADVANCES into tier N only if every `serviceCoverage` category N
 * requires is served — and a distributor only serves while it is operational
 * (road access AND staff, see OperationalGatePolicy). So the workplace behind
 * that category must be staffable by citizens of houses at tier N-1 or lower;
 * otherwise the service never opens and no house ever reaches tier N (a
 * deadlock: e.g. the School once required `education` level 2, granted only
 * from tier 5 — the very tier that requires the School to be running).
 */
import { describe, expect, test } from '@jest/globals';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';
import { buildingCatalog } from '../../../src/shared/building-catalog/buildingCatalog.js';

/** Earliest tier (any group) whose requirements read this service category. */
function earliestTierRequiring(category) {
  let earliest = Infinity;
  for (const group of Object.values(SOCIAL_CATEGORY)) {
    for (const [tier, def] of Object.entries(group.tiers)) {
      if (def.requirements.some((r) => r.kind === 'serviceCoverage' && r.category === category)) {
        earliest = Math.min(earliest, Number(tier));
      }
    }
  }
  return earliest;
}

/** Earliest tier (any group) granting `skill` at `level` or more. */
function earliestTierGranting(skill, level) {
  let earliest = Infinity;
  for (const group of Object.values(SOCIAL_CATEGORY)) {
    for (const [tier, def] of Object.entries(group.tiers)) {
      if ((def.skills[skill] ?? 0) >= level) earliest = Math.min(earliest, Number(tier));
    }
  }
  return earliest;
}

describe('service staffing readiness (no tier-gate deadlock)', () => {
  const gatedServices = Object.entries(buildingCatalog).flatMap(([id, def]) => {
    const role = def.resourceRoles?.find((r) => r.role === 'distributor' && r.consumption === 'flag');
    if (!role || !def.employment?.requiredSkill) return [];
    return role.categories
      .filter((category) => Number.isFinite(earliestTierRequiring(category)))
      .map((category) => ({ id, category, employment: def.employment }));
  });

  test('the check actually covers the gating services', () => {
    expect(gatedServices.map(({ id }) => id)).toEqual(expect.arrayContaining(['Chapel', 'Doctor', 'School', 'Cinema']));
  });

  test.each(gatedServices.map((s) => [s.id, s]))(
    '%s can be staffed before the tier that requires its coverage',
    (_id, { category, employment }) => {
      const needsTier = earliestTierRequiring(category);
      const level = employment.requiredSkillLevel ?? 1;
      const grantedAt = earliestTierGranting(employment.requiredSkill, level);
      // Houses at tier needsTier-1 (the ones trying to advance) must already provide the skill.
      expect(grantedAt).toBeLessThanOrEqual(needsTier - 1);
    },
  );
});
