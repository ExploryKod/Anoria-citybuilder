export {
  createTileCoord,
  tryCreateTileCoord,
  toGridInteger,
  createBuildingId,
  tryCreateBuildingId,
  toBuildingIdString,
  toPublishedBuildingId,
  parseBuildingId,
  tryParseBuildingId,
  isPublishedBuildingIdString,
  createBuildingInstanceId,
  isBuildingInstanceId,
  assertBuildingInstanceId,
  tryBuildingInstanceId,
  formatInstanceIdForLog,
} from './BuildingIdentifiers.js';

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
  BUILDING_KIND_WINDMILL,
  BUILDING_KIND_ROAD,
  BUILDING_KIND_NATURE,
  BUILDING_KIND_OTHER,
  normalizeResidentialTypeLabel,
  listResidentialTypes,
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
} from './BuildingRecord.js';
