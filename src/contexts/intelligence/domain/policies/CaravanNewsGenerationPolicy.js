import { CARAVAN_NEWS_ENTRIES } from '../catalogs/NewsDraftCatalog.js';
import { CARAVAN_NEWS_PRICE } from './CaravanNewsAccessPolicy.js';

/**
 * Planifie 0–1 dépêche caravane (Phase 2).
 *
 * @param {object} params
 * @param {number} params.turn
 * @param {() => number} [params.rng]
 * @param {import('../catalogs/NewsDraftCatalog.js').CaravanNewsEntry[]} [params.entries]
 * @returns {Array<{
 *   sourceId: 'caravan',
 *   categoryId: string,
 *   title: string,
 *   body: string,
 *   teaser: string,
 *   revelation: 'unpaid',
 *   price: number,
 * }>}
 */
export function planCaravanNewsDrafts({ turn, rng = Math.random, entries = CARAVAN_NEWS_ENTRIES }) {
  void turn;

  if (!entries.length) {
    return [];
  }

  // Une chance élevée si éligible (gates déjà validés par l'appelant)
  if (rng() >= 0.7) {
    return [];
  }

  const roll = rng();
  let cumulative = 0;
  for (const entry of entries) {
    cumulative += entry.weight;
    if (roll < cumulative) {
      return [
        {
          sourceId: 'caravan',
          categoryId: entry.categoryId,
          title: entry.title,
          body: entry.body,
          teaser: entry.teaser,
          revelation: 'unpaid',
          price: CARAVAN_NEWS_PRICE,
        },
      ];
    }
  }

  const fallback = entries[entries.length - 1];
  return [
    {
      sourceId: 'caravan',
      categoryId: fallback.categoryId,
      title: fallback.title,
      body: fallback.body,
      teaser: fallback.teaser,
      revelation: 'unpaid',
      price: CARAVAN_NEWS_PRICE,
    },
  ];
}
