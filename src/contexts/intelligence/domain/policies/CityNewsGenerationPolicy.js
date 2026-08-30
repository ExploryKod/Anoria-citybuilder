import { CITY_NEWS_ENTRIES } from '../catalogs/NewsDraftCatalog.js';

/**
 * Planifie 0–2 dépêches ville à partir des signaux (Phase 1).
 * Priorité : revelation > complaint. Pas d'effet monde.
 *
 * @param {object} params
 * @param {number} params.turn
 * @param {{
 *   famishedPopulation?: number,
 *   totalPopulation?: number,
 *   unemploymentPercentage?: number,
 *   lack?: number,
 * }} params.signals
 * @param {() => number} [params.rng] — [0, 1)
 * @param {import('../catalogs/NewsDraftCatalog.js').CityNewsEntry[]} [params.entries]
 * @returns {Array<{
 *   sourceId: 'city',
 *   categoryId: string,
 *   title: string,
 *   body: string,
 *   teaser?: string,
 *   reliability?: 'trusted' | 'uncertain' | 'biased',
 *   revelation: 'free',
 * }>}
 */
export function planCityNewsDrafts({
  turn,
  signals = {},
  rng = Math.random,
  entries = CITY_NEWS_ENTRIES,
}) {
  void turn;

  if (!entries.length) {
    return [];
  }

  const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
  const pop = Math.max(0, Number(signals.totalPopulation) || 0);
  const unemployment = Math.max(0, Number(signals.unemploymentPercentage) || 0);
  const lack = Math.max(0, Number(signals.lack) || 0);
  const normalizedSignals = {
    famishedPopulation: famished,
    totalPopulation: pop,
    unemploymentPercentage: unemployment,
    lack,
  };

  /** @type {ReturnType<typeof planCityNewsDrafts>} */
  const drafts = [];
  const flavourEntry = entries.find((entry) => entry.id === 'flavour');

  for (const entry of entries) {
    if (entry.id === 'flavour') {
      continue;
    }
    if (!entry.when(normalizedSignals, rng)) {
      continue;
    }
    drafts.push(entry.draft(normalizedSignals));
  }

  if (drafts.length === 0 && flavourEntry?.when(normalizedSignals, rng)) {
    drafts.push(flavourEntry.draft(normalizedSignals));
  }

  drafts.sort((a, b) => {
    const score = (draft) => (draft.categoryId === 'revelation' ? 0 : 1);
    return score(a) - score(b);
  });

  return drafts.slice(0, 2);
}
