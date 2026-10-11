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
 * The wage of next month: the current wage moved by the market's pressure, at most `maxMonthlyStep` either way, and never under the minimum wage.
 * @param {{ current: number, jobs: number, vacancies: number, idle: number, minimumWage: number }} params
 * @returns {{ rate: number, signal: 'shortage' | 'slack' | 'balanced', atFloor: boolean }}
 */
export function nextWageRate({ current, jobs, vacancies, idle, minimumWage }) {
  if (!(current > 0)) throw new Error(`[wages] the current wage must be positive, got ${current}`);
  if (!(minimumWage > 0)) throw new Error(`[wages] the minimum wage must be positive, got ${minimumWage}`);
  const { signal, pressure } = readLabourMarket({ jobs, vacancies, idle });
  const { maxMonthlyStep, pressureGain } = WAGE_ADJUSTMENT;
  const step = Math.max(-maxMonthlyStep, Math.min(maxMonthlyStep, pressure * pressureGain));
  const moved = centimes(current * (1 + step));
  const rate = Math.max(minimumWage, moved);
  return { rate, signal, atFloor: rate === minimumWage && moved <= minimumWage };
}
