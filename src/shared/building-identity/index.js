export {
  createTileCoord,
  tryCreateTileCoord,
  toGridInteger,
} from './TileCoord.js';

export {
  createBuildingId,
  tryCreateBuildingId,
  toBuildingIdString,
  toPublishedBuildingId,
  parseBuildingId,
  tryParseBuildingId,
  isPublishedBuildingIdString,
  resolvePublishedBuildingIdFromRef,
} from './BuildingId.js';

export {
  createBuildingInstanceId,
  isBuildingInstanceId,
  assertBuildingInstanceId,
  tryBuildingInstanceId,
  formatInstanceIdForLog,
} from './BuildingInstanceId.js';

export {
  footprintFromAnchor,
  footprintFromRect,
  footprintFromRecord,
  footprintTilesAsPairs,
  footprintOccupiesTile,
} from './Footprint.js';

export {
  BUILDING_KIND_HOUSE,
  BUILDING_KIND_FARM,
  BUILDING_KIND_MARKET,
  BUILDING_KIND_FACTORY,
  BUILDING_KIND_WINDMILL,
  BUILDING_KIND_ROAD,
  BUILDING_KIND_NATURE,
  BUILDING_KIND_OTHER,
  HOUSE_TYPE_BLUE,
  HOUSE_TYPE_RED,
  HOUSE_TYPE_PURPLE,
  HOUSE_TYPE_PALACE,
  RESIDENTIAL_TIER_BY_TYPE,
  RESIDENTIAL_TYPE_BY_TIER,
  normalizeResidentialTypeLabel,
  resolveBuildingKind,
  initialTierForToolId,
  tierForResidentialType,
  residentialTypeForTier,
  isResidentialKind,
} from './BuildingKind.js';

export {
  canonicalizeHouseRecord,
  tryCanonicalizeHouseRecord,
  instanceIdFromHouseRow,
  tryInstanceIdFromHouseRow,
  resolveBuildingInstanceIdFromRef,
  tryResolveBuildingInstanceIdFromRef,
  resolveInstanceIdFromNeighborRef,
  displayLabelFromHouseRow,
  toDisplayLabel,
  residentialTierPatch,
} from './BuildingRecord.js';
