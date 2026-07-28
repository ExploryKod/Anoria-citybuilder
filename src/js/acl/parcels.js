/**
 * ACL Parcels — seule porte d'entrée du legacy (`src/js/`) vers le BC Parcels.
 *
 * Ne pas importer `contexts/parcels/domain/**` depuis l'UI ou les services :
 * passer par ce module (chemins stables, surface contrôlée).
 *
 * Infrastructure (`src/infrastructure/`) et composition restent libres
 * d'importer le domaine / les ports directement.
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
} from '../../contexts/parcels/domain/value-objects/BuildingId.js';

export {
  createParcelsContext,
  getOrCreateParcelsContext,
} from '../../composition/createParcelsContext.js';
