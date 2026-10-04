/**
 * Prefabs: a city saved from a running game and started again from its own data, at the turn it was saved.
 *
 * The files in `anoria-tour-116/` are the game's exports of one moment: the city's buildings (with their
 * neighbours), the journal, the supply traceability, and the trade relations. IndexedDB itself cannot be
 * exported, so the export of each part is what a prefab is made of. Objectives are not part of a prefab.
 */

import city from './anoria-tour-116/city-2026-10-04-172507.json' with { type: 'json' };
import journalExport from './anoria-tour-116/journal-2026-10-04-172419.json' with { type: 'json' };
import transactionsExport from './anoria-tour-116/transactions-2026-10-04-172442.json' with { type: 'json' };
import relationsExport from './anoria-tour-116/relations-2026-10-04T15-24-56-054Z.json' with { type: 'json' };

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

/** The turn of the city export: every building of one export is at the same turn, or the export is mixed. */
function turnOfCityExport(buildings) {
  const turns = new Set(buildings.map((building) => building.worldTime));
  if (turns.size !== 1) throw new Error(`[prefab] the city export mixes turns: ${[...turns].join(', ')}`);
  return [...turns][0];
}

/** @type {Readonly<Record<string, Prefab>>} */
export const PREFABS = Object.freeze({
  'anoria-tour-116': Object.freeze({
    id: 'anoria-tour-116',
    turn: turnOfCityExport(city.buildings),
    hamletId: '0f2deabd-6075-4fd9-b233-58535c90aade',
    citySize: city.config.citySize,
    city,
    journal: journalExport.entries,
    transactions: transactionsExport,
    relations: Object.freeze(relationsExport.relations),
  }),
});

/** The prefab the menu's "Prefab" button starts. */
export const START_PREFAB_ID = 'anoria-tour-116';

/**
 * @param {string} prefabId
 * @returns {Prefab}
 */
export function getPrefab(prefabId) {
  const prefab = PREFABS[prefabId];
  if (!prefab) throw new Error(`[prefab] unknown prefab "${prefabId}"`);
  return prefab;
}
