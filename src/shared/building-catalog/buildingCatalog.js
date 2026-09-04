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
 * natureEconomy.js / terrainEconomy.js), split by the same theme every other
 * declarative catalog in this codebase uses. This file only merges the three
 * theme catalogs and re-exports under the historic name — it has NO idea
 * Kenney exists, or any other source; that knowledge lives inside
 * buildingEconomy.js itself (which folds Kenney's auto-generated registry
 * into the building theme, same pattern as
 * shared/asset-footprint/buildingFootprint.js). Edit an id's facts in its
 * theme file, never here.
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
 *   resourceRoles    → Supply BC (which resource categories this building type
 *     produces/collects/holds/distributes/consumes, and at what range). Structural
 *     facts about the TYPE (a farm always produces wheat) — unlike a walker
 *     journey, which is conditional and belongs to an event, not a type.
 *     See contexts/supply/domain/policies/ResourceRolePolicy.js.
 *
 * No `walker` section here on purpose: a walker never exists without a
 * triggering domain event, so origin/destination/road-requirement are
 * facts about that EVENT, not about a building type — see
 * shared/gameplay/walkerEventCatalog.js.
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
 *   owning bounded context.
 * @property {number} [eliteNeed]
 *
 * @typedef {Object} BuildingAccountingFacts
 * @property {number} maintenance
 *
 * @typedef {'artisans' | 'merchants' | 'scholars'} ResidentialGroup
 *
 * @typedef {'producer' | 'collector' | 'hub' | 'distributor' | 'consumer'} ResourceRoleKind
 *
 * @typedef {Object} ResourceRoleFacts
 * @property {ResourceRoleKind} role
 * @property {string[]} categories Resource categories this role applies to (e.g. ['wheat']).
 * @property {number} [range] Manhattan tiles this role reaches — only meaningful for
 *   'collector' (pulls from nearby producer/hub) and 'distributor' (pushes to
 *   nearby consumers). Omitted for 'producer'/'hub'/'consumer', which don't reach.
 * @property {number} [linkCapacity] Max number of distributors a 'hub' can
 *   stay linked to at once (e.g. how many markets one windmill can serve).
 *   Only meaningful for 'hub'.
 *
 * @typedef {Object} PlacementRequirement
 * @property {ResourceRoleKind} role Role another, already-placed building must
 *   hold (e.g. 'hub') for this placement to be allowed.
 * @property {string[]} categories Which of that role's categories satisfy it.
 * @property {number} [range] Manhattan tiles to search within. Omitted means
 *   anywhere in the city (no distance limit).
 * @property {boolean} [requiresCapacity] When true, the found building must
 *   also have room under its own `linkCapacity` (not already at its cap).
 *
 * @typedef {Object} BuildingDefinition
 * @property {string} [displayName]
 * @property {BuildingConstructionFacts} construction
 * @property {BuildingEmploymentFacts} [employment]
 * @property {BuildingAccountingFacts} [accounting]
 * @property {ResidentialGroup} [residentialGroup]
 * @property {ResourceRoleFacts[]} [resourceRoles] A building can hold more than
 *   one role at once (e.g. a windmill both collects from farms and holds a hub
 *   stock for markets to pull from).
 * @property {PlacementRequirement[]} [placementRequires] One or more other
 *   buildings that must already be placed (and, if `requiresCapacity`, have
 *   room) before this building can be placed at all — e.g. a market can't be
 *   placed without a windmill hub in range. Omitted/empty means unconstrained.
 */

import { BUILDING_ECONOMY } from '../asset-economy/buildingEconomy.js';
import { NATURE_ECONOMY } from '../asset-economy/natureEconomy.js';
import { TERRAIN_ECONOMY } from '../asset-economy/terrainEconomy.js';

/** @param {any} value */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/**
 * Merge of the three theme-split economy catalogs (asset-economy/) — kept
 * as one compat export so every existing bounded-context derivation point
 * (EmploymentSectorCatalog.js, BuildingMaintenanceBreakdownPolicy.js,
 * HouseTypeCatalog.js, BuildingNotifications.js, ...) needs zero changes.
 * Add/edit an entry in its theme file (buildingEconomy.js / natureEconomy.js
 * / terrainEconomy.js), never here — this file itself never names a source.
 *
 * @type {Readonly<Record<string, BuildingDefinition>>}
 */
export const buildingCatalog = deepFreeze({
  ...BUILDING_ECONOMY,
  ...NATURE_ECONOMY,
  ...TERRAIN_ECONOMY,
});

/**
 * @param {string} id
 * @returns {BuildingDefinition | undefined}
 */
export function getBuildingDefinition(id) {
  return id ? buildingCatalog[id] : undefined;
}
