/**
 * Composition ops — migrated from facades/parcels.js (plan_use_case_wiring Barre 5).
 * Prefer sessionApi / create*Context for new call sites.
 */

export {
  hasRoadAccessFromCount,
} from '../contexts/parcels/domain/value-objects/RoadAccess.js';

export {
  toBuildingIdString,
  createBuildingId,
  tryCreateBuildingId,
  parseBuildingId,
  tryParseBuildingId,
  toPublishedBuildingId,
  isPublishedBuildingIdString,
  createBuildingInstanceId,
  instanceIdFromHouseRow,
  tryInstanceIdFromHouseRow,
  canonicalizeHouseRecord,
  tryCanonicalizeHouseRecord,
  toDisplayLabel,
} from '../shared/building-identity/index.js';

export {
  createParcelsContext,
  getOrCreateParcelsContext,
} from './createParcelsContext.js';

export {
  setupRoadAccessIcons,
  clearRoadAccessIconViews,
} from '../contexts/parcels/infrastructure/presentation/roadAccessIcons.js';

export {
  getBuildingsNamesInZone,
  zoneBordersBuildings,
} from '../contexts/parcels/infrastructure/spatial/sceneNeighborhoodScan.js';

import { getOrCreateParcelsContext } from './createParcelsContext.js';

/** Delete building row + refresh neighbors / road access (Parcels BC). */
export async function syncRemovedBuilding(params) {
  return getOrCreateParcelsContext().syncRemovedBuilding(params);
}
