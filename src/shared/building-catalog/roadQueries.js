import { buildingCatalog } from './buildingCatalog.js';

/**
 * What a road is, read from the catalog: every type that declares `isRoad`. Nothing here names a road tool.
 *
 * Two names are not catalog ids and stay as the runtime's own vocabulary: the marker a placed road's mesh/tile
 * carries for connectivity (`ROAD_RUNTIME_MARKER`, whichever road variant it is), and the legacy `Road` alias
 * some older saves and call sites still use.
 */

/** The type/name a placed road carries at runtime for connectivity, whatever its catalog variant. */
export const ROAD_RUNTIME_MARKER = 'roads';

/** Older saves and call sites spell a road as this; it is not a catalog id. */
const LEGACY_ROAD_ALIAS = 'Road';

/**
 * Whether a name is the road runtime marker (or its legacy alias) — a road as the scene marks it, not as the
 * catalog names a road tool.
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isRoadRuntimeMarker(type) {
  return type === ROAD_RUNTIME_MARKER || type === LEGACY_ROAD_ALIAS;
}

/**
 * The road types of the catalog, in catalog order.
 * @returns {string[]}
 */
export function listRoadTypes() {
  return Object.keys(buildingCatalog).filter((type) => buildingCatalog[type].isRoad === true);
}

/**
 * Whether a type, a tool id or a runtime marker is a road.
 * @param {string | null | undefined} type
 * @returns {boolean}
 */
export function isRoadType(type) {
  if (!type || typeof type !== 'string') return false;
  if (type === ROAD_RUNTIME_MARKER || type === LEGACY_ROAD_ALIAS) return true;
  // A mesh or record name may carry the position after the id ('<road id>-3-4').
  return listRoadTypes().some((road) => type === road || type.startsWith(`${road}-`));
}

/**
 * The road tool: the first road type the catalog declares (the one the build bar offers and whose
 * facts every placed road shares).
 * @returns {string}
 */
export function primaryRoadType() {
  const [first] = listRoadTypes();
  if (!first) throw new Error('[roadQueries] the catalog declares no road (isRoad: true)');
  return first;
}
