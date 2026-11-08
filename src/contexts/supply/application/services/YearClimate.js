import { FIRST_CLIMATE_PHASE } from '../../../../shared/climate/ClimateCatalog.js';
import { drawClimateYear } from '../../../../shared/climate/ClimatePolicy.js';

/**
 * Application service — the climate of each year of the game, drawn once and kept (the game's settings), so a year reads the same every time it is asked and the years
 * follow one another (a poor year makes another likelier). The years are drawn in order, from the game's first, whenever one is asked.
 */
export class YearClimate {
  /**
   * @param {object} deps
   * @param {{ get: () => Promise<Record<string, { phase: string, harvestFactor: number }>>, save: (years: Record<string, object>) => Promise<void> }} deps.repository
   * @param {() => number} deps.random draws in [0, 1)
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {number} year the game's year (0 is the first)
   * @returns {Promise<{ phase: string, harvestFactor: number }>}
   */
  async of(year) {
    if (!Number.isInteger(year) || year < 0) throw new Error(`[climate] a year is a whole number of zero or more, got ${year}`);
    const years = await this.deps.repository.get();
    let drawn = false;
    for (let y = 0; y <= year; y += 1) {
      if (years[y]) continue;
      years[y] = drawClimateYear({ previousPhase: y === 0 ? FIRST_CLIMATE_PHASE : years[y - 1].phase, random: this.deps.random });
      drawn = true;
    }
    if (drawn) await this.deps.repository.save(years);
    return years[year];
  }
}
