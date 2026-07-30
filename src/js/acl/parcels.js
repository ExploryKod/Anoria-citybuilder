/**
 * ACL Parcels — seule porte d'entrée du legacy (`src/js/`) vers le BC Parcels.
 *
 * Ne pas importer `contexts/parcels/domain/**` depuis l'UI ou les services :
 * passer par ce module (chemins stables, surface contrôlée).
 *
 * Building identity : voir `acl/building-identity.js` (Shared Kernel).
 */

export {
  hasRoadAccessFromCount,
} from '../../contexts/parcels/domain/value-objects/RoadAccess.js';

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
} from './building-identity.js';

export {
  createParcelsContext,
  getOrCreateParcelsContext,
} from '../../composition/createParcelsContext.js';

export {
  setupRoadAccessIcons,
  clearRoadAccessIconViews,
} from '../../contexts/parcels/infrastructure/presentation/roadAccessIcons.js';
