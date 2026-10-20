import db from '../../../../core/persistence/dexie/db.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/** @param {string} skill @param {number} level */
export const wageKey = (skill, level) => `${skill}:${level}`;

/**
 * Dexie adapter — the wage the labour market gives each (skill, level) of the active hamlet. The log is append-only: a rate is never edited,
 * a move is a new row dated by its turn with the market reading that caused it (jobs, vacancies, idle, signal). The rate in force is the
 * latest row of the pair; a pair with no row is at its starting wage (LabourMarketCatalog.js), which is the market's opening state.
 */
export class DexieWageRateRepository {
  /** @param {import('dexie').Dexie} [database] */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * @returns {Promise<Map<string, { skill: string, level: number, amount: number, turn: number, year: number, month: number, signal: string, jobs: number, vacancies: number, idle: number }>>}
   *   the latest row of each (skill, level) the market has moved or read
   */
  async latestRows() {
    const hamletId = requireActiveHamletId();
    const rows = await this.db.wageRates.where('hamletId').equals(hamletId).sortBy('id');
    const latest = new Map();
    for (const row of rows) latest.set(wageKey(row.skill, row.level), row);
    return latest;
  }

  /**
   * @param {{ skill: string, level: number, amount: number, turn: number, year: number, month: number, signal: string, jobs: number, vacancies: number, idle: number }} row
   */
  async append(row) {
    if (!(row.amount > 0)) throw new Error(`[wages] a wage must be positive, got ${row.amount} for ${row.skill} ${row.level}`);
    await this.db.wageRates.add({ ...row, hamletId: requireActiveHamletId() });
  }

  /**
   * The moves of one (skill, level), oldest first: the history of its wage.
   * @param {string} skill
   * @param {number} level
   */
  async history(skill, level) {
    const hamletId = requireActiveHamletId();
    const rows = await this.db.wageRates.where('hamletId').equals(hamletId).sortBy('id');
    return rows.filter((row) => row.skill === skill && row.level === level);
  }
}
