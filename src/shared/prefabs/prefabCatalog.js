/**
 * Prefabs: a city saved from a running game and started again from its own data, at the turn it was saved.
 *
 * The files in `anoria-tour-107/` are the game's exports of one moment (the pause's "Tout télécharger"): the city's
 * buildings (with their neighbours), the journal (the city's own account and the flux of the companies and the houses,
 * two files that together are the whole journal), the supply traceability, and the trade relations. IndexedDB itself
 * cannot be exported, so the export of each part is what a prefab is made of. Objectives are not part of a prefab.
 */

import city from './anoria-tour-107/city-2026-10-25-132501.json' with { type: 'json' };
import journalCityExport from './anoria-tour-107/journal-2026-10-25-132501.json' with { type: 'json' };
import journalPrivateExport from './anoria-tour-107/flux-prives-2026-10-25-132501.json' with { type: 'json' };
import transactionsExport from './anoria-tour-107/transactions-2026-10-25-132501.json' with { type: 'json' };
import relationsExport from './anoria-tour-107/relations-2026-10-25T12-25-01-522Z.json' with { type: 'json' };

/**
 * @typedef {{
 *   id: string,
 *   turn: number,
 *   hamletId: string,
 *   citySize: number,
 *   city: object,
 *   journal: ReadonlyArray<object>,
 *   transactions: ReadonlyArray<object>,
 *   relations: ReadonlyArray<object>,
 * }} Prefab
 */

/** The turn of the city export: the export states it itself (`config.turn`), a building row does not carry the clock. */
function turnOfCityExport(cityExport) {
  const turn = cityExport.config?.turn;
  if (!Number.isInteger(turn) || turn < 0) throw new Error(`[prefab] the city export states no turn (config.turn is ${turn})`);
  return turn;
}

/** @type {Readonly<Record<string, Prefab>>} */
export const PREFABS = Object.freeze({
  'anoria-tour-107': Object.freeze({
    id: 'anoria-tour-107',
    turn: turnOfCityExport(city),
    hamletId: '3b383d94-a2c4-4912-b359-967fde804409',
    citySize: city.config.citySize,
    city,
    journal: [...journalCityExport.entries, ...journalPrivateExport.entries],
    transactions: transactionsExport,
    relations: Object.freeze(relationsExport.relations),
  }),
});

/** The prefab the menu's "Prefab" button starts. */
export const START_PREFAB_ID = 'anoria-tour-107';

/**
 * @param {string} prefabId
 * @returns {Prefab}
 */
export function getPrefab(prefabId) {
  const prefab = PREFABS[prefabId];
  if (!prefab) throw new Error(`[prefab] unknown prefab "${prefabId}"`);
  return prefab;
}
