import { hasResourceRole, getPlacementRequirements } from '../contexts/supply/domain/policies/ResourceRolePolicy.js';
import { refreshSupplyPlacementIndex } from '../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';

/**
 * Event-driven supply link maintenance after placement / demolition.
 * Generic — driven by catalog roles/placementRequires (see
 * ResourceRolePolicy.js), not a hardcoded windmill/market type check: any
 * 'hub'-role building gets cascade-destroy + link init, any building with
 * `placementRequires` gets assign/detach.
 *
 * @param {object} params
 * @param {object} params.supply
 * @param {object} params.construction
 * @param {{ size: number, tiles: object[][] }} [params.city]
 * @param {'placed' | 'bulldozed'} params.event
 * @param {string | null | undefined} params.buildingType
 * @param {string | null | undefined} params.instanceId
 * @param {number} [params.x]
 * @param {number} [params.y]
 * @returns {Promise<object>}
 */
export async function syncSupplyLinksAfterBuildingChange({
  supply,
  construction,
  city = null,
  event,
  buildingType,
  instanceId,
  x,
  y,
}) {
  let outcome = { handled: false };

  const isHub = hasResourceRole(buildingType, 'hub');
  const hasPlacementRequirements = getPlacementRequirements(buildingType).length > 0;

  if (event === 'bulldozed' && isHub && instanceId && city) {
    outcome = await supply.cascadeDestroyHubDistributors({
      hubId: instanceId,
      city,
      bulldozeBuildingAtTile: (params) => construction.bulldozeBuildingAtTile(params),
    });
  }

  if (event === 'placed' && hasPlacementRequirements && instanceId) {
    outcome = await supply.assignDistributorToHub({
      distributorId: instanceId,
      distributorType: buildingType,
      x: x ?? 0,
      y: y ?? 0,
    });
  }

  if (event === 'bulldozed' && hasPlacementRequirements && instanceId) {
    outcome = await supply.detachDistributorFromHub({ distributorId: instanceId });
  }

  if (event === 'placed' && isHub && instanceId) {
    await supply.initializeHubLinks({ hubId: instanceId });
    outcome = { handled: true, initialized: true };
  }

  const rows = await construction.listAllBuildingRows();
  refreshSupplyPlacementIndex(rows);

  return outcome;
}
