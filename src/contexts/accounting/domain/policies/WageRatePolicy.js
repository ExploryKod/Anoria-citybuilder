import { MINIMUM_WAGE_MODES } from '../catalogs/FiscalRateCatalog.js';
import { START_WAGE_BY_SKILL_LEVEL, WAGE_ADJUSTMENT } from '../catalogs/LabourMarketCatalog.js';

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * The wage a skill level starts at, before the market has moved it.
 * @param {number} level
 * @returns {number}
 */
export function startWageOf(level) {
  const wage = START_WAGE_BY_SKILL_LEVEL[level];
  if (wage === undefined) throw new Error(`[wages] no starting wage is declared for skill level ${level}`);
  return wage;
}

/**
 * The floor of every wage in a hamlet: the minimum wage in a mode that has one, null when the hamlet has none (`none`: the market alone sets wages).
 * @param {{ minimumWageMode: string, minimumWage: number }} settings
 * @returns {number | null}
 */
export function wageFloorOf({ minimumWageMode, minimumWage }) {
  if (!MINIMUM_WAGE_MODES.includes(minimumWageMode)) throw new Error(`[wages] unknown minimum wage mode "${minimumWageMode}"`);
  if (minimumWageMode === 'none') return null;
  if (!(minimumWage > 0)) throw new Error(`[wages] a fixed minimum wage must be positive, got ${minimumWage}`);
  return minimumWage;
}

/**
 * The minimum wage an indexed hamlet revalues to: `ratio` times what a citizen's month costs, to the centime.
 * @param {{ costOfLiving: number, ratio: number }} params
 * @returns {number}
 */
export function indexedMinimumWage({ costOfLiving, ratio }) {
  if (!(costOfLiving > 0)) throw new Error(`[wages] the cost of living must be positive to index the minimum wage on it, got ${costOfLiving}`);
  if (!(ratio > 0)) throw new Error(`[wages] the minimum wage's ratio to the cost of living must be positive, got ${ratio}`);
  return centimes(costOfLiving * ratio);
}

/**
 * A wage raised to the floor, when there is one.
 * @param {number} amount
 * @param {number | null} floor
 * @returns {number}
 */
export function flooredWage(amount, floor) {
  return floor === null ? amount : Math.max(floor, amount);
}

/**
 * What the unemployment benefit is a share of: the lowest wage the city pays, the floor included. Each rate is a wage a (skill, level) is paid at;
 * the caller gives every one that is known, and the starting wage of the first level, so the base exists before any market has moved a wage.
 * @param {{ floor: number | null, rates: number[] }} params
 * @returns {number}
 */
export function benefitBaseOf({ floor, rates }) {
  if (rates.length === 0) throw new Error('[wages] the benefit base needs at least one wage');
  return Math.min(...rates.map((rate) => flooredWage(rate, floor)));
}

/**
 * The market's reading of one (skill, level) for one month: a shortage when jobs stay unfilled, slack when qualified citizens stay idle,
 * balanced otherwise. The pressure is the share of the jobs unfilled (positive) or the share of the jobs the idle would fill (negative,
 * capped at -1).
 * @param {{ jobs: number, vacancies: number, idle: number }} market
 * @returns {{ signal: 'shortage' | 'slack' | 'balanced', pressure: number }}
 */
export function readLabourMarket({ jobs, vacancies, idle }) {
  if (!(jobs > 0)) throw new Error(`[wages] a labour market with no jobs has no wage to settle (jobs: ${jobs})`);
  if (vacancies > 0) return { signal: 'shortage', pressure: Math.min(1, vacancies / jobs) };
  if (idle > 0) return { signal: 'slack', pressure: -Math.min(1, idle / jobs) };
  return { signal: 'balanced', pressure: 0 };
}

/**
 * The wage of next month: the current wage moved by the market's pressure, at most `maxMonthlyStep` either way, and never under the minimum wage
 * (`minimumWage` is null when the hamlet has none: see `wageFloorOf`).
 * @param {{ current: number, jobs: number, vacancies: number, idle: number, minimumWage: number | null }} params
 * @returns {{ rate: number, signal: 'shortage' | 'slack' | 'balanced', atFloor: boolean }}
 */
export function nextWageRate({ current, jobs, vacancies, idle, minimumWage }) {
  if (!(current > 0)) throw new Error(`[wages] the current wage must be positive, got ${current}`);
  if (minimumWage !== null && !(minimumWage > 0)) throw new Error(`[wages] the minimum wage must be positive or null (no floor), got ${minimumWage}`);
  const { signal, pressure } = readLabourMarket({ jobs, vacancies, idle });
  const { maxMonthlyStep, pressureGain } = WAGE_ADJUSTMENT;
  const step = Math.max(-maxMonthlyStep, Math.min(maxMonthlyStep, pressure * pressureGain));
  const moved = centimes(current * (1 + step));
  const rate = flooredWage(moved, minimumWage);
  return { rate, signal, atFloor: minimumWage !== null && rate === minimumWage && moved <= minimumWage };
}
