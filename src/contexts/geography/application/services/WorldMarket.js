import { cropTargetOf, nextWorldIndex } from '../../domain/policies/WorldMarketPolicy.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/**
 * Application service — the world price of each traded good, month by month (WorldMarketPolicy.js). The series is drawn once and kept (the game's settings): asked for a month,
 * it is advanced from where it stopped, month after month, so the world has its own memory and the same month reads the same every time.
 */
export class WorldMarket {
  /**
   * @param {object} deps
   * @param {{ get: () => Promise<{ monthKey: number, indices: Record<string, number> } | null>, save: (state: object) => Promise<void> }} deps.repository
   * @param {ReadonlyArray<string>} deps.goods the goods that cross a border
   * @param {(good: string) => boolean} deps.isCrop whether the world's harvest sets the good's price
   * @param {(year: number) => Promise<{ harvestFactor: number }>} deps.worldClimateOfYear
   * @param {() => number} deps.random draws in [0, 1)
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {{ year: number, monthIndex: number }} period
   * @returns {Promise<Record<string, number>>} the index of every traded good in that month
   */
  async indicesAt(period) {
    const target = period.year * MONTHS_PER_YEAR + period.monthIndex;
    const state = (await this.deps.repository.get()) ?? { monthKey: -1, indices: Object.fromEntries(this.deps.goods.map((good) => [good, 1])) };
    if (target < state.monthKey) throw new Error(`[world-market] month ${target} was asked, but the market already stands at ${state.monthKey}: the past is not redrawn`);
    if (target === state.monthKey) return state.indices;
    let { indices } = state;
    for (let key = state.monthKey + 1; key <= target; key += 1) {
      const worldFactor = (await this.deps.worldClimateOfYear(Math.floor(key / MONTHS_PER_YEAR))).harvestFactor;
      indices = Object.fromEntries(this.deps.goods.map((good) => [good, nextWorldIndex({
        index: indices[good] ?? 1,
        target: this.deps.isCrop(good) ? cropTargetOf(worldFactor) : 1,
        shock: (this.deps.random() + this.deps.random() + this.deps.random() - 1.5) * (2 / 1.5),
      })]));
    }
    await this.deps.repository.save({ monthKey: target, indices });
    return indices;
  }

  /**
   * @param {string} good
   * @param {{ year: number, monthIndex: number }} period
   * @returns {Promise<number>} the world price of the good that month, around 1
   */
  async indexOf(good, period) {
    const indices = await this.indicesAt(period);
    if (!Object.hasOwn(indices, good)) throw new Error(`[world-market] "${good}" is not a good that crosses a border: it has no world price`);
    return indices[good];
  }
}
