import { payablesOf } from '../../domain/policies/DebtPolicy.js';
import { planLiquidation } from '../../domain/policies/LiquidationPlanPolicy.js';
import { companyAidOf } from '../../domain/policies/CompanyAidLedgerPolicy.js';
import { PAYABLE_KINDS, LIQUIDATION_RECOVERY_RATE } from '../../domain/catalogs/PayableCatalog.js';
import { accountKeyOf, PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { postedStockOf, stockVariationOf } from '../../domain/policies/MonthClosingPolicy.js';
import { LINE_LABELS, recordDebtPayment, recordLine } from './DebtLines.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

const toCentimes = (euros) => Math.round(euros * 100);

/**
 * Application service — the accounts of a building the player demolishes (see docs/gameplay/PLAN_DEMOLITION_LIQUIDATION.md). A demolition closes the books of what
 * stood there as a liquidation would, once, in the turn it happens, in one atomic batch:
 *
 *   - the debts OWED TO the building are abandoned: nobody is left to be paid, so the debtor is released by an opération diverse (no one is prosecuted), and the debt
 *     closes in the journal like a paid one does. Without it a company tries to pay that creditor every month and the month's settlement fails;
 *   - for each account the building holds (a company's, or a house's business): its stock is written off the books and sold at the liquidation rate, its creditors are
 *     paid by rank as far as its cash goes, what is left of a debt is abandoned (the wages are advanced by the city, the other creditors bear the loss), what is left of
 *     the cash goes back to the city up to the capital it put in, and the rest of that capital is written off.
 *
 * A household's own account is not touched: a household is no entity of the plan, and what it owes is erased without prosecution.
 *
 * `preview` and `execute` read the same plan: what the player is told before the demolition is exactly what is written. A building is liquidated once: its lines carry
 * the key prefix `liquidation:<hamlet>:<building>:`, and a second call finds them and does nothing.
 */
export class LiquidateDemolishedBuilding {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   * @param {<T>(work: () => Promise<T>) => Promise<T>} deps.inJournalBatch runs the liquidation so that all its lines are written at once, or none
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ id: string, type: string }>>} deps.listBuildings the hamlet's buildings, for the names in the journal's descriptions
   * @param {(buildingId: string) => Promise<Array<{ accountKind: string | null, stockNature: 'merchandise' | 'production' | null }> | null>} deps.getAccountsOf the accounts a building
   *   holds that a liquidation closes, with the nature of the stock each carries (null: none); null when the building is no longer on the map
   * @param {(buildingId: string, accountKind: string | null) => Promise<number>} deps.cashOf what an account holds in cash, in euros
   * @param {(buildingId: string, period: { year: number, monthIndex: number }) => Promise<Array<{ value: number }>>} deps.valueStock what a building's stock is worth at cost
   * @param {() => Promise<{ id: string, businessAccount: string } | null>} deps.getOwner the property company that is owed the rents, null when none stands
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * Everything the liquidation of this building does, worked out and not written.
   * @param {string} buildingId
   * @param {number} turn
   * @returns {Promise<{ done: boolean, owedToIt: Array<object>, accounts: Array<object>, entries: Array<object> }>}
   */
  async #plan(buildingId, turn) {
    if (!buildingId) throw new Error('[liquidation] a demolished building needs its id: its accounts cannot be closed without it');
    const hamletId = requireActiveHamletId();
    const entries = await this.deps.getJournalEntries();
    const done = entries.some((entry) => typeof entry.businessKey === 'string' && entry.businessKey.startsWith(`liquidation:${hamletId}:${buildingId}:`));
    if (done) return { done: true, owedToIt: [], accounts: [], entries };

    const timeInfo = this.deps.getTimeInfo(turn);
    const period = { year: timeInfo.year, monthIndex: timeInfo.monthIndex };
    const openDebts = [...payablesOf(entries).values()];

    const owedToIt = openDebts.filter((debt) => debt.creditorId === buildingId).map((debt) => {
      const { abandonment, label } = PAYABLE_KINDS[debt.kind];
      return { debtorId: debt.debtorId, accountKind: debt.accountKind, kind: debt.kind, label, abandonment, centimes: debt.centimes };
    });

    const accounts = [];
    for (const { accountKind, stockNature } of (await this.deps.getAccountsOf(buildingId)) ?? []) {
      const key = accountKeyOf({ accountBuildingId: buildingId, accountKind });
      const debts = openDebts
        .filter((debt) => debt.debtorId === buildingId && debt.accountKind === accountKind)
        .map((debt) => ({ id: `${debt.kind}|${debt.creditorId ?? ''}`, rank: PAYABLE_KINDS[debt.kind].rank, amount: debt.centimes, debt }));
      const stocks = [];
      if (stockNature) {
        const items = await this.deps.valueStock(buildingId, period);
        stocks.push({ nature: stockNature, posted: postedStockOf(entries, buildingId, accountKind), live: items.reduce((sum, item) => sum + toCentimes(item.value), 0) });
      }
      // What the city put into this account and did not take back: the capital it received, less what it already gave back.
      let holding = 0;
      for (const entry of entries) {
        if (accountKeyOf(entry) !== key) continue;
        if (entry.type === 'company_capital_received' || entry.type === 'shareholder_capital_received') holding += toCentimes(entry.amount);
        else if (entry.type === 'liquidation_surplus_paid') holding -= toCentimes(entry.amount);
      }
      const cash = toCentimes(await this.deps.cashOf(buildingId, accountKind));
      const { outstanding: loan } = companyAidOf(entries, buildingId, accountKind);
      accounts.push({ accountKind, key, debts, cash, holding, loan, plan: planLiquidation({ cash, stocks, debts, holding, loan, recoveryRate: LIQUIDATION_RECOVERY_RATE }) });
    }
    return { done: false, owedToIt, accounts, entries };
  }

  /**
   * What the demolition of this building will do to the books, without writing anything.
   * @param {{ buildingId: string, turn: number }} params
   * @returns {Promise<{
   *   abandoned: Array<{ debtorId: string, kind: string, label: string, amount: number }>,
   *   accounts: Array<{
   *     cash: number, stockProceeds: number, surplusToCity: number, holdingLoss: number,
   *     paid: Array<{ kind: string, label: string, amount: number }>,
   *     unpaid: Array<{ kind: string, label: string, amount: number, advancedByCity: boolean }>,
   *   }>,
   * }>} amounts in euros. `abandoned`: the debts owed TO the building, released; per account: its cash, what its stock fetches, the debts it pays and the ones left over
   *   (the wages are advanced by the city, the others are lost by the creditor), the cash that goes back to the city and the capital that is lost
   */
  async preview({ buildingId, turn }) {
    const { owedToIt, accounts } = await this.#plan(buildingId, turn);
    return {
      abandoned: owedToIt.map(({ debtorId, kind, label, centimes }) => ({ debtorId, kind, label, amount: centimes / 100 })),
      accounts: accounts.map(({ cash, debts, plan }) => ({
        cash: cash / 100,
        stockProceeds: plan.stockProceeds / 100,
        surplusToCity: plan.surplusToCity / 100,
        holdingLoss: plan.holdingLoss / 100,
        paid: debts.filter(({ id }) => plan.paid.get(id) > 0).map(({ id, debt }) => ({ kind: debt.kind, label: PAYABLE_KINDS[debt.kind].label, amount: plan.paid.get(id) / 100 })),
        unpaid: debts.filter(({ id }) => plan.unpaid.get(id) > 0).map(({ id, debt }) => ({
          kind: debt.kind, label: PAYABLE_KINDS[debt.kind].label, amount: plan.unpaid.get(id) / 100, advancedByCity: debt.kind === 'wage',
        })),
      })),
    };
  }

  /**
   * @param {{ buildingId: string, turn: number }} params the building that is about to leave, and the turn it leaves at
   * @returns {Promise<{ abandoned: Array<{ debtorId: string, kind: string, amount: number }> }>} the debts owed to it that were released, in euros
   */
  async execute({ buildingId, turn }) {
    const { done, owedToIt, accounts } = await this.#plan(buildingId, turn);
    if (done) return { abandoned: [] };

    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(turn);
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const owner = await this.deps.getOwner();
    const names = new Map((await this.deps.listBuildings()).map((building) => [building.id, getBuildingDefinition(building.type)?.displayName]));
    const nameOf = (id) => {
      const name = names.get(id);
      if (!name) throw new Error(`[liquidation] building ${id} has no catalog name for its journal lines`);
      return name;
    };
    const prefix = `liquidation:${hamletId}:${buildingId}`;
    const write = (line, suffix, description) => recordLine(
      this.deps,
      line,
      { time: turn, key: `${prefix}:${suffix}`, description, buildingInstanceId: buildingId, timeInfo },
      { refuseDuplicate: true },
    );
    // An opération diverse: no money moves. Its counterparty is explicit, because it is what ties an abandonment to the debt it closes (the creditor of that debt).
    const od = ({ type, amount, holder, accountKind, counterparty, suffix, description }) => write(
      { kind: type, amount: amount / 100, holder, counterparty, accountKind, flow: null },
      suffix,
      `[OD] ${description} - ${monthLabel}`,
    );

    const abandoned = [];
    await this.deps.inJournalBatch(async () => {
      // 1. The debts owed to this building can never be paid: their debtors are released.
      for (const debt of owedToIt) {
        if (!debt.abandonment) throw new Error(`[liquidation] ${debt.debtorId} owes the demolished building ${buildingId} a debt of ${debt.label}, and the catalog names no way to abandon it`);
        await od({
          type: debt.abandonment,
          amount: debt.centimes,
          holder: debt.debtorId,
          accountKind: debt.accountKind,
          counterparty: buildingId,
          suffix: `abandoned:${debt.abandonment}:${debt.debtorId}`,
          description: `${debt.label} dus à un bâtiment démoli : dette abandonnée`,
        });
        abandoned.push({ debtorId: debt.debtorId, kind: debt.kind, amount: debt.centimes / 100 });
      }

      // 2. Each account the building holds is liquidated.
      for (const { accountKind, key, debts, plan, holding, loan } of accounts) {
        // The stock leaves the books, and is sold at the liquidation rate.
        for (const { nature, posted } of plan.stockOut) {
          const variation = stockVariationOf({ live: 0, posted, nature });
          await od({
            type: variation.type, amount: toCentimes(variation.amount), holder: buildingId, accountKind, counterparty: null, suffix: `${key}:stock:${nature}`, description: 'Stock soldé à la liquidation',
          });
        }
        if (plan.stockProceeds > 0) {
          await write(
            { kind: 'liquidation_stock_sale', amount: plan.stockProceeds / 100, holder: buildingId, counterparty: null, accountKind, flow: null },
            `${key}:stock-sale`,
            `${LINE_LABELS.liquidation_stock_sale} ${nameOf(buildingId)} - ${monthLabel}`,
          );
        }

        // The creditors are paid by rank as far as the cash goes; the payment is written as the monthly settlement writes one, apart from its key.
        for (const { id, debt } of debts) {
          const paid = plan.paid.get(id);
          if (paid > 0) {
            await recordDebtPayment(this.deps, { debt, amount: paid / 100, owner, time: turn, timeInfo, hamletId, monthLabel, nameOf, keySuffix: ':liquidation', refuseDuplicate: true });
          }
        }

        // What is left of a debt is abandoned: the debtor is released and the creditor bears the loss (the city advances the wages).
        for (const { id, debt } of debts) {
          const left = plan.unpaid.get(id);
          if (!(left > 0)) continue;
          const { abandonment, creditorLoss, label } = PAYABLE_KINDS[debt.kind];
          const creditorKey = debt.creditorId ?? 'city';
          await od({
            type: abandonment, amount: left, holder: buildingId, accountKind, counterparty: debt.creditorId, suffix: `${key}:abandoned:${abandonment}:${creditorKey}`, description: `${label} non payés à la liquidation : dette abandonnée`,
          });
          if (debt.kind === 'wage') {
            const flow = `liquidation:wage_guarantee:${buildingId}:${debt.creditorId}`;
            await write(
              { kind: 'wage_guarantee', amount: left / 100, holder: null, counterparty: debt.creditorId, flow },
              `${key}:guarantee:${debt.creditorId}`,
              `${LINE_LABELS.wage_guarantee} : ${nameOf(debt.creditorId)} - ${monthLabel}`,
            );
            await write(
              { kind: 'household_wage', amount: left / 100, holder: debt.creditorId, counterparty: buildingId, accountKind: PERSONAL_ACCOUNT, flow },
              `${key}:guarantee-received:${debt.creditorId}`,
              `${LINE_LABELS.household_wage} de la garantie des salaires - ${monthLabel}`,
            );
          } else {
            // The creditor's loss, on its own account: the city's (no account), or the property company's.
            const holder = debt.kind === 'premises_rent' ? owner?.id ?? null : null;
            const lossAccountKind = debt.kind === 'premises_rent' ? owner?.businessAccount ?? null : null;
            if (debt.kind === 'premises_rent' && !holder) throw new Error(`[liquidation] ${buildingId} owes rent but no owner stands to bear the loss: the rent debt of ${debt.creditorId} cannot be closed`);
            await od({
              type: creditorLoss, amount: left, holder, accountKind: lossAccountKind, counterparty: buildingId, suffix: `${key}:loss:${creditorLoss}:${creditorKey}`, description: `${label} non payés à la liquidation : créance perdue`,
            });
          }
        }

        // What the company still owes the city of a loan of working capital is paid back as far as the cash goes; the rest is abandoned, and the city bears the loss.
        if (plan.loanRepaid > 0) {
          const flow = `liquidation:aid-loan:${buildingId}:${key}`;
          await write({ kind: 'aid_loan_repaid', amount: plan.loanRepaid / 100, holder: buildingId, counterparty: null, accountKind, flow }, `${key}:aid-loan-repaid`, `${LINE_LABELS.aid_loan_repaid} - ${monthLabel}`);
          await write({ kind: 'aid_loan_repayment_received', amount: plan.loanRepaid / 100, holder: null, counterparty: buildingId, flow }, `${key}:aid-loan-received`, `${LINE_LABELS.aid_loan_repayment_received} - ${monthLabel}`);
        }
        if (plan.loanLost > 0) {
          await od({ type: 'od_aid_loan_abandoned', amount: plan.loanLost, holder: buildingId, accountKind, counterparty: null, suffix: `${key}:aid-loan-abandoned`, description: 'Prêt de la ville non remboursé à la liquidation : dette abandonnée' });
          await od({ type: 'od_aid_loan_loss', amount: plan.loanLost, holder: null, accountKind: null, counterparty: buildingId, suffix: `${key}:aid-loan-loss`, description: 'Prêt à une entreprise liquidée : créance perdue' });
        }

        // What is left of the cash goes back to the city as the capital it put in; the rest of that capital is lost.
        if (plan.surplusToCity > 0) {
          const flow = `liquidation:surplus:${buildingId}:${key}`;
          await write({ kind: 'liquidation_surplus_paid', amount: plan.surplusToCity / 100, holder: buildingId, counterparty: null, accountKind, flow }, `${key}:surplus-paid`, `${LINE_LABELS.liquidation_surplus_paid} - ${monthLabel}`);
          await write({ kind: 'liquidation_surplus_received', amount: plan.surplusToCity / 100, holder: null, counterparty: buildingId, flow }, `${key}:surplus-received`, `${LINE_LABELS.liquidation_surplus_received} - ${monthLabel}`);
        }
        if (plan.holdingLoss > 0 && holding > 0) {
          await od({
            type: 'od_holding_written_off', amount: plan.holdingLoss, holder: null, accountKind: null, counterparty: buildingId, suffix: `${key}:holding`, description: 'Capital perdu dans une entreprise liquidée',
          });
        }
      }
    });
    return { abandoned };
  }
}
