import { buildDepositInterestBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/**
 * Application service — once a year, when the fiscal year closes, every house with money on deposit is credited the interest its savings earned
 * over the year, paid by the bank that holds it (as a real savings account is credited at the end of the year). Run alongside
 * SettleProducerCharges (same day, same turn), but kept separate: this is the bank's own relationship with its depositors, not a goods/service
 * sale to settle through that already large pipeline. The lines are dated in the year they credit (its last turn), and written once per house,
 * per bank, per year: the business key refuses a second charge. It runs before SettleProducerCharges, so the bank's interest expense is in its
 * statement of the year when its corporate tax is based on it.
 */
export class SettleBankDepositInterest {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ id: string, type: string }>>} deps.listBuildings the hamlet's buildings, for the description's display names
   * @param {(year: number, annualRate: number) => Promise<Array<{ houseId: string, bankId: string, interest: number }>>} deps.listDepositInterests what each (house, bank)
   *   pair earned over the fiscal year at the annual rate, read from the journal (see depositInterestsOf)
   * @param {() => number} deps.getDepositInterestRate the fraction of the savings paid per year
   * @param {(buildingType: string) => string | undefined} deps.getBuildingDisplayName the catalog's own name for a building type
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {object} params
   * @param {number} params.time the turn the settlement runs at
   * @param {number} params.deliveredTime a turn of the month being settled: the interest is credited only when it is the last month of the year
   */
  async execute({ deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    if (timeInfo.monthIndex !== MONTHS_PER_YEAR - 1) return;

    const interests = await this.deps.listDepositInterests(timeInfo.year, this.deps.getDepositInterestRate());
    if (interests.length === 0) return;
    const buildings = await this.deps.listBuildings();
    const yearLabel = `année ${timeInfo.year}`;
    const nameOf = (buildingId) => {
      const building = buildings.find((candidate) => candidate.id === buildingId);
      const name = building && this.deps.getBuildingDisplayName(building.type);
      if (!name) throw new Error(`[deposit] building ${buildingId} has no catalog name for its journal lines`);
      return name;
    };

    for (const { houseId, bankId, interest } of interests) {
      const description = `Intérêts d'épargne : ${nameOf(houseId)} à ${nameOf(bankId)} - ${yearLabel}`;

      const houseResult = await this.deps.recordLedgerEntry({
        turn: deliveredTime,
        type: 'household_deposit_interest',
        amount: interest,
        description,
        businessKey: buildDepositInterestBusinessKey('household_deposit_interest', houseId, bankId, timeInfo.year, timeInfo.monthIndex),
        accountBuildingId: houseId,
        accountKind: 'particulier',
        counterpartyBuildingId: bankId,
        // The bank pays and the household receives: two écritures, one flow.
        transactionId: `deposit_interest:${houseId}:${bankId}:${timeInfo.year}:${timeInfo.monthIndex}`,
      });
      if (!houseResult.recorded && houseResult.reason !== 'duplicate_business_key') {
        throw new Error(`[deposit] the household interest line for ${houseId} was not recorded: ${houseResult.reason}`);
      }

      const bankResult = await this.deps.recordLedgerEntry({
        turn: deliveredTime,
        type: 'deposit_interest_paid',
        amount: interest,
        description,
        businessKey: buildDepositInterestBusinessKey('deposit_interest_paid', houseId, bankId, timeInfo.year, timeInfo.monthIndex),
        accountBuildingId: bankId,
        counterpartyBuildingId: houseId,
        transactionId: `deposit_interest:${houseId}:${bankId}:${timeInfo.year}:${timeInfo.monthIndex}`,
      });
      if (!bankResult.recorded && bankResult.reason !== 'duplicate_business_key') {
        throw new Error(`[deposit] the bank's interest line for ${houseId} was not recorded: ${bankResult.reason}`);
      }
    }
  }
}
