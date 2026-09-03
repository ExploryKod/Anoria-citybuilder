/**
 * Building catalog — single source of truth for STATIC, DECLARATIVE facts
 * about each building type, shared (read-only) across bounded contexts.
 *
 * Hard rules for this file (do not violate them when editing):
 *   1. Data only — no functions that compute or decide anything, no side
 *      effects, no imports from a bounded context (`src/contexts/**`).
 *   2. No behavior — evolution rules, road-access checks, supply flows,
 *      etc. stay in their owning bounded context's domain/policies. This
 *      file never decides *what happens*, only *what is true* about a type.
 *   3. Add a field here only when the same fact is genuinely duplicated
 *      across ≥2 consumers today. Don't pre-model facts nobody needs yet
 *      (e.g. there is intentionally no "dependencies" section until a real
 *      duplicated fact justifies one).
 *
 * The raw per-id entries live in shared/asset-economy/ (buildingEconomy.js /
 * natureEconomy.js / terrainEconomy.js) for hand-authored village ids, split
 * by the same theme every other declarative catalog in this codebase uses,
 * plus Kenney's own auto-generated registry (kenneyCityKitRegistry.
 * generated.js) for its ~900 building ids. This file only merges them and
 * re-exports under the historic name — edit a village id's facts in its
 * theme file, never here; Kenney facts are auto-generated, never hand-edited
 * anywhere. `buildingCatalog` is the ONE place both are merged — nothing
 * else needs to import KENNEY_BUILDING_CATALOG_ENTRIES to get economy facts
 * (compare shared/asset-footprint/buildingFootprint.js, which does the same
 * for footprint).
 *
 * Each bounded context keeps its own accessor/policy file (e.g.
 * `EmploymentSectorCatalog.js`, `BuildingMaintenanceBreakdownPolicy.js`,
 * `HouseTypeCatalog.js`, `BuildingNotifications.js`) and derives its
 * exports from `buildingCatalog` below. Callers keep using those BC-owned
 * accessors — nothing outside this folder should read `buildingCatalog`
 * directly except those derivation points. This keeps a single edit point
 * (this file) while preserving bounded-context intent and boundaries.
 *
 * Section ownership:
 *   displayName      → presentation (toasts, tooltips, UI labels)
 *   construction     → construction BC + presentation (cost, UI category)
 *   employment       → employment BC (sector, worker/elite requirements)
 *   accounting       → accounting BC (recurring maintenance cost)
 *   residentialGroup → permanent social group tied to a house color (Housing +
 *     Employment). Never changes after placement — unlike `level`, which is
 *     mutable per-instance state persisted on the house row, not a catalog fact.
 *
 * Collision footprint (gridSize/footprintWidth/footprintDepth) does NOT live
 * here — it's a single-sourced fact in shared/asset-footprint/resolveFootprint.js
 * (Kenney's own auto-generated registry for Kenney ids, a sparse hand-authored
 * override elsewhere for anything non-1×1, default 1×1). Call resolveFootprint(id)
 * / resolveGridSize(id) instead of expecting it on a construction entry here.
 *
 * @typedef {Object} BuildingConstructionFacts
 * @property {number} price
 * @property {string} category
 *
 * @typedef {Object} BuildingEmploymentFacts
 * @property {number} sector
 * @property {number} [workerNeed] Omitted when computed dynamically by the
 *   owning bounded context (see Barn-001 below).
 * @property {number} [eliteNeed]
 *
 * @typedef {Object} BuildingAccountingFacts
 * @property {number} maintenance
 *
 * @typedef {'artisans' | 'merchants' | 'scholars'} ResidentialGroup
 *
 * @typedef {Object} BuildingDefinition
 * @property {string} [displayName]
 * @property {BuildingConstructionFacts} construction
 * @property {BuildingEmploymentFacts} [employment]
 * @property {BuildingAccountingFacts} [accounting]
 * @property {ResidentialGroup} [residentialGroup]
 */

import { BUILDING_ECONOMY } from '../asset-economy/buildingEconomy.js';
import { NATURE_ECONOMY } from '../asset-economy/natureEconomy.js';
import { TERRAIN_ECONOMY } from '../asset-economy/terrainEconomy.js';
import { KENNEY_BUILDING_CATALOG_ENTRIES } from './kenneyCityKitRegistry.generated.js';

/** @param {any} value */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Merge of the three theme-split village economy catalogs (asset-economy/)
 * plus Kenney's auto-generated registry — kept as one compat export so
 * every existing bounded-context derivation point
 * (EmploymentSectorCatalog.js, BuildingMaintenanceBreakdownPolicy.js,
 * HouseTypeCatalog.js, BuildingNotifications.js, ...) needs zero changes.
 * Add/edit a village id's facts in its theme file (buildingEconomy.js /
 * natureEconomy.js / terrainEconomy.js), never here; Kenney ids only have
 * `displayName`/`construction` (no employment/accounting/residentialGroup —
 * those sections are village-only facts today).
 *
 * @type {Readonly<Record<string, BuildingDefinition>>}
 */
export const buildingCatalog = deepFreeze({
  ...BUILDING_ECONOMY,
  ...NATURE_ECONOMY,
  ...TERRAIN_ECONOMY,
  ...KENNEY_BUILDING_CATALOG_ENTRIES,
});

/**
 * @param {string} id
 * @returns {BuildingDefinition | undefined}
 */
export function getBuildingDefinition(id) {
  return id ? buildingCatalog[id] : undefined;
}
