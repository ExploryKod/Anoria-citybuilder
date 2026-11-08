import {
  CASUALTY_SHARE,
  KINDS_WITHOUT_SOLIDITY,
  MAX_MONTHLY_COLLAPSE_CHANCE,
  MONTHLY_WEAR,
  RISK_BELOW,
  SOLIDITY_MAX,
  WARNING_BELOW,
} from './SolidityCatalog.js';

/** @param {unknown} solidity @param {string} what */
function assertSolidity(solidity, what) {
  if (typeof solidity !== 'number' || !Number.isFinite(solidity) || solidity < 0 || solidity > SOLIDITY_MAX) {
    throw new Error(`[solidity] ${what} must be a number between 0 and ${SOLIDITY_MAX}, got ${solidity}`);
  }
}

/** @param {string} kind a building kind (BuildingKind.js) @returns {boolean} whether a building of this kind has a solidity bar */
export function kindHasSolidity(kind) {
  if (typeof kind !== 'string' || kind.length === 0) throw new Error(`[solidity] a building kind is needed to tell whether it has a solidity bar, got ${kind}`);
  return !KINDS_WITHOUT_SOLIDITY.includes(kind);
}

/**
 * The solidity a building row stores. Strict: a building that has a bar and carries none is a defect, never a full bar.
 * @param {{ kind: string, solidity?: number, type?: string }} row
 * @returns {number | null} null for a kind with no bar
 */
export function solidityOf(row) {
  if (!kindHasSolidity(row.kind)) return null;
  assertSolidity(row.solidity, `the solidity of the ${row.type ?? row.kind}`);
  return row.solidity;
}

/**
 * @param {{ solidity: number, upkeepPaid: boolean }} params
 * @returns {number} the solidity after a month: unchanged when the upkeep was paid, worn by `MONTHLY_WEAR` (down to 0) when it was not
 */
export function solidityAfterMonth({ solidity, upkeepPaid }) {
  assertSolidity(solidity, 'the solidity');
  if (typeof upkeepPaid !== 'boolean') throw new Error(`[solidity] whether the upkeep was paid must be told, got ${upkeepPaid}`);
  return upkeepPaid ? solidity : Math.max(0, solidity - MONTHLY_WEAR);
}

/** @param {number} solidity @returns {'sound' | 'warning' | 'at-risk'} `warning`: the alert sprite shows; `at-risk`: the building may collapse each month */
export function solidityStatusOf(solidity) {
  assertSolidity(solidity, 'the solidity');
  if (solidity < RISK_BELOW) return 'at-risk';
  if (solidity < WARNING_BELOW) return 'warning';
  return 'sound';
}

/** @param {number} solidity @returns {number} the chance, per month, that the building collapses: nothing from `RISK_BELOW` up, the maximum at 0 */
export function collapseChanceOf(solidity) {
  assertSolidity(solidity, 'the solidity');
  if (solidity >= RISK_BELOW) return 0;
  return MAX_MONTHLY_COLLAPSE_CHANCE * (1 - solidity / RISK_BELOW);
}

/**
 * @template T
 * @param {{ people: ReadonlyArray<T>, random: () => number }} params `people`: those in the building when it falls; `random`: a draw in [0, 1), the composition's to give
 * @returns {T[]} those who die: each is hit with the chance `CASUALTY_SHARE`
 */
export function casualtiesAmong({ people, random }) {
  if (!Array.isArray(people)) throw new Error('[solidity] the casualties are drawn among a list of people');
  if (typeof random !== 'function') throw new Error('[solidity] the casualties need their random source');
  return people.filter(() => random() < CASUALTY_SHARE);
}
