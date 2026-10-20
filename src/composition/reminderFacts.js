import db from '../core/persistence/dexie/db.js';
import { isActiveHamletRow } from '../core/persistence/hamlet/hamletSession.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../shared/building-identity/index.js';
import { houseHoldsSkill } from '../shared/population/workforceQueries.js';
import { OWNER_SKILL } from '../shared/population/socialCategoryCatalog.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';

/**
 * What the reminders of the game's bar read (see shared/gameplay/reminderCatalog.js): the facts of the hamlet that decide them, read from the
 * city's tiles, the houses' rows and the journal. Nothing is stored.
 *
 * `rentDebts` is the journal's reading of the rents owed, passed in because it changes once a month: the caller reads it once a month and
 * hands the same reading to every refresh in between.
 * @param {{ city: { tiles: object[][] }, rentDebts: { debtors: number, total: number }, activeToolId: string | null, openingOver: boolean }} params
 *   `activeToolId`: the tool in the player's hand; `openingOver`: the game's opening is over
 * @returns {Promise<import('../shared/gameplay/reminderCatalog.js').ReminderFacts>}
 */
export async function gatherReminderFacts({ city, rentDebts, activeToolId, openingOver }) {
  let ownerHousePlaced = false;
  for (const column of city.tiles ?? []) {
    for (const tile of column ?? []) {
      if (tile?.buildingId && houseHoldsSkill(tile.buildingId, 1, OWNER_SKILL)) ownerHousePlaced = true;
    }
  }
  const rows = (await db.houses.toArray()).filter(isActiveHamletRow);
  const ownerHouseHasResidents = rows.some((row) => row.pop >= 1 && houseHoldsSkill(row.type, row.level ?? 1, OWNER_SKILL));
  const otherHousesPlaced = rows.some((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE && !houseHoldsSkill(row.type, 1, OWNER_SKILL));
  return {
    openingOver,
    ownerHousePlaced,
    placingOwnerHouse: Boolean(activeToolId) && houseHoldsSkill(activeToolId, 1, OWNER_SKILL),
    ownerHouseHasResidents,
    otherHousesPlaced,
    rentDebtors: rentDebts.debtors,
    rentDebtTotal: rentDebts.total,
  };
}

/** The rents owed by the houses of the hamlet now, from the journal (the settlement moves them once a month). */
export function readRentDebts() {
  return getOrCreateAccountingContext().getRentDebtSummary();
}
