import { computeCitizenTaxBreakdown } from '../../../domain/policies/CitizenTaxCollectionPolicy.js';

/**
 * Collect citizen taxes once per fiscal year in November.
 */
export class CollectCitizenTaxes {
  /**
   * @param {object} deps
   * @param {import('../../queries/treasury/GetTreasurySnapshot.js').GetTreasurySnapshot} deps.getTreasurySnapshot
   * @param {{ execute: Function }} deps.recordCitizenTaxIncome
   * @param {{ listHouses: () => Promise<Array<object>> }} deps.houseReadPort
   * @param {() => number} deps.getCitizenTaxPerCapita
   * @param {(time: number) => { year: number, monthIndex: number }} deps.getTimeInfo
   */
  constructor({
    getTreasurySnapshot,
    recordCitizenTaxIncome,
    houseReadPort,
    getCitizenTaxPerCapita,
    getTimeInfo,
  }) {
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.recordCitizenTaxIncome = recordCitizenTaxIncome;
    this.houseReadPort = houseReadPort;
    this.getCitizenTaxPerCapita = getCitizenTaxPerCapita;
    this.getTimeInfo = getTimeInfo;
  }

  /** @param {{ time?: number }} [params] */
  async execute({ time = 0 } = {}) {
    const timeInfo = this.getTimeInfo(time);

    if (timeInfo.monthIndex !== 10) {
      return this.getTreasurySnapshot.execute();
    }

    const budget = await this.getTreasurySnapshot.execute();
    const lastTaxYear = budget.lastTaxYear ?? -1;

    if (timeInfo.year === lastTaxYear) {
      return budget;
    }

    const houses = await this.houseReadPort.listHouses();
    const taxBreakdown = computeCitizenTaxBreakdown(
      houses,
      this.getCitizenTaxPerCapita()
    );

    if (taxBreakdown.total <= 0 || taxBreakdown.population <= 0) {
      return budget;
    }

    await this.recordCitizenTaxIncome.execute({
      turn: budget.turn,
      amount: Math.round(taxBreakdown.total),
      description: `Impôt Citoyen (${taxBreakdown.population} hab.) - Novembre`,
      taxYear: timeInfo.year,
      taxBreakdown,
    });

    return this.getTreasurySnapshot.execute();
  }
}
