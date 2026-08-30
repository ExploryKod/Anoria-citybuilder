// Kenney city kits — prefab GLB buildings (commercial, industrial, suburban).

export const KENNEY_CITY_KIT_CATALOG_URL =
  '/resources/kenney_city_kits_catalog.json';

export const KENNEY_CITY_KIT_PLATFORM_HEIGHT = 0.2;

export {
  KENNEY_BUILDING_CATALOG_ENTRIES,
  KENNEY_CITY_KIT_BUILDING_IDS,
  KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID,
  KENNEY_CITY_KIT_TOOL_META,
  KENNEY_CITY_KIT_TOOLS_BY_CATEGORY,
} from '../../../../shared/building-catalog/kenneyCityKitRegistry.generated.js';

/**
 * @param {string | null | undefined} buildingId
 * @returns {boolean}
 */
export function isKenneyBuildingId(buildingId) {
  return typeof buildingId === 'string' && buildingId.startsWith('Kenney-');
}
