import { buildingCatalog } from './buildingCatalog.js';
import { getResourceRoles } from './resourceRoleQueries.js';

/**
 * Who draws a good from a hub. A "client" is a building TYPE here (never one building at given coordinates):
 * this says which types are eligible at all — the order the player prefers to serve them in is a per-instance
 * setting on the producer building itself (see ResourceRolePolicy / GetClientPriorityBoardForBuilding), not a
 * catalog fact. No good and no building is named here; adding a building that buys a good in its entries makes
 * it a client of that good.
 */

/** The goods a recipe draws from a hub: every input of a producer entry that names a `from`. */
function hubInputsOf(entry) {
  const inputs = [...(entry.inputs ?? []), ...(entry.cycle ?? []).flatMap((step) => step.inputs ?? [])];
  return inputs.filter((input) => input.from?.role === 'hub');
}

/**
 * The building types that draw at least one of these goods from a hub: a distributor with a hub link for it
 * (a market), a producer whose recipe takes it from a hub (a workshop). In catalog order.
 * @param {ReadonlyArray<string>} categories
 * @returns {string[]}
 */
export function listClientTypes(categories) {
  const wanted = new Set(categories);
  return Object.keys(buildingCatalog).filter((type) =>
    getResourceRoles(type).some((entry) => {
      if (entry.role === 'distributor' && entry.hubLink?.sourceLinkField) {
        return entry.categories.some((category) => wanted.has(category));
      }
      if (entry.role === 'producer') return hubInputsOf(entry).some((input) => wanted.has(input.category));
      return false;
    })
  );
}

/** @param {string} producerType @param {string} category The producer entry that makes this good. */
function producerEntryOf(producerType, category) {
  return getResourceRoles(producerType).find(
    (candidate) => candidate.role === 'producer' && candidate.categories.includes(category)
  );
}

/**
 * The building types a producer instance sells a good to EXCLUSIVELY (no other building, no trade city), or null when it
 * sells to every buyer in the order of its priorities. Every value starts from the catalog (`clientsOnly` and the `clients`
 * list) and is the player's to change, per instance (`saved`, from the Clients tab): `saved.clientsOnly` switches it on or
 * off, `saved.onlyClientType` names the one buyer type he chose.
 * @param {string} producerType
 * @param {string} category
 * @param {{ clientsOnly?: boolean, onlyClientType?: string } | null} saved The instance's saved setting for this good (null when none).
 * @returns {string[] | null}
 */
export function onlyClientTypesOf(producerType, category, saved) {
  const clientsOnly = typeof saved?.clientsOnly === 'boolean' ? saved.clientsOnly : producerEntryOf(producerType, category)?.clientsOnly === true;
  if (!clientsOnly) return null;
  if (saved?.onlyClientType) return [saved.onlyClientType];
  const listed = listedClientTypes(producerType, category);
  if (listed.length === 0) throw new Error(`[clients] "${producerType}" sells "${category}" to one client only, but none is chosen and the catalog lists none`);
  return listed;
}

/**
 * @param {string} producerType
 * @param {string} category
 * @param {{ clientsOnly?: boolean, onlyClientType?: string } | null} saved
 * @returns {boolean} whether the good goes to the types of `onlyClientTypesOf` alone
 */
export function hasOnlyListedClients(producerType, category, saved) {
  return onlyClientTypesOf(producerType, category, saved) !== null;
}

/**
 * The client types the catalog lists for this good of a producer type (what a restriction keeps).
 * @param {string} producerType
 * @param {string} category
 * @returns {string[]}
 */
export function listedClientTypes(producerType, category) {
  return [...(producerEntryOf(producerType, category)?.clients ?? [])];
}

/**
 * The client types that may draw a good from a hub when a given producer instance made it: every type that buys the good
 * (`listClientTypes`), or only those of `onlyClientTypesOf` when the producer sells to one client exclusively. A type that
 * does not buy the good (a catalog defect, or a stale choice) throws.
 * @param {string} producerType
 * @param {string} category
 * @param {{ clientsOnly?: boolean, onlyClientType?: string } | null} saved The instance's saved setting for this good (null when none).
 * @returns {string[]}
 */
export function eligibleClientTypes(producerType, category, saved) {
  const buyers = listClientTypes([category]);
  const only = onlyClientTypesOf(producerType, category, saved);
  if (!only) return buyers;
  const stranger = only.find((type) => !buyers.includes(type));
  if (stranger) throw new Error(`[clients] "${producerType}" sells "${category}" to "${stranger}" only, but "${stranger}" does not buy it`);
  return only;
}

/**
 * The goods a producer type sends to hubs (every category of its 'producer' entries).
 * @param {string} producerType
 * @returns {string[]}
 */
export function producedCategories(producerType) {
  return [...new Set(getResourceRoles(producerType).filter((entry) => entry.role === 'producer').flatMap((entry) => entry.categories))];
}

/**
 * Whether a producer type's output for this category never reaches a hub at all — it declares
 * `deliversTo: 'house'` (see buildingCatalog.js), meaning its OWN 'distributor' role hands it straight to
 * houses (e.g. the water tank's water). Structurally different from "no eligible client type exists today": that
 * good still goes to a hub, just none happens to draw from it; this one never touches a hub, by design.
 * @param {string} producerType
 * @param {string} category
 * @returns {boolean}
 */
export function deliversDirectlyToHouses(producerType, category) {
  return getResourceRoles(producerType).some(
    (entry) => entry.role === 'producer' && entry.categories.includes(category) && entry.deliversTo === 'house'
  );
}

/**
 * The client TYPES the catalog declares first for a producer type (the `clients` list on its producer
 * entries) — used only to seed the default ORDER of candidate instances (their type's declared preference),
 * never to decide who is eligible; `listClientTypes` alone decides that.
 * @param {string} producerType
 * @returns {string[]}
 */
export function declaredClientTypes(producerType) {
  return getResourceRoles(producerType)
    .filter((entry) => entry.role === 'producer')
    .flatMap((entry) => entry.clients ?? []);
}

/**
 * The order in which a producer INSTANCE serves its candidate client instances, and which of them it does not
 * serve at all. The default order ranks a candidate's own type by the catalog's declared preference first, then
 * every other eligible type, then stably by id; what the player saved for this instance (specific building ids)
 * replaces it. A saved id no longer among the candidates (destroyed, or no longer eligible) is dropped, and a
 * candidate never saved is appended, so an old setting never breaks and a newly-built candidate is never silently
 * skipped.
 *
 * @param {object} params
 * @param {string} params.producerType
 * @param {ReadonlyArray<{ id: string, type: string }>} params.candidates Every client-eligible instance in reach (city-wide).
 * @param {{ order?: string[], disabled?: string[] } | null | undefined} params.saved The player's setting for this instance.
 * @returns {{ order: string[], disabled: string[] }}
 */
export function resolveInstanceClientPriorities({ producerType, candidates, saved = null }) {
  const declaredRank = new Map(declaredClientTypes(producerType).map((type, index) => [type, index]));
  const derived = [...candidates]
    .sort((a, b) => {
      const rankA = declaredRank.get(a.type) ?? declaredRank.size;
      const rankB = declaredRank.get(b.type) ?? declaredRank.size;
      return rankA - rankB || a.type.localeCompare(b.type) || a.id.localeCompare(b.id);
    })
    .map((candidate) => candidate.id);

  const savedOrder = (saved?.order ?? []).filter((id) => derived.includes(id));
  const order = [...new Set([...savedOrder, ...derived])];
  return { order, disabled: (saved?.disabled ?? []).filter((id) => derived.includes(id)) };
}
