/**
 * ACL Building identity — seule porte d'entrée legacy (`src/js/`) vers le Shared Kernel.
 *
 * Identifiants transverses : Parcels, Supply, Employment, HousesStore.
 * Ne pas importer `shared/building-identity` directement depuis l'UI — passer par ce module.
 */

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
  resolvePublishedBuildingIdFromRef,
  canonicalizeHouseRecord,
  tryCanonicalizeHouseRecord,
  publishedIdFromHouseRow,
  tryPublishedIdFromHouseRow,
} from '../../shared/building-identity/index.js';
