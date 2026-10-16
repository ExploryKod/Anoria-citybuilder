import { computeCitizenTaxBreakdown, computeCitizenTaxByHouse } from '../../../domain/policies/CitizenTaxCollectionPolicy.js';
import { buildCitizenTaxPaymentBusinessKey } from '../../../domain/policies/LedgerBusinessKeys.js';
import { PERSONAL_ACCOUNT } from '../../../domain/policies/AccountKeyPolicy.js';
import { requireActiveHamletId } from '../../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Collect citizen taxes once per fiscal year in November: the city's lump sum (`citizen_tax`, unchanged), and one
 * `citizen_tax_paid` debit per taxed house on its own personal account — the house's share must show on its own
 * Finances tab, not only disappear into the city-wide total.
 */
export class CollectCitizenTaxes {
  /**
   * @param {object} deps
   * @param {import('../../queries/treasury/GetTreasurySnapshot.js').GetTreasurySnapshot} deps.getTreasurySnapshot
   * @param {{ execute: Function }} deps.recordCitizenTaxIncome
   * @param {{ execute: Function }} deps.recordLedgerEntry
   * @param {{ listHouses: () => Promise<Array<object>> }} deps.houseReadPort
   * @param {() => number} deps.getCitizenTaxPerCapita
   * @param {(time: number) => { year: number, monthIndex: number }} deps.getTimeInfo
   * @param {() => Promise<boolean>} deps.hasTaxCollector whether a house of the city has residents who hold the tax collector skill
   */
  constructor({
    getTreasurySnapshot,
    recordCitizenTaxIncome,
    recordLedgerEntry,
    houseReadPort,
    getCitizenTaxPerCapita,
    getTimeInfo,
    hasTaxCollector,
  }) {
    this.hasTaxCollector = hasTaxCollector;
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.recordCitizenTaxIncome = recordCitizenTaxIncome;
    this.recordLedgerEntry = recordLedgerEntry;
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

    // Nobody collects the tax without a tax collector (the mayor's house): nothing is written, and the turn says so (its dépêche is announced
    // once a year). It stays to be collected the day a collector lives in the city, within the same November.
    if (!(await this.hasTaxCollector())) {
      return { ...budget, citizenTaxUncollectedYear: timeInfo.year };
    }

    const houses = await this.houseReadPort.listHouses();
    const perCapita = await this.getCitizenTaxPerCapita();
    const taxBreakdown = computeCitizenTaxBreakdown(houses, perCapita);

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

    const hamletId = requireActiveHamletId();
    for (const { houseId, pop, amount } of computeCitizenTaxByHouse(houses, perCapita)) {
      await this.recordLedgerEntry.execute({
        turn: budget.turn,
        type: 'citizen_tax_paid',
        amount,
        description: `Impôt Citoyen (${pop} hab.) - Novembre`,
        businessKey: buildCitizenTaxPaymentBusinessKey(houseId, timeInfo.year, hamletId),
        accountBuildingId: houseId,
        accountKind: PERSONAL_ACCOUNT,
        taxYear: timeInfo.year,
      });
    }

    return this.getTreasurySnapshot.execute();
  }
}
