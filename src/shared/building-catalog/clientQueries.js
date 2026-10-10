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
 * houses (e.g. Chapel's faith). Structurally different from "no eligible client type exists today": that
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
