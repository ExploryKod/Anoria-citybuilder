/**
 * Catalogue des sources de dépêches.
 */

/** @typedef {'city' | 'caravan' | 'advisor' | 'spy' | 'diplomat'} NewsSourceId */

/** @type {Record<NewsSourceId, { id: NewsSourceId, labelFr: string, status: 'active' | 'planned' }>} */
export const NEWS_SOURCES = Object.freeze({
  city: { id: 'city', labelFr: 'Ville', status: 'active' },
  caravan: { id: 'caravan', labelFr: 'Caravane', status: 'active' },
  advisor: { id: 'advisor', labelFr: 'Conseiller', status: 'active' },
  spy: { id: 'spy', labelFr: 'Espion', status: 'planned' },
  diplomat: { id: 'diplomat', labelFr: 'Diplomate', status: 'planned' },
});

/**
 * @param {string} sourceId
 * @returns {string}
 */
export function labelForNewsSource(sourceId) {
  return NEWS_SOURCES[sourceId]?.labelFr ?? sourceId;
}
