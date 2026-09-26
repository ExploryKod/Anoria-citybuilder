import { buildingCatalog } from './buildingCatalog.js';
import { getResourceRoles } from './resourceRoleQueries.js';

/**
 * Who draws a good from a hub, and in which order the player prefers to serve them — read from the catalog
 * alone. A "client" is a building TYPE (never one building at given coordinates): the player decides how many
 * of each he places. No good and no building is named here; adding a building that buys a good in its
 * entries makes it a client of that good.
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
 * The order in which a producer type's goods serve their clients, and which clients it does not serve at all.
 * The catalog gives the default (`clients` on the producer entry, then every other client in catalog order);
 * what the player saved for this type replaces it. A saved type that no longer buys these goods is dropped and
 * a client added since is appended, so an old setting never breaks.
 *
 * @param {string} producerType
 * @param {{ order?: string[], disabled?: string[] } | null | undefined} saved The player's setting for this type.
 * @returns {{ order: string[], disabled: string[] }}
 */
export function resolveClientPriorities(producerType, saved = null) {
  const derived = listClientTypes(producedCategories(producerType));
  const declared = getResourceRoles(producerType)
    .filter((entry) => entry.role === 'producer')
    .flatMap((entry) => entry.clients ?? [])
    .filter((type) => derived.includes(type));
  const base = [...new Set([...declared, ...derived])];

  const savedOrder = (saved?.order ?? []).filter((type) => derived.includes(type));
  const order = [...new Set([...savedOrder, ...base])];
  return { order, disabled: (saved?.disabled ?? []).filter((type) => derived.includes(type)) };
}
