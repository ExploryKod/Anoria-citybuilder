import { wageKey } from '../../infrastructure/persistence/DexieWageRateRepository.js';
import { nextWageRate, startWageOf } from '../../domain/policies/WageRatePolicy.js';

/**
 * Application service — the labour market moves the wages, once a month, right after the payroll of the month was paid at the wages in force.
 * Each (skill, level) the cities' workplaces ask for is read for its shortage or slack (see WageRatePolicy.js): a move is appended to the
 * wage log with the reading that caused it. A pair the market leaves where it is writes nothing. With no reading yet (no worker distribution
 * has run) nothing moves: a wage is never guessed.
 */
export class AdjustWageRates {
  /**
   * @param {object} deps
   * @param {{ latestRows: () => Promise<Map<string, object>>, append: (row: object) => Promise<void> }} deps.wageRateRepository
   * @param {() => Promise<number | null>} deps.getWageFloor the floor of every wage, null when the hamlet has no minimum wage
   * @param {(turn: number) => { year: number, monthIndex: number }} deps.getTimeInfo
   */
  constructor({ wageRateRepository, getWageFloor, getTimeInfo }) {
    this.wageRateRepository = wageRateRepository;
    this.getWageFloor = getWageFloor;
    this.getTimeInfo = getTimeInfo;
  }

  /**
   * @param {object} params
   * @param {number} params.time the turn of the settlement
   * @param {{ rows: Array<{ skill: string, level: number, jobs: number, vacancies: number, idle: number }> } | null} params.market the labour market of the last
   *   worker distribution, null when none has run
   * @returns {Promise<{ moved: number }>}
   */
  async execute({ time, market }) {
    if (!market) return { moved: 0 };
    const timeInfo = this.getTimeInfo(time);
    const month = timeInfo.monthIndex + 1;
    const [latest, minimumWage] = await Promise.all([this.wageRateRepository.latestRows(), this.getWageFloor()]);
    let moved = 0;
    for (const row of market.rows) {
      if (!(row.jobs > 0)) continue;
      const known = latest.get(wageKey(row.skill, row.level));
      // A month already read is not read again (the settlement of a month runs once; this keeps a second call from moving a wage twice).
      if (known && known.year === timeInfo.year && known.month === month) continue;
      const current = known?.amount ?? startWageOf(row.level);
      const next = nextWageRate({ current, jobs: row.jobs, vacancies: row.vacancies, idle: row.idle, minimumWage });
      if (next.rate === current) continue;
      await this.wageRateRepository.append({
        skill: row.skill,
        level: row.level,
        amount: next.rate,
        turn: time,
        year: timeInfo.year,
        month,
        signal: next.signal,
        jobs: row.jobs,
        vacancies: row.vacancies,
        idle: row.idle,
      });
      moved += 1;
    }
    return { moved };
  }
}
