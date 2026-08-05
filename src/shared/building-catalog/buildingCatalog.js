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
 *   construction     → construction BC + presentation (cost, UI category, footprint)
 *   employment       → employment BC (sector, worker/elite requirements)
 *   accounting       → accounting BC (recurring maintenance cost)
 *   residentialGroup → permanent social group tied to a house color (Housing +
 *     Employment). Never changes after placement — unlike `level`, which is
 *     mutable per-instance state persisted on the house row, not a catalog fact.
 *
 * @typedef {Object} BuildingConstructionFacts
 * @property {number} price
 * @property {string} category
 * @property {number} gridSize
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
 * @typedef {'artisans-ouvriers' | 'commercants' | 'savants'} ResidentialGroup
 *
 * @typedef {Object} BuildingDefinition
 * @property {string} [displayName]
 * @property {BuildingConstructionFacts} construction
 * @property {BuildingEmploymentFacts} [employment]
 * @property {BuildingAccountingFacts} [accounting]
 * @property {ResidentialGroup} [residentialGroup]
 */

/** @param {any} value */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

/** @type {Record<string, BuildingDefinition>} */
const RAW_CATALOG = {
  // Zones
  grass: { displayName: 'Herbe', construction: { price: 0, category: 'zones', gridSize: 1 } },
  terrain: { construction: { price: 0, category: 'zones', gridSize: 1 } },

  // Roads (StonePath variants reuse one mesh with different rotations)
  roads: {
    displayName: 'Route',
    construction: { price: 5, category: 'infrastructure', gridSize: 1 },
    employment: { sector: 5, workerNeed: 0, eliteNeed: 0 },
    accounting: { maintenance: 4 },
  },
  'StonePath-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure', gridSize: 1 },
  },
  'StonePath-Right-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure', gridSize: 1 },
  },
  'StonePath-Left-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure', gridSize: 1 },
  },
  'StonePath-Cross-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure', gridSize: 1 },
  },

  // Houses — color = permanent social group (never changes after placement).
  // Mutable progression (autarky vs specialized profession) lives in `level`,
  // a per-instance house row field owned by Housing — not a catalog fact.
  'House-Blue': {
    displayName: 'Maison bleue',
    construction: { price: 10, category: 'houses', gridSize: 1 },
    accounting: { maintenance: 6 },
    residentialGroup: 'commerçants',
  },
  'House-Red': {
    displayName: 'Maison rouge',
    construction: { price: 10, category: 'houses', gridSize: 1 },
    accounting: { maintenance: 6 },
    residentialGroup: 'artisans-ouvriers',
  },
  'House-Purple': {
    displayName: 'Maison violette',
    construction: { price: 10, category: 'houses', gridSize: 1 },
    accounting: { maintenance: 6 },
    residentialGroup: 'savants',
  },

  // Palaces
  'House-2Story': {
    displayName: 'Palais',
    construction: { price: 20, category: 'palaces', gridSize: 1 },
    accounting: { maintenance: 6 },
  },

  // Tombs / cemetery
  'Tombstone-1': { displayName: 'Pierre tombale', construction: { price: 2, category: 'tombs', gridSize: 1 } },
  'Tombstone-2': { displayName: 'Pierre tombale', construction: { price: 4, category: 'tombs', gridSize: 1 } },
  'Tombstone-3': { displayName: 'Pierre tombale', construction: { price: 8, category: 'tombs', gridSize: 1 } },
  'Grave-1': { displayName: 'Tombe', construction: { price: 3, category: 'tombs', gridSize: 1 } },
  'Grave-2': { displayName: 'Tombe', construction: { price: 3, category: 'tombs', gridSize: 1 } },
  Tomb: { displayName: 'Tombeau', construction: { price: 5, category: 'tombs', gridSize: 1 } },
  Coffin: { displayName: 'Cercueil', construction: { price: 4, category: 'tombs', gridSize: 1 } },

  // Farms
  'Farm-Wheat': {
    displayName: 'Champ de blé',
    construction: { price: 10, category: 'farms', gridSize: 1 },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
  },
  'Farm-Carrot': {
    displayName: 'Champ de carottes',
    construction: { price: 20, category: 'farms', gridSize: 1 },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
  },
  'Farm-Cabbage': {
    displayName: 'Champ de choux',
    construction: { price: 30, category: 'farms', gridSize: 1 },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
  },
  'Hay-Bale': { displayName: 'Botte de foin', construction: { price: 2, category: 'farms', gridSize: 1 } },
  'Hay-Cart': { displayName: 'Chariot de foin', construction: { price: 5, category: 'farms', gridSize: 1 } },
  'Hay-Pile': { displayName: 'Meule de foin', construction: { price: 2, category: 'farms', gridSize: 1 } },

  // Industry
  'Windmill-001': {
    displayName: 'Moulin',
    construction: { price: 50, category: 'industry', gridSize: 1 },
    employment: { sector: 4, workerNeed: 4, eliteNeed: 2 },
  },
  'Barn-001': {
    displayName: 'Grange',
    construction: { price: 40, category: 'industry', gridSize: 2 },
    // Worker capacity is derived from storage rules owned by the supply
    // bounded context (see BarnCommerceCatalog.getBarnMaxWorkers) — not a
    // fixed catalog fact, so workerNeed/eliteNeed are intentionally absent.
    employment: { sector: 4 },
  },
  'Crate-001': { displayName: 'Caisse', construction: { price: 2, category: 'industry', gridSize: 1 } },
  'Winery-001': {
    displayName: 'Chai',
    construction: { price: 50, category: 'industry', gridSize: 1 },
    employment: { sector: 3, workerNeed: 18, eliteNeed: 0 },
  },
  // Wheat silo (all Cylinder* meshes pool to this one tool)
  Cylinder: { displayName: 'Silo à blé', construction: { price: 15, category: 'industry', gridSize: 1 } },

  // Markets
  'Market-Stall': {
    displayName: 'Étal',
    construction: { price: 10, category: 'markets', gridSize: 1 },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
  },
  'Market-Stall-Blue': {
    displayName: 'Étal bleu',
    construction: { price: 10, category: 'markets', gridSize: 1 },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
  },
  'Market-Stall-Red': {
    displayName: 'Étal rouge',
    construction: { price: 10, category: 'markets', gridSize: 1 },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
  },

  // Infrastructure
  'Well-001': { displayName: 'Puits', construction: { price: 15, category: 'infrastructure', gridSize: 1 } },
  'Fountain-001': { displayName: 'Fontaine', construction: { price: 25, category: 'infrastructure', gridSize: 1 } },
  'Streetlight-001': { displayName: 'Réverbère', construction: { price: 5, category: 'infrastructure', gridSize: 1 } },
  'Fence-001': { displayName: 'Clôture', construction: { price: 3, category: 'infrastructure', gridSize: 1 } },
  'Pond-001': { displayName: 'Étang', construction: { price: 20, category: 'infrastructure', gridSize: 1 } },
  'Plane-001': { displayName: 'Dalle petite', construction: { price: 8, category: 'infrastructure', gridSize: 1 } },
  'Plane-004': { displayName: 'Dalle moyenne', construction: { price: 12, category: 'infrastructure', gridSize: 1 } },
  'Plane-007': { displayName: 'Dalle grande', construction: { price: 16, category: 'infrastructure', gridSize: 1 } },
  Cube: { displayName: 'Bloc', construction: { price: 5, category: 'infrastructure', gridSize: 1 } },
  'Sphere-001': { displayName: 'Sphère', construction: { price: 5, category: 'infrastructure', gridSize: 1 } },
  'Sphere-002': { displayName: 'Sphère sombre', construction: { price: 5, category: 'infrastructure', gridSize: 1 } },

  // Public (Chapel only — Church-002 mesh discarded as broken duplicate)
  // Sector 6 (Services Publics) — savants' workplaces.
  Chapel: {
    displayName: 'Chapelle',
    construction: { price: 60, category: 'public', gridSize: 1 },
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0 },
  },
  'BookShop-001': {
    displayName: 'Librairie',
    construction: { price: 60, category: 'public', gridSize: 1 },
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0 },
  },
  // Legacy save alias — same building as Chapel, kept for old saves
  'Church-002': { displayName: 'Chapelle', construction: { price: 60, category: 'public', gridSize: 1 } },

  // Nature
  'Tree-Pine-001': { displayName: 'Sapin', construction: { price: 3, category: 'nature', gridSize: 1 } },
  'Tree-Square-001': { displayName: 'Arbuste', construction: { price: 3, category: 'nature', gridSize: 1 } },
  'Tree-Tall-001': { displayName: 'Chêne', construction: { price: 3, category: 'nature', gridSize: 1 } },
  'Tree-Sapin': { displayName: 'Sapin', construction: { price: 3, category: 'nature', gridSize: 1 } },
  'Tree-Arbuste': { displayName: 'Arbuste', construction: { price: 3, category: 'nature', gridSize: 1 } },
  'Tree-Chene': { displayName: 'Chêne', construction: { price: 3, category: 'nature', gridSize: 1 } },
  'Boulder-001': { displayName: 'Rocher', construction: { price: 2, category: 'nature', gridSize: 1 } },

  // Decoration
  Bench: { displayName: 'Banc', construction: { price: 2, category: 'decoration', gridSize: 1 } },
  'Picnic-Table': { displayName: 'Table de pique-nique', construction: { price: 4, category: 'decoration', gridSize: 1 } },
  'Potted-Bush': { displayName: 'Buisson en pot', construction: { price: 2, category: 'decoration', gridSize: 1 } },
  Daisy: { displayName: 'Marguerite', construction: { price: 1, category: 'decoration', gridSize: 1 } },
  Shroom: { displayName: 'Champignon', construction: { price: 1, category: 'decoration', gridSize: 1 } },
  Arch: { displayName: 'Arche', construction: { price: 10, category: 'decoration', gridSize: 1 } },
  Obelisk: { displayName: 'Obélisque', construction: { price: 12, category: 'decoration', gridSize: 1 } },
  Pillar: { displayName: 'Pilier', construction: { price: 5, category: 'decoration', gridSize: 1 } },
  Garland: { displayName: 'Guirlande', construction: { price: 2, category: 'decoration', gridSize: 1 } },
  Barrell: { displayName: 'Tonneau', construction: { price: 2, category: 'decoration', gridSize: 1 } },
};

/** @type {Readonly<Record<string, BuildingDefinition>>} */
export const buildingCatalog = deepFreeze(RAW_CATALOG);

/**
 * @param {string} id
 * @returns {BuildingDefinition | undefined}
 */
export function getBuildingDefinition(id) {
  return id ? buildingCatalog[id] : undefined;
}
