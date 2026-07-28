/**
 * ACL Urban — seule porte d'entrée du legacy (`src/js/`) vers le BC Urban.
 *
 * Ne pas importer `contexts/urban/domain/**` depuis l'UI ou les services :
 * passer par ce module (chemins stables, surface contrôlée).
 *
 * Infrastructure (`src/infrastructure/`) et composition restent libres
 * d'importer le domaine / les ports directement.
 */

export {
  hasRoadAccessFromCount,
} from '../../contexts/urban/domain/value-objects/RoadAccess.js';

export {
  toBuildingIdString,
  createBuildingId,
  tryCreateBuildingId,
  parseBuildingId,
  tryParseBuildingId,
  toPublishedBuildingId,
} from '../../contexts/urban/domain/value-objects/BuildingId.js';

export {
  createUrbanContext,
  getOrCreateUrbanContext,
} from '../../composition/createUrbanContext.js';
