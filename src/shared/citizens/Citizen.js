import { CITIZEN_ARRIVAL, HEALTH_MIN, HEALTH_MAX } from '../population/CitizenCatalog.js';
import { drawCitizenFirstName } from '../population/CitizenNameCatalog.js';

/**
 * An inhabitant, an actor of the game.
 *
 * - Identity, for life: `id` (uuid), `firstName`, `arrivalTurn`, `constitution`. No function here changes them.
 * - State: `houseId` (a citizen may one day move house), `health` and `mentalHealth` (two scores, of the body and of the mind), and what a very low one has made of him:
 *   `severeMonths`, the months in a row either score has been under the severe threshold, and `invalid`, set for good when his category's invalidity is permanent
 *   (see InvalidityPolicy.js). Only `withHealth`, `withMentalHealth`, `withInvalidity` and `movedTo` produce a new state.
 * - Never stored on the citizen: anything the house gives (skills, social category) or the employment decides (status),
 *   and every figure derived from the citizens (a house's average health, the city's).
 *
 * A citizen is frozen; a change returns a new one.
 *
 * @typedef {{ convergence: number, sensitivity: number }} Constitution
 * @typedef {Readonly<{
 *   id: string, firstName: string, arrivalTurn: number, constitution: Readonly<Constitution>,
 *   houseId: string, hamletId: string, health: number, mentalHealth: number, severeMonths: number, invalid: boolean,
 * }>} Citizen
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertInRange(name, value, min, max) {
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`[citizen] ${name} must be in [${min}, ${max}], got ${value}`);
}

/**
 * The citizen of a stored row, validated: a row that does not describe a whole citizen throws, naming the field.
 * @param {object} row
 * @returns {Citizen}
 */
export function createCitizen(row) {
  const { id, firstName, arrivalTurn, constitution, houseId, hamletId, health, mentalHealth, severeMonths, invalid } = row ?? {};
  if (typeof id !== 'string' || !UUID.test(id)) throw new Error(`[citizen] the id must be a uuid, got ${id}`);
  const who = `citizen ${id}`;
  if (typeof firstName !== 'string' || firstName === '') throw new Error(`[citizen] ${who} has no first name`);
  if (!Number.isInteger(arrivalTurn) || arrivalTurn < 0) throw new Error(`[citizen] ${who} has no arrival turn, got ${arrivalTurn}`);
  if (typeof houseId !== 'string' || houseId === '') throw new Error(`[citizen] ${who} has no house`);
  if (typeof hamletId !== 'string' || hamletId === '') throw new Error(`[citizen] ${who} has no hamlet`);
  const { convergence, sensitivity } = constitution ?? {};
  assertInRange(`${who}: constitution.convergence`, convergence, 0, 1);
  assertInRange(`${who}: constitution.sensitivity`, sensitivity, 0, Infinity);
  assertInRange(`${who}: health`, health, HEALTH_MIN, HEALTH_MAX);
  assertInRange(`${who}: mental health`, mentalHealth, HEALTH_MIN, HEALTH_MAX);
  if (!Number.isInteger(severeMonths) || severeMonths < 0) throw new Error(`[citizen] ${who} has no count of severe months, got ${severeMonths}`);
  if (typeof invalid !== 'boolean') throw new Error(`[citizen] ${who} is invalid or not, got ${invalid}`);
  return Object.freeze({
    id,
    firstName,
    arrivalTurn,
    constitution: Object.freeze({ convergence, sensitivity }),
    houseId,
    hamletId,
    health,
    mentalHealth,
    severeMonths,
    invalid,
  });
}

function draw(range, random) {
  const value = random();
  if (!(value >= 0 && value < 1)) throw new Error(`[citizen] the random source must give a number in [0, 1), got ${value}`);
  return range.min + value * (range.max - range.min);
}

/**
 * A citizen arriving in a house at `turn`: its identity and its starting health are drawn once, from the catalog's ranges.
 * @param {{ houseId: string, hamletId: string, turn: number, random: () => number, newId: () => string }} params
 * @returns {Citizen}
 */
export function drawArrivingCitizen({ houseId, hamletId, turn, random, newId }) {
  return createCitizen({
    id: newId(),
    firstName: drawCitizenFirstName(random),
    arrivalTurn: turn,
    constitution: {
      convergence: draw(CITIZEN_ARRIVAL.constitution.convergence, random),
      sensitivity: draw(CITIZEN_ARRIVAL.constitution.sensitivity, random),
    },
    houseId,
    hamletId,
    health: draw(CITIZEN_ARRIVAL.startingHealth, random),
    mentalHealth: draw(CITIZEN_ARRIVAL.startingMentalHealth, random),
    severeMonths: 0,
    invalid: false,
  });
}

/** @param {Citizen} citizen @param {number} health */
export function withHealth(citizen, health) {
  return createCitizen({ ...citizen, health });
}

/** @param {Citizen} citizen @param {number} mentalHealth */
export function withMentalHealth(citizen, mentalHealth) {
  return createCitizen({ ...citizen, mentalHealth });
}

/** @param {Citizen} citizen @param {{ severeMonths: number, invalid: boolean }} invalidity what a month of very low health made of him (see InvalidityPolicy.js) */
export function withInvalidity(citizen, { severeMonths, invalid }) {
  return createCitizen({ ...citizen, severeMonths, invalid });
}

/** @param {Citizen} citizen @param {string} houseId */
export function movedTo(citizen, houseId) {
  return createCitizen({ ...citizen, houseId });
}

/**
 * The citizens of a house in their one stable order (arrival, then id): the order of a card list, and the order in which the
 * latest arrivals leave first.
 * @param {ReadonlyArray<Citizen>} citizens
 * @returns {Citizen[]}
 */
export function inHouseOrder(citizens) {
  return [...citizens].sort((a, b) => a.arrivalTurn - b.arrivalTurn || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/**
 * What a house's population change asks of its citizens: how many arrive, and which ones leave (the latest arrivals first).
 * @param {{ citizens: ReadonlyArray<Citizen>, targetPop: number }} params
 * @returns {{ arrivals: number, leaving: Citizen[] }}
 */
export function planHousePopulation({ citizens, targetPop }) {
  if (!Number.isInteger(targetPop) || targetPop < 0) throw new Error(`[citizen] a house's population must be a count, got ${targetPop}`);
  const ordered = inHouseOrder(citizens);
  if (targetPop >= ordered.length) return { arrivals: targetPop - ordered.length, leaving: [] };
  return { arrivals: 0, leaving: ordered.slice(targetPop) };
}

/**
 * The invariant of the model while a house still carries `pop`: one citizen per resident. A gap throws, naming the house.
 * @param {string} houseId @param {number} pop @param {ReadonlyArray<Citizen>} citizens
 */
export function assertCitizensMatchPop(houseId, pop, citizens) {
  if (!Number.isInteger(pop) || pop < 0) throw new Error(`[citizen] house ${houseId} has no residents count, got ${pop}`);
  if (citizens.length !== pop) throw new Error(`[citizen] house ${houseId} counts ${pop} residents but holds ${citizens.length} citizens`);
}
