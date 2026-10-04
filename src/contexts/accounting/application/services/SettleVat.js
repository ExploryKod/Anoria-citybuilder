import { buildVatBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { vatOnSales } from '../../domain/policies/VatOnSalesPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — settles one sold month of goods for the active hamlet. The VAT on the month's last sales to
 * the houses is one journal income, once per month (the business key refuses a second charge). The journal holds only
 * the tax: the sales' price excluding tax stays with the merchants, as the customs' rest does.
 */
export class SettleVat {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {(year: number, monthIndex: number) => Promise<Record<string, number>>} deps.sumGoodSalesToHouses HT sales per good
   * @param {() => Promise<Record<string, number>>} deps.getVatRates percent per good, of the active hamlet
   * @param {(params: { turn: number, type: string, amount: number, description: string, businessKey: string }) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {object} params
   * @param {number} params.time the turn the line is dated by: the first turn after the sold month
   * @param {number} params.deliveredTime a turn of the sold month
   */
  async execute({ time, deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const hamletId = requireActiveHamletId();
    const salesHT = await this.deps.sumGoodSalesToHouses(timeInfo.year, timeInfo.monthIndex);
    const ratesPercent = await this.deps.getVatRates();
    const { htAmount, vat, ttcAmount } = vatOnSales({ salesHT, ratesPercent });
    if (vat <= 0) return;

    const monthName = timeInfo.month;
    const result = await this.deps.recordLedgerEntry({
      turn: time,
      type: 'vat',
      amount: vat,
      description: `TVA ventes - ${monthName} ${timeInfo.year} (HT ${htAmount} €, TTC ${ttcAmount} €)`,
      businessKey: buildVatBusinessKey(timeInfo, hamletId),
    });
    // A month already settled is not taxed again; any other refusal is a defect, not a skipped line.
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[vat] the VAT of ${monthName} ${timeInfo.year} was not recorded: ${result.reason}`);
    }
  }
}
