/** @typedef {'all' | 'terrains' | 'nature' | 'buildings' | 'decoration' | 'people'} AssetsPageFilterId */

/** @typedef {import('./kenneyNatureAssetsCatalog.js').AssetsPageFilterGroup} AssetsPageFilterGroup */

/** @type {ReadonlyArray<{ id: AssetsPageFilterId, label: string }>} */
export const ASSETS_PAGE_FILTERS = Object.freeze([
  { id: 'all', label: 'Tout' },
  { id: 'terrains', label: 'Terrains' },
  { id: 'nature', label: 'Nature' },
  { id: 'buildings', label: 'Bâtiments' },
  { id: 'decoration', label: 'Décoration' },
  { id: 'people', label: 'Personnages' },
]);

/** @type {Readonly<Record<string, AssetsPageFilterGroup>>} */
export const PLAYABLE_CATEGORY_FILTER_GROUP = Object.freeze({
  houses: 'buildings',
  farms: 'buildings',
  industry: 'buildings',
  markets: 'buildings',
  infrastructure: 'buildings',
  nature: 'nature',
  zones: 'terrains',
});

/**
 * @param {AssetsPageFilterId} filterId
 * @param {{ filterGroup: AssetsPageFilterGroup }} section
 */
export function sectionMatchesFilter(filterId, section) {
  if (filterId === 'all') return true;
  return section.filterGroup === filterId;
}

/**
 * @param {ReadonlyArray<{ filterGroup: AssetsPageFilterGroup, items: ReadonlyArray<unknown> }>} sections
 * @returns {Readonly<Record<AssetsPageFilterId, number>>}
 */
export function countAssetsByFilter(sections) {
  /** @type {Record<AssetsPageFilterId, number>} */
  const counts = {
    all: 0,
    terrains: 0,
    nature: 0,
    buildings: 0,
    decoration: 0,
    people: 0,
  };

  for (const section of sections) {
    const itemCount = section.items.length;
    counts.all += itemCount;
    counts[section.filterGroup] += itemCount;
  }

  return Object.freeze(counts);
}
