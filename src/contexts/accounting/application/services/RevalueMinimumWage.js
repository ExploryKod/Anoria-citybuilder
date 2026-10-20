import { indexedMinimumWage } from '../../domain/policies/WageRatePolicy.js';

/**
 * Application service — an indexed minimum wage is revalued every January to its ratio of the cost of living (see FiscalRateCatalog.js's
 * `MINIMUM_WAGE_MODES`), and the revalued amount is the hamlet's minimum wage until the next January. A hamlet that is not indexed is left alone.
 * With the cost of living unknown (a good nobody sells), the minimum wage stays where it was: nothing is guessed.
 */
export class RevalueMinimumWage {
  /**
   * @param {object} deps
   * @param {() => Promise<{ minimumWageMode: string, minimumWage: number, minimumWageBasketRatio: number }>} deps.getSalarySettings
   * @param {() => Promise<{ total: number | null, missing: string[] }>} deps.getCostOfLiving
   * @param {(amount: number) => Promise<unknown>} deps.setMinimumWage
   */
  constructor({ getSalarySettings, getCostOfLiving, setMinimumWage }) {
    this.getSalarySettings = getSalarySettings;
    this.getCostOfLiving = getCostOfLiving;
    this.setMinimumWage = setMinimumWage;
  }

  /**
   * @returns {Promise<{ revalued: boolean, reason?: 'not-indexed' | 'cost-unknown' | 'unchanged', from?: number, to?: number, missing?: string[] }>}
   */
  async execute() {
    const settings = await this.getSalarySettings();
    if (settings.minimumWageMode !== 'indexed') return { revalued: false, reason: 'not-indexed' };
    const cost = await this.getCostOfLiving();
    if (cost.total === null) return { revalued: false, reason: 'cost-unknown', missing: cost.missing };
    const to = indexedMinimumWage({ costOfLiving: cost.total, ratio: settings.minimumWageBasketRatio });
    if (to === settings.minimumWage) return { revalued: false, reason: 'unchanged' };
    await this.setMinimumWage(to);
    return { revalued: true, from: settings.minimumWage, to };
  }
}
