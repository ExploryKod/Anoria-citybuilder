/**
 * The residents of every house, counted from the citizens (the `citizens` table), in memory.
 *
 * A house's `pop` is not stored: the citizens are the only record of who lives where, and the count is derived from them. This is the
 * projection that count is read from. It is kept up to date by the table's own hooks (db.js): a citizen added to or removed from a
 * house moves that house's count by one at once, and a transaction that aborts (or a write that fails) gives it back; it is rebuilt
 * from the table whenever the database opens. A house nobody lives in has no entry and reads 0, which is true.
 *
 * Reading before the projection is built throws: a count read too early would pass for an empty house.
 */

/** @type {Map<string, number>} */
const countByHouse = new Map();
let built = false;

/**
 * Rebuild the projection from the citizens' houses (one count per citizen).
 * @param {Iterable<string>} houseIds the `houseId` of every citizen of the table
 */
export function buildResidents(houseIds) {
  countByHouse.clear();
  for (const houseId of houseIds) countByHouse.set(houseId, (countByHouse.get(houseId) ?? 0) + 1);
  built = true;
}

/** The table was emptied (a new game): nobody lives anywhere. */
export function emptyResidents() {
  countByHouse.clear();
  built = true;
}

/**
 * Move the counts of houses by the given deltas (citizens added: +1 each, removed: −1 each).
 * @param {ReadonlyMap<string, number>} deltas
 */
export function applyResidentDeltas(deltas) {
  if (!built) throw new Error('[residents] the residents are not counted yet: a change cannot be applied to them');
  for (const [houseId, delta] of deltas) {
    const next = (countByHouse.get(houseId) ?? 0) + delta;
    if (next < 0) throw new Error(`[residents] house ${houseId} would have ${next} residents`);
    if (next === 0) countByHouse.delete(houseId);
    else countByHouse.set(houseId, next);
  }
}

/**
 * A writer of named fields on a building row cannot set the residents: they are the citizens'. Refuse a `pop` among the fields, naming the building, rather than let the
 * write pass for one that took effect (it would be dropped from the row).
 * @param {string} buildingId
 * @param {Record<string, unknown>} fields
 */
export function refuseResidentsField(buildingId, fields) {
  if (fields && Object.hasOwn(fields, 'pop')) {
    throw new Error(`[residents] ${buildingId}: the residents of a house are its citizens, they cannot be written as a field of the row (use the citizens registry)`);
  }
}

/**
 * How many residents a house has.
 * @param {string} houseId
 * @returns {number}
 */
export function residentsOfHouseId(houseId) {
  if (!built) throw new Error(`[residents] house ${houseId} was read before the residents were counted: the database is not ready`);
  return countByHouse.get(houseId) ?? 0;
}
