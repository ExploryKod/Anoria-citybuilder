import { hasResourceRole, getLinkCapacityForRole, getPlacementRequirements } from './ResourceRolePolicy.js';
import { isWithinRange, manhattanDistance, findNaturalSourcesInRange } from './ResourceRangePolicy.js';
import { isRoadNeedMet, getNaturalSources } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Generic "does this building need another building already placed" gate —
 * driven entirely by `placementRequires` (see buildingCatalog.js). Replaces
 * the old windmill/market-only canPlaceMarketAt/pickOwningWindmillForMarket:
 * a market needing a windmill hub in range is just one instance of this,
 * not special-cased engine logic. `getPlacementRequirements` returning []
 * (the default for any type that doesn't declare it) means unconstrained.
 */

/**
 * Rank candidates satisfying one requirement (closest first, stable tie-break).
 *
 * @param {{ x: number, y: number }} pos
 * @param {Array<{ id: string, type: string, x?: number, y?: number, roadCount?: number, linkedDistributors?: object[] }>} candidates
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').PlacementRequirement} requirement
 */
export function rankRequirementCandidates(pos, candidates, requirement) {
  return [...candidates]
    .filter((candidate) => {
      if (candidate.x == null || candidate.y == null) return false;
      if (!isRoadNeedMet(candidate.type, candidate.roadCount)) return false;
      if (!hasResourceRole(candidate.type, requirement.role, requirement.categories)) return false;
      if (requirement.range != null && !isWithinRange(pos, candidate, requirement.range)) return false;

      if (requirement.requiresCapacity) {
        const capacity = getLinkCapacityForRole(candidate.type, requirement.role);
        const linkedCount = candidate.linkedDistributors?.length ?? 0;
        if (capacity != null && linkedCount >= capacity) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const distA = manhattanDistance(pos, a);
      const distB = manhattanDistance(pos, b);
      if (distA !== distB) return distA - distB;
      if (a.y !== b.y) return a.y - b.y;
      if (a.x !== b.x) return a.x - b.x;
      return a.id.localeCompare(b.id);
    });
}

/**
 * @param {{ x: number, y: number }} pos
 * @param {Array<object>} candidates
 * @param {import('../../../../shared/building-catalog/buildingCatalog.js').PlacementRequirement} requirement
 */
export function pickRequirementOwner(pos, candidates, requirement) {
  return rankRequirementCandidates(pos, candidates, requirement)[0] ?? null;
}

/**
 * @param {object} params
 * @param {number} params.x
 * @param {number} params.y
 * @param {string} params.buildingType
 * @param {Array<object>} params.candidates Every placed building that could
 *   satisfy any of this type's requirements (composition supplies this —
 *   today, every 'hub'-role building).
 * @param {Array<object>} [params.naturalCandidates] Every placed natural
 *   resource (a tree, ...), for a raw-material producer's `source` fact: it
 *   cannot be placed unless its resource is within the catalog's range.
 * @returns {{ ok: boolean, reason?: string, ownerId?: string, role?: string }}
 */
export function canPlaceBuildingAt({ x, y, buildingType, candidates, naturalCandidates = [] }) {
  for (const source of getNaturalSources(buildingType)) {
    if (findNaturalSourcesInRange({ x, y }, naturalCandidates, source).length === 0) {
      return { ok: false, reason: 'natural_resource_missing' };
    }
  }

  const requirements = getPlacementRequirements(buildingType);
  if (requirements.length === 0) {
    return { ok: true };
  }

  for (const requirement of requirements) {
    const roleMatches = candidates.filter((c) => hasResourceRole(c.type, requirement.role, requirement.categories));
    if (roleMatches.length === 0) {
      return { ok: false, reason: `${requirement.role}_missing` };
    }

    const owner = pickRequirementOwner({ x, y }, roleMatches, requirement);
    if (owner) {
      return { ok: true, ownerId: owner.id, role: requirement.role };
    }

    const hasNearby = roleMatches.some(
      (c) => c.x != null && c.y != null && (requirement.range == null || isWithinRange({ x, y }, c, requirement.range))
    );
    return { ok: false, reason: hasNearby ? `${requirement.role}_full` : `${requirement.role}_too_far` };
  }

  return { ok: true };
}
