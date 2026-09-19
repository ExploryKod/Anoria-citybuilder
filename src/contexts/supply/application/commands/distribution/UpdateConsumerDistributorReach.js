import { findBuildingsWithRoleInRange } from '../../../domain/policies/ResourceRangePolicy.js';
import { getRangeForRole } from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: flag each target-role building (houses/'consumer' by default) as
 * too-far-from-source when none of the source-role buildings
 * (markets/'distributor' by default) with road access reach it — using the
 * same generic range check every resource cycle uses, not a hand-rolled
 * filter-and-loop. Role names and the flag key are parameters, not baked
 * into this class — any future distributor/consumer pair reuses it as-is.
 */
export class UpdateConsumerDistributorReach {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} [params]
   * @param {number} [params.maxDistance=5] Fallback when a source's own catalog range is undeclared.
   * @param {import('../../../domain/policies/ResourceRolePolicy.js').ResourceRoleKind} [params.sourceRole='distributor']
   * @param {import('../../../domain/policies/ResourceRolePolicy.js').ResourceRoleKind} [params.targetRole='consumer']
   * @param {string} [params.tooFarFlag='distributorTooFar']
   * @param {string | string[]} [params.category] Scopes both the source and
   *   target search to this category — required once more than one
   *   'distributor'/'consumer' need exists (e.g. food vs. a chapel's faith
   *   service), so this flag doesn't conflate "too far for food" with "too
   *   far for an unrelated service". Omitted keeps the old unscoped
   *   behavior (every source/target holding the role, regardless of need).
   * @returns {Promise<{
   *   houses: number,
   *   marketsWithRoad: number,
   *   tooFar: number,
   *   inRange: number,
   * }>}
   */
  async execute({
    maxDistance = 5,
    sourceRole = 'distributor',
    targetRole = 'consumer',
    tooFarFlag = 'distributorTooFar',
    category,
  } = {}) {
    const sources = await this.supplyBuildingRepository.findByResourceRole(sourceRole, category);
    const targets = await this.supplyBuildingRepository.findByResourceRole(targetRole, category);

    let tooFar = 0;
    let inRange = 0;

    for (const target of targets) {
      if (target.x == null || target.y == null || !Number.isFinite(target.x) || !Number.isFinite(target.y)) {
        continue;
      }

      const reachable = findBuildingsWithRoleInRange(
        { x: target.x, y: target.y },
        sources,
        {
          role: sourceRole,
          category,
          maxDistance: (source) => getRangeForRole(source.type, sourceRole) ?? maxDistance,
        }
      );

      const flagValue = reachable.length === 0;
      await this.supplyBuildingRepository.saveSupplyFlags(target.id, { [tooFarFlag]: flagValue });

      if (flagValue) tooFar += 1;
      else inRange += 1;
    }

    return {
      houses: tooFar + inRange,
      marketsWithRoad: sources.filter((s) => (s.roads ?? s.roadCount ?? 0) > 0).length,
      tooFar,
      inRange,
    };
  }
}
