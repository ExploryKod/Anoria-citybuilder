import { isRoadType } from '../building-catalog/roadQueries.js';
import { buildingCatalog, getBuildingDefinition } from '../building-catalog/buildingCatalog.js';
import { getAnnualSupplyEntry, getResourceRoles, getSuppliedCategories, isQuantityDistributorType } from '../building-catalog/resourceRoleQueries.js';
import { depositKindsOf } from '../building-catalog/depositQueries.js';

export const BUILDING_KIND_HOUSE = 'house';
export const BUILDING_KIND_FARM = 'farm';
export const BUILDING_KIND_MARKET = 'market';
export const BUILDING_KIND_WINDMILL = 'windmill';
export const BUILDING_KIND_ROAD = 'road';
export const BUILDING_KIND_NATURE = 'nature';
export const BUILDING_KIND_OTHER = 'other';

/**
 * The house types, in catalog order: every type that declares a `residentialGroup`. What a house is, and how the
 * houses rank against each other (their tier: first declared = 1), is the catalog's — no house id is named here.
 * @returns {string[]}
 */
export function listResidentialTypes() {
  return Object.keys(buildingCatalog).filter((type) => buildingCatalog[type].residentialGroup);
}

/**
 * The catalog id a record's type stands for: the type itself, or — for a legacy instance name that carries its
 * position ('House-Blue-1-2') — the longest catalog id it starts with.
 * @param {string} type
 * @returns {string | null}
 */
function catalogIdOf(type) {
  if (!type) return null;
  if (buildingCatalog[type]) return type;
  const prefixes = Object.keys(buildingCatalog).filter((id) => type.startsWith(`${id}-`));
  return prefixes.sort((a, b) => b.length - a.length)[0] ?? null;
}

/**
 * The house type a label stands for (a legacy name that carries a suffix maps to its catalog id); any other
 * label comes back unchanged.
 * @param {string} type
 * @returns {string}
 */
export function normalizeResidentialTypeLabel(type) {
  const t = type || '';
  const id = catalogIdOf(t);
  return id && buildingCatalog[id].residentialGroup ? id : t;
}

/**
 * @param {string} toolOrTypeId
 * @returns {string}
 */
export function resolveBuildingKind(toolOrTypeId) {
  const t = toolOrTypeId || '';
  const id = catalogIdOf(t);
  const roles = id ? getResourceRoles(id) : [];
  const suppliedCategories = getSuppliedCategories();

  if (id && buildingCatalog[id].residentialGroup) return BUILDING_KIND_HOUSE;
  // A farm: it produces a supplied good once a year. A market: it hands out a stock. A windmill: a hub of what
  // the citizens eat. Each is a role the catalog declares, not a name.
  if (id && getAnnualSupplyEntry(id)) return BUILDING_KIND_FARM;
  if (id && isQuantityDistributorType(id)) return BUILDING_KIND_MARKET;
  if (roles.some((entry) => entry.role === 'hub' && entry.categories.some((c) => suppliedCategories.includes(c)))) return BUILDING_KIND_WINDMILL;
  if (isRoadType(t)) return BUILDING_KIND_ROAD;
  if (id && depositKindsOf(id).length > 0) return BUILDING_KIND_NATURE;
  return BUILDING_KIND_OTHER;
}

/**
 * The tier a house type starts at: its rank among the catalog's house types (first declared = 1), or null for a
 * type that is not a house.
 * @param {string} toolOrTypeId
 * @returns {number | null}
 */
export function initialTierForToolId(toolOrTypeId) {
  const index = listResidentialTypes().indexOf(normalizeResidentialTypeLabel(toolOrTypeId || ''));
  return index >= 0 ? index + 1 : null;
}

/**
 * @param {string} residentialType
 * @returns {number | null}
 */
export function tierForResidentialType(residentialType) {
  return initialTierForToolId(residentialType);
}

/**
 * @param {number} tier
 * @returns {string | null}
 */
export function residentialTypeForTier(tier) {
  return listResidentialTypes()[tier - 1] ?? null;
}

/**
 * @param {string} kind
 * @returns {boolean}
 */
export function isResidentialKind(kind) {
  return kind === BUILDING_KIND_HOUSE;
}
