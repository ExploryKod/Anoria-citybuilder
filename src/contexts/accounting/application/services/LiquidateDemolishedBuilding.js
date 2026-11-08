import { payablesOf } from '../../domain/policies/DebtPolicy.js';
import { planLiquidation } from '../../domain/policies/LiquidationPlanPolicy.js';
import { companyAidOf } from '../../domain/policies/CompanyAidLedgerPolicy.js';
import { DEPOSIT_GUARANTEE_CAP } from '../../domain/catalogs/BankCatalog.js';
import { PAYABLE_KINDS, LIQUIDATION_RECOVERY_RATE } from '../../domain/catalogs/PayableCatalog.js';
import { accountKeyOf, isCentralBankAccount, PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { postedStockOf, stockVariationOf } from '../../domain/policies/MonthClosingPolicy.js';
import { LINE_LABELS, recordDebtPayment, recordLine } from './DebtLines.js';
import { depositorsOf } from '../../domain/policies/DepositBalancePolicy.js';
import { deriveLoanPortfolio } from '../../domain/policies/TreasuryFromJournalPolicy.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

const toCentimes = (euros) => Math.round(euros * 100);

/** An account that is not the bank collects nothing and owes no depositor. */
const NO_BANK_BOOKS = Object.freeze({ cityLoans: [], companyCredits: [], depositors: [] });

/** @param {Map<string, { debit: number, credit: number }> | undefined} totals @param {string} account @returns {number} the account's credit balance, in centimes */
const creditBalance = (totals, account) => {
  const total = totals?.get(account);
  return total ? total.credit - total.debit : 0;
};

/**
 * Application service — the accounts of a building the player demolishes (see docs/gameplay/PLAN_DEMOLITION_LIQUIDATION.md). A demolition closes the books of what
 * stood there as a liquidation would, once, in the turn it happens, in one atomic batch:
 *
 *   - the debts OWED TO the building are abandoned: nobody is left to be paid, so the debtor is released by an opération diverse (no one is prosecuted), and the debt
 *     closes in the journal like a paid one does. Without it a company tries to pay that creditor every month and the month's settlement fails;
 *   - for each account the building holds (a company's, or a house's business): its stock is written off the books and sold at the liquidation rate, its creditors are
 *     paid by rank as far as its cash goes, what is left of a debt is abandoned (the wages are advanced by the city, the other creditors bear the loss), its credit from
 *     the bank is repaid or lost, what is left of the cash goes back to the city up to the capital it put in, and the rest of that capital is written off;
 *   - the bank, besides: it first collects back what it lent (the city repays its loans, each company its credit as far as its cash goes), gives its depositors their
 *     savings back as far as its cash goes (the city guarantees the rest), and repays the central bank as far as it can (the central bank loses the rest).
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
   * @param {() => Promise<import('../../domain/policies/LegsFold.js').LegsFold>} deps.getLegsFold what each account owes or is owed of a bank loan is read from it
   * @param {() => Promise<string | null>} deps.findBankBuildingId the hamlet's bank: the lender of every company's credit, the one whose depositors a liquidation pays
   * @param {() => Promise<string>} deps.findCentralBankId the account of the State's central bank (the institution): what the bank owes it is repaid or lost at the bank's liquidation
   * @param {{ liveReservesOf: (bankId: string, turn: number) => Promise<{ reserves: number, sightDeposits: number }>, centraliseBankBooks: (params: object) => Promise<void> }} deps.bankBooks
   *   the bank's reserves and its customers' deposits, live, and the centralisation of its books (BankRefinancing.js): a liquidated bank pays out of its reserves
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
    // What each account owes or is owed of a loan between the bank, the companies and the central bank, read from the fold (a purge keeps it).
    const foldTotals = (await this.deps.getLegsFold()).totalsByAccount({ hamletId, untilYear: timeInfo.year });
    const bankId = await this.deps.findBankBuildingId();

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
      // A bank pays out of its reserves at the central bank, once its customers' sight deposits are paid out of them (their money leaves with them as banknotes):
      // what is left of its reserves is what its other creditors share. Any other account pays out of its cash.
      const isTheBank = accountKind === null && buildingId === bankId;
      const liveBank = isTheBank ? await this.deps.bankBooks.liveReservesOf(buildingId, turn) : null;
      const cash = isTheBank ? liveBank.reserves - liveBank.sightDeposits : toCentimes(await this.deps.cashOf(buildingId, accountKind));
      const { outstanding: loan } = companyAidOf(entries, buildingId, accountKind);
      // What the company owes the bank of its credit (its 1643), and, for the bank itself, its own books: what it collects back and what it owes.
      const totals = foldTotals.get(key);
      const bankCredit = creditBalance(totals, '1643');
      const bank = isTheBank ? await this.#bankBooksOf(buildingId, entries, foldTotals) : NO_BANK_BOOKS;
      const collected = bank.cityLoans.reduce((sum, { amount }) => sum + amount, 0) + bank.companyCredits.reduce((sum, { repaid }) => sum + repaid, 0);
      // What the bank owes the central bank in its two facilities (the marginal lending is repaid first, the dearer).
      const marginalOwed = creditBalance(totals, '1648');
      const refinancing = creditBalance(totals, '1649') + marginalOwed;
      const deposits = bank.depositors.map(({ houseId, amount }) => ({ id: houseId, amount }));
      accounts.push({
        accountKind, key, debts, cash, holding, loan, bankCredit, bank, refinancing, marginalOwed, isTheBank,
        plan: planLiquidation({ cash, stocks, debts, holding, loan, recoveryRate: LIQUIDATION_RECOVERY_RATE, bankCredit, collected, deposits, refinancing, depositGuaranteeCap: toCentimes(DEPOSIT_GUARANTEE_CAP) }),
      });
    }
    return { done: false, owedToIt, accounts, entries, bankId };
  }

  /**
   * What the bank collects back before it closes, and what it owes its depositors: the city repays its loans whole (the liquidator calls them in), each company its
   * credit as far as its cash goes (the rest is abandoned), and each house is owed its savings.
   * @param {string} bankId
   * @param {Array<object>} entries
   * @param {Map<string | null, Map<string, { debit: number, credit: number }>>} foldTotals the fold's totals by account, up to now
   * @returns {Promise<{ cityLoans: Array<{ loanId: string, amount: number }>, companyCredits: Array<{ companyId: string, owed: number, repaid: number }>, depositors: Array<{ houseId: string, amount: number }> }>} centimes
   */
  async #bankBooksOf(bankId, entries, foldTotals) {
    const cityLoans = deriveLoanPortfolio(entries).loans
      .filter((loan) => loan.lenderBuildingId === bankId)
      .map((loan) => ({ loanId: loan.id, amount: toCentimes(loan.amount) }));
    const companyCredits = [];
    for (const [accountKey, totals] of foldTotals) {
      // A company's own account is its id (no account kind): every company of the hamlet borrows from its one bank.
      if (accountKey === null || accountKey === bankId || accountKey.includes('/') || isCentralBankAccount(accountKey)) continue;
      const owed = creditBalance(totals, '1643');
      if (owed <= 0) continue;
      const cash = toCentimes(await this.deps.cashOf(accountKey, null));
      companyCredits.push({ companyId: accountKey, owed, repaid: Math.max(0, Math.min(cash, owed)) });
    }
    const depositors = depositorsOf(entries, bankId).map(({ houseId, amount }) => ({ houseId, amount: toCentimes(amount) }));
    return { cityLoans, companyCredits, depositors };
  }

  /**
   * What the demolition of this building will do to the books, without writing anything.
   * @param {{ buildingId: string, turn: number }} params
   * @returns {Promise<{
   *   abandoned: Array<{ debtorId: string, kind: string, label: string, amount: number }>,
   *   accounts: Array<{
   *     cash: number, stockProceeds: number, surplusToCity: number, holdingLoss: number,
   *     bankCreditLost: number, cityLoansRepaid: number, depositsRepaid: number, depositsGuaranteed: number, depositsLost: number, refinancingLost: number,
   *     paid: Array<{ kind: string, label: string, amount: number }>,
   *     unpaid: Array<{ kind: string, label: string, amount: number, advancedByCity: boolean }>,
   *   }>,
   * }>} amounts in euros. `abandoned`: the debts owed TO the building, released; per account: its cash, what its stock fetches, the debts it pays and the ones left over
   *   (the wages are advanced by the city, the others are lost by the creditor), what it cannot repay of its bank credit, the cash that goes back to the city and the
   *   capital that is lost; for the bank, what the city repays of its loans, the savings it gives back and the ones the city guarantees, the refinancing the central bank loses
   */
  async preview({ buildingId, turn }) {
    const { owedToIt, accounts } = await this.#plan(buildingId, turn);
    const sum = (map) => [...map.values()].reduce((total, centimes) => total + centimes, 0) / 100;
    return {
      abandoned: owedToIt.map(({ debtorId, kind, label, centimes }) => ({ debtorId, kind, label, amount: centimes / 100 })),
      accounts: accounts.map(({ cash, debts, plan, bank }) => ({
        cash: cash / 100,
        stockProceeds: plan.stockProceeds / 100,
        surplusToCity: plan.surplusToCity / 100,
        holdingLoss: plan.holdingLoss / 100,
        bankCreditLost: plan.bankCreditLost / 100,
        cityLoansRepaid: bank.cityLoans.reduce((total, { amount }) => total + amount, 0) / 100,
        depositsRepaid: sum(plan.depositsPaid),
        depositsGuaranteed: sum(plan.depositsGuaranteed),
        depositsLost: sum(plan.depositsLost),
        refinancingLost: plan.refinancingLost / 100,
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
    const { done, owedToIt, accounts, bankId } = await this.#plan(buildingId, turn);
    if (done) return { abandoned: [] };
    const centralBankId = await this.deps.findCentralBankId();

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
      for (const { accountKind, key, debts, plan, holding, bank, isTheBank, marginalOwed } of accounts) {
        // The bank first collects back what it lent: the city repays its loans whole, each company its credit as far as its cash goes (the rest is abandoned).
        for (const { loanId, amount } of bank.cityLoans) {
          const flow = `liquidation:city-loan:${buildingId}:${loanId}`;
          await write({ kind: 'loan_repayment', amount: amount / 100, holder: null, counterparty: buildingId, flow, loanId }, `${key}:city-loan:${loanId}`, `Prêt remboursé à la banque liquidée - ${monthLabel}`);
          await write({ kind: 'loan_repayment_received', amount: amount / 100, holder: buildingId, counterparty: null, flow, loanId }, `${key}:city-loan-received:${loanId}`, `Prêt de la ville remboursé à la liquidation - ${monthLabel}`);
        }
        for (const { companyId, owed, repaid } of bank.companyCredits) {
          await this.#settleBankCredit({ write, od, companyId, bankId: buildingId, repaid, lost: owed - repaid, suffix: `${key}:company-credit:${companyId}`, monthLabel, nameOf });
        }
        // Then its books are centralised, and its customers' sight deposits are paid out of its reserves, in banknotes: the central bank's reserves for it become money
        // issued. What is left of its reserves is what the rest of the liquidation shares.
        if (isTheBank) {
          await this.deps.bankBooks.centraliseBankBooks({ time: turn, bankId: buildingId, syncDeposits: true, keySuffix: 'liquidation-open' });
          const { sightDeposits } = await this.deps.bankBooks.liveReservesOf(buildingId, turn);
          if (sightDeposits > 0) {
            await od({ type: 'od_sight_deposits_released', amount: sightDeposits, holder: buildingId, accountKind: null, counterparty: centralBankId, suffix: `${key}:sight-deposits-released`, description: 'Dépôts des clients rendus en billets' });
            await od({ type: 'od_reserves_released', amount: sightDeposits, holder: centralBankId, accountKind: null, counterparty: buildingId, suffix: `${key}:reserves-released`, description: 'Réserves de la banque liquidée sorties en billets' });
          }
        }
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

        // What the company owes the bank of its credit is repaid as far as the cash goes; the rest is abandoned, and the bank bears the loss.
        if (plan.bankCreditRepaid > 0 || plan.bankCreditLost > 0) {
          if (!bankId) throw new Error(`[liquidation] ${buildingId} owes the bank ${(plan.bankCreditRepaid + plan.bankCreditLost) / 100} € of credit, but no bank stands to settle it`);
          await this.#settleBankCredit({ write, od, companyId: buildingId, bankId, repaid: plan.bankCreditRepaid, lost: plan.bankCreditLost, suffix: `${key}:bank-credit`, monthLabel, nameOf });
        }

        // The bank gives its depositors their savings back as far as its cash goes; what it cannot, the city guarantees (it pays the house, the bank's debt is abandoned).
        for (const { houseId } of bank.depositors) {
          const repaid = plan.depositsPaid.get(houseId);
          if (repaid > 0) {
            const flow = `liquidation:deposit:${buildingId}:${houseId}`;
            await write({ kind: 'withdrawal', amount: repaid / 100, holder: houseId, counterparty: buildingId, accountKind: PERSONAL_ACCOUNT, flow }, `${key}:deposit-repaid:${houseId}`, `Épargne rendue par la banque liquidée à ${nameOf(houseId)} - ${monthLabel}`);
            await write({ kind: 'withdrawal_paid', amount: repaid / 100, holder: buildingId, counterparty: houseId, flow }, `${key}:deposit-paid:${houseId}`, `Épargne rendue à ${nameOf(houseId)} à la liquidation - ${monthLabel}`);
          }
          const guaranteed = plan.depositsGuaranteed.get(houseId);
          const lost = plan.depositsLost.get(houseId);
          if (guaranteed + lost > 0) {
            await od({ type: 'od_deposit_abandoned', amount: guaranteed + lost, holder: buildingId, accountKind: null, counterparty: houseId, suffix: `${key}:deposit-abandoned:${houseId}`, description: `Épargne de ${nameOf(houseId)} que la banque liquidée ne peut rendre` });
          }
          if (guaranteed > 0) {
            const flow = `liquidation:deposit-guarantee:${buildingId}:${houseId}`;
            await write({ kind: 'deposit_guarantee', amount: guaranteed / 100, holder: null, counterparty: houseId, flow }, `${key}:guarantee:${houseId}`, `Épargne de ${nameOf(houseId)} garantie par la ville (jusqu'au plafond) - ${monthLabel}`);
            await write({ kind: 'deposit_guarantee_received', amount: guaranteed / 100, holder: houseId, counterparty: buildingId, accountKind: PERSONAL_ACCOUNT, flow }, `${key}:guarantee-received:${houseId}`, `Épargne rendue par la garantie de la ville - ${monthLabel}`);
          }
          // Beyond the cap the city does not guarantee: the saver loses it.
          if (lost > 0) {
            await od({ type: 'od_deposit_lost', amount: lost, holder: houseId, accountKind: PERSONAL_ACCOUNT, counterparty: buildingId, suffix: `${key}:deposit-lost:${houseId}`, description: `Épargne de ${nameOf(houseId)} perdue au-delà du plafond de la garantie` });
          }
        }

        // The bank repays the central bank as far as its cash goes (the marginal lending first, the dearer); the rest is abandoned, and the central bank bears the loss (the money it created stays issued).
        if (plan.refinancingRepaid > 0 || plan.refinancingLost > 0) {
          if (!centralBankId) throw new Error(`[liquidation] ${buildingId} owes ${(plan.refinancingRepaid + plan.refinancingLost) / 100} € of refinancing, but no central bank stands to settle it`);
          // Each facility's share: the marginal lending takes the repayment first, the main refinancing what is left of it; the losses fall the other way round.
          const repaidMarginal = Math.min(marginalOwed, plan.refinancingRepaid);
          const repaidMain = plan.refinancingRepaid - repaidMarginal;
          const lostMarginal = marginalOwed - repaidMarginal;
          const lostMain = plan.refinancingLost - lostMarginal;
          const facilities = [
            { name: 'marginal', repaid: repaidMarginal, lost: lostMarginal, repayKind: 'marginal_repaid', abandonType: 'od_marginal_abandoned', label: 'Prêt marginal' },
            { name: 'main', repaid: repaidMain, lost: lostMain, repayKind: 'refinancing_repaid', abandonType: 'od_refinancing_abandoned', label: 'Refinancement' },
          ];
          for (const { name, repaid, lost, repayKind, abandonType, label } of facilities) {
            const suffix = name === 'main' ? '' : `:${name}`;
            if (repaid > 0) {
              const flow = `liquidation:refinancing:${buildingId}${suffix}`;
              await write({ kind: repayKind, amount: repaid / 100, holder: buildingId, counterparty: centralBankId, flow }, `${key}:refinancing-repaid${suffix}`, `${label} remboursé à la liquidation - ${monthLabel}`);
              await write({ kind: 'od_refinancing_retired', amount: repaid / 100, holder: centralBankId, counterparty: buildingId, flow }, `${key}:refinancing-retired${suffix}`, `[OD] ${label} remboursé par la banque liquidée - ${monthLabel}`);
            }
            if (lost > 0) {
              await od({ type: abandonType, amount: lost, holder: buildingId, accountKind: null, counterparty: centralBankId, suffix: `${key}:refinancing-abandoned${suffix}`, description: `${label} non remboursé à la liquidation : dette abandonnée` });
              await od({ type: 'od_refinancing_loss', amount: lost, holder: centralBankId, accountKind: null, counterparty: buildingId, suffix: `${key}:refinancing-loss${suffix}`, description: `${label} d’une banque liquidée : créance perdue` });
            }
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

        // The bank's books closed: what it paid out comes off its reserves; reserves left below nothing are a debt to the central bank it never repays.
        if (isTheBank) {
          await this.deps.bankBooks.centraliseBankBooks({ time: turn, bankId: buildingId, syncDeposits: false, keySuffix: 'liquidation-close' });
          const { centralisedReserves } = await this.#reservesBalanceOf(buildingId, timeInfo.year);
          if (centralisedReserves < 0) {
            await od({ type: 'od_reserves_overdraft_abandoned', amount: -centralisedReserves, holder: buildingId, accountKind: null, counterparty: centralBankId, suffix: `${key}:reserves-overdraft-abandoned`, description: 'Découvert à la banque centrale non remboursé : dette abandonnée' });
            await od({ type: 'od_reserves_overdraft_loss', amount: -centralisedReserves, holder: centralBankId, accountKind: null, counterparty: buildingId, suffix: `${key}:reserves-overdraft-loss`, description: 'Découvert d’une banque liquidée : créance perdue' });
          }
        }
      }
    });
    return { abandoned };
  }

  /** @param {string} bankId @param {number} year @returns {Promise<{ centralisedReserves: number }>} the bank's reserves at the central bank (5151), in centimes */
  async #reservesBalanceOf(bankId, year) {
    const total = (await this.deps.getLegsFold()).totalsByAccount({ hamletId: requireActiveHamletId(), untilYear: year }).get(accountKeyOf({ accountBuildingId: bankId }))?.get('5151');
    return { centralisedReserves: total ? total.debit - total.credit : 0 };
  }

  /**
   * A company's credit from the bank closed at a liquidation (the company's, or the bank's when it calls its credits in): what is repaid moves the company's cash to
   * the bank; what is lost is abandoned by the company (7718) and lost by the bank (654).
   */
  async #settleBankCredit({ write, od, companyId, bankId, repaid, lost, suffix, monthLabel, nameOf }) {
    if (repaid > 0) {
      const flow = `liquidation:bank-credit:${companyId}`;
      await write({ kind: 'bank_credit_repaid', amount: repaid / 100, holder: companyId, counterparty: bankId, flow }, `${suffix}:repaid`, `Crédit de la banque remboursé par ${nameOf(companyId)} à la liquidation - ${monthLabel}`);
      await write({ kind: 'bank_credit_repayment_received', amount: repaid / 100, holder: bankId, counterparty: companyId, flow }, `${suffix}:received`, `Crédit remboursé par ${nameOf(companyId)} à la liquidation - ${monthLabel}`);
    }
    if (lost > 0) {
      await od({ type: 'od_bank_credit_abandoned', amount: lost, holder: companyId, accountKind: null, counterparty: bankId, suffix: `${suffix}:abandoned`, description: 'Crédit de la banque non remboursé à la liquidation : dette abandonnée' });
      await od({ type: 'od_bank_credit_loss', amount: lost, holder: bankId, accountKind: null, counterparty: companyId, suffix: `${suffix}:loss`, description: `Crédit à ${nameOf(companyId)} non remboursé : créance perdue` });
    }
  }
}
