import { accountKeyOf, PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { depositBalancesAt } from '../../domain/policies/DepositBalancePolicy.js';
import { payablesOf } from '../../domain/policies/DebtPolicy.js';
import { householdSavingsMoveOf } from '../../domain/policies/LoanRatePolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/** The account a household's savings sit on, the claim on its bank: what moves its cash against it is saving or drawing, not income or spending. */
const SAVINGS_ACCOUNT = '275';

/**
 * Application service — what the households do with their money each month, once the month's pay, bills and rents are settled (see BankCatalog.js): each keeps a cash
 * buffer of what it lives on (the larger of its income of this month and its spending of the month before, read from the fold's cash flows of its personal account),
 * saves at the bank a share of what it holds above it, the larger the better the savings pay, and draws on its savings when it holds less. This is how the policy
 * rate reaches the households: a higher rate, more savings at the bank. No bank, no saving. Each move once a month (its business key).
 */
export class SettleHouseholdSavings {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<string | null>} deps.findBankBuildingId the hamlet's bank, null while none is built
   * @param {() => Promise<Array<{ houseId: string }>>} deps.listHouseholds the hamlet's households (a house with residents and a personal account)
   * @param {() => Promise<number>} deps.getSavingsRate what the bank pays a year on savings now (the policy rate in force, less the spread)
   * @param {(houseId: string) => Promise<number>} deps.cashOf a household's cash, in euros
   * @param {() => Promise<Array<object>>} deps.getJournalEntries the savings are read from the deposit lines
   * @param {() => Promise<import('../../domain/policies/LegsFold.js').LegsFold>} deps.getLegsFold
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordDeposit RecordHouseholdDeposit.execute
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordWithdrawal RecordHouseholdWithdrawal.execute
   */
  constructor(deps) {
    this.deps = deps;
  }

  /** @param {{ time: number }} params the turn the moves are dated by */
  async execute({ time }) {
    const bankId = await this.deps.findBankBuildingId();
    if (!bankId) return;
    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(time);
    const month = timeInfo.monthIndex + 1;
    const previous = timeInfo.monthIndex === 0 ? { year: timeInfo.year - 1, month: MONTHS_PER_YEAR } : { year: timeInfo.year, month: month - 1 };
    const fold = await this.deps.getLegsFold();
    const savingsRate = await this.deps.getSavingsRate();
    const entries = await this.deps.getJournalEntries();
    const savingsByHouse = depositBalancesAt(entries, bankId);
    // A household that owes (its rent) pays its debt before it saves: it keeps its cash for it.
    const inDebt = new Set([...payablesOf(entries).values()].filter((debt) => debt.accountKind === PERSONAL_ACCOUNT).map((debt) => debt.debtorId));
    const stamp = `${timeInfo.year}:${timeInfo.monthIndex}`;

    for (const { houseId } of await this.deps.listHouseholds()) {
      const accountKey = accountKeyOf({ accountBuildingId: houseId, accountKind: PERSONAL_ACCOUNT });
      // What came in this month (its pay, its benefit) and what went out the month before (its purchases, bills, rent), the savings moves left out.
      const flowsOf = (period) => (period.year < 0 ? new Map() : fold.cashFlowsOf({ hamletId, accountKey, ...period }));
      const sumOf = (flows, side) => [...flows].reduce((total, [account, flow]) => (account === SAVINGS_ACCOUNT ? total : total + flow[side]), 0);
      const move = householdSavingsMoveOf({
        cash: Math.round((await this.deps.cashOf(houseId)) * 100),
        income: sumOf(flowsOf({ year: timeInfo.year, month }), 'in'),
        spending: sumOf(flowsOf(previous), 'out'),
        savings: savingsByHouse.get(houseId) ?? 0,
        savingsRate,
      });
      const common = { turn: time, houseId, bankId };
      if (move.deposit > 0 && !inDebt.has(houseId)) {
        await this.#settle(this.deps.recordDeposit, { ...common, amount: move.deposit / 100, description: `Épargne du mois - ${timeInfo.month} ${timeInfo.year}`, businessKey: `household_saving:${hamletId}:${houseId}:${stamp}` });
      } else if (move.withdraw > 0) {
        await this.#settle(this.deps.recordWithdrawal, { ...common, amount: move.withdraw / 100, description: `Retrait sur l'épargne - ${timeInfo.month} ${timeInfo.year}`, businessKey: `household_drawing:${hamletId}:${houseId}:${stamp}` });
      }
    }
  }

  /**
   * A move the household cannot make (it lacks the money, or the savings) or that was made already this month is no defect: the household keeps what it has. Any other
   * refusal is.
   */
  async #settle(record, params) {
    const result = await record(params);
    if (result.recorded || ['duplicate_business_key', 'insufficient_funds', 'insufficient_deposit'].includes(result.reason)) return;
    throw new Error(`[savings] the household ${params.houseId}'s move of ${params.amount} € was not recorded: ${result.reason}`);
  }
}
