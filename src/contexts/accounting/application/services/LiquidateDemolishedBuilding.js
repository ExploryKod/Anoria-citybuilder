import { payablesOf } from '../../domain/policies/DebtPolicy.js';
import { PAYABLE_KINDS } from '../../domain/catalogs/PayableCatalog.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — the accounts of a building the player demolishes (see docs/gameplay/PLAN_DEMOLITION_LIQUIDATION.md). A demolition closes the books of what
 * stood there as a liquidation would, once, in the turn it happens.
 *
 * What is done so far (the first slice):
 *   - the debts OWED TO the demolished building are abandoned. A house whose workers a company could not pay, then demolished, leaves that company with a debt to a
 *     creditor that no longer exists: nobody can be paid, so the debtor is released by an opération diverse (the claim is abandoned, no one is prosecuted), and the debt
 *     closes in the journal like a paid one does. Without it the company tries to pay that creditor every month and the month's settlement fails.
 *
 * What is still to do (the plan): the debts the building owed itself (paid by rank from its cash, the rest lost by its creditors, the wages advanced by the city),
 * its stock sold at the liquidation rate, the surplus returned to the city, and the closing of its accounts.
 *
 * `preview` and `execute` read the same debts through the same function: what the player is told before the demolition is exactly what is written.
 */
export class LiquidateDemolishedBuilding {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * Every debt open in the journal, with the way the catalog closes it.
   * @returns {Promise<Array<{ debtorId: string, creditorId: string | null, accountKind: string | null, kind: string, label: string, abandonment: string | undefined, amount: number }>>} amounts in euros
   */
  async #openDebts() {
    return [...payablesOf(await this.deps.getJournalEntries()).values()].map((debt) => ({
      debtorId: debt.debtorId,
      creditorId: debt.creditorId,
      accountKind: debt.accountKind,
      kind: debt.kind,
      label: PAYABLE_KINDS[debt.kind].label,
      abandonment: PAYABLE_KINDS[debt.kind].abandonment,
      amount: debt.centimes / 100,
    }));
  }

  /** The debts owed to a building. */
  async #debtsOwedTo(buildingId) {
    if (!buildingId) throw new Error('[liquidation] a demolished building needs its id: its accounts cannot be closed without it');
    return (await this.#openDebts()).filter((debt) => debt.creditorId === buildingId);
  }

  /**
   * What the demolition of this building will do to the books, without writing anything.
   * @param {{ buildingId: string }} params
   * @returns {Promise<{
   *   abandoned: Array<{ debtorId: string, kind: string, label: string, amount: number }>,
   *   owed: Array<{ kind: string, label: string, amount: number }>,
   * }>} `abandoned`: the debts owed TO it, that will be released; `owed`: the debts it owes ITSELF, that nothing pays yet (they stay open: see the plan), in euros
   */
  async preview({ buildingId }) {
    const abandoned = (await this.#debtsOwedTo(buildingId)).map(({ debtorId, kind, label, amount }) => ({ debtorId, kind, label, amount }));
    const owed = (await this.#openDebts())
      .filter((debt) => debt.debtorId === buildingId)
      .map(({ kind, label, amount }) => ({ kind, label, amount }));
    return { abandoned, owed };
  }

  /**
   * @param {{ buildingId: string, turn: number }} params the building that is about to leave, and the turn it leaves at
   * @returns {Promise<{ abandoned: Array<{ debtorId: string, kind: string, amount: number }> }>} the debts released, in euros
   */
  async execute({ buildingId, turn }) {
    const hamletId = requireActiveHamletId();
    const abandoned = [];
    for (const debt of await this.#debtsOwedTo(buildingId)) {
      if (!debt.abandonment) {
        throw new Error(`[liquidation] ${debt.debtorId} owes the demolished building ${buildingId} a debt of ${debt.label}, and the catalog names no way to abandon it: the demolition must be refused`);
      }
      const result = await this.deps.recordLedgerEntry({
        turn,
        type: debt.abandonment,
        amount: debt.amount,
        description: `[OD] ${debt.label} dus à un bâtiment démoli : dette abandonnée`,
        businessKey: `${debt.abandonment}:${hamletId}:${debt.debtorId}:${buildingId}`,
        buildingInstanceId: debt.debtorId,
        accountBuildingId: debt.debtorId,
        accountKind: debt.accountKind,
        counterpartyBuildingId: buildingId,
      });
      // A building is demolished once: a second line for the same debtor and creditor is a defect, not a skipped line.
      if (!result.recorded) throw new Error(`[liquidation] the ${debt.abandonment} line of ${debt.debtorId} towards ${buildingId} was not recorded: ${result.reason}`);
      abandoned.push({ debtorId: debt.debtorId, kind: debt.kind, amount: debt.amount });
    }
    return { abandoned };
  }
}
