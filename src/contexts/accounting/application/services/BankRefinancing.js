import { v4 as uuidv4 } from 'uuid';
import { accountKeyOf, isCentralBankAccount } from '../../domain/policies/AccountKeyPolicy.js';
import { collateralCapacityOf, corridorOf, refinancingMonthOf, requiredReserveOf, reservesInterestOf } from '../../domain/policies/LoanRatePolicy.js';
import { CASH_ACCOUNTS } from '../../domain/policies/EntryLegsPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { DEPOSIT_GUARANTEE_PREMIUM_RATE } from '../../domain/catalogs/BankCatalog.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

/**
 * The bank's accounts of what it owes the central bank, the sub-accounts of 164 its lines post to (PcgJournalCatalog.js): the main refinancing (the reserve upkeep, at the
 * policy rate) and the marginal lending (reserves borrowed at once to lend, at the dearer rate of the corridor), apart so that each keeps its rate. And its loans, what it can pledge.
 */
const REFINANCING_ACCOUNT = '1649';
const MARGINAL_ACCOUNT = '1648';
const LOANS_ACCOUNT = '274';
/** The State's founding endowment (its dotations, M57 1021), the central bank's claim for it (2768) and the Treasury's account it holds (1674): PcgJournalCatalog.js. */
const FOUNDING_ACCOUNT = '1021';
const ENDOWMENT_ACCOUNT = '2768';
const TREASURY_ACCOUNT_AT_BANK = '1674';
/** A customer's money at the bank (its 512), the bank's sight deposits (1651), its reserves at the central bank (5151), and the central bank's side of them (1673). */
const DEPOSIT_ACCOUNT = '512';
const SIGHT_DEPOSITS_ACCOUNT = '1651';
const RESERVES_ACCOUNT = '5151';
const RESERVES_HELD_ACCOUNT = '1673';
/** The central bank's money in the public's hands: what it issued and is held neither by the Treasury nor by a bank as reserves (the banknotes). */
const ISSUED_MONEY_ACCOUNT = '1678';

/** The two facilities a bank borrows reserves from: the journal type of what it receives, and the words of its lines. */
const FACILITIES = Object.freeze({
  main: Object.freeze({ received: 'refinancing_received', label: 'Refinancement' }),
  marginal: Object.freeze({ received: 'marginal_received', label: 'Prêt marginal' }),
});

/**
 * What the customers of the State hold (every account but the State's, its central bank's and its bank's): their money, a deposit at the bank when the State has one,
 * banknotes when it has none. The same 512 in their books either way (their money, as the plan comptable's bank account).
 * @param {Map<string | null, Map<string, { debit: number, credit: number }>>} byAccount the fold's totals by account
 * @param {string | null} bankKey the bank's account, left out (null when the State has no bank)
 * @returns {number} centimes
 */
function customersMoneyOf(byAccount, bankKey) {
  let money = 0;
  for (const [accountKey, totals] of byAccount) {
    if (accountKey === null || accountKey === bankKey || isCentralBankAccount(accountKey)) continue;
    const total = totals.get(DEPOSIT_ACCOUNT);
    if (total) money += total.debit - total.credit;
  }
  return money;
}

/**
 * Application service — the central bank refinances the bank (see BankCatalog.js). Nothing is stored: what the bank owes is the balance of its 1649, read from
 * the fold of the journal, so a purge keeps it.
 *   - `coverShortfall`: before the bank pays out (a depositor's withdrawal, a loan), it borrows exactly what its cash lacks, at the policy rate, from a central bank
 *     that works (one stands with its posts filled). A loan must also leave the reserve the ratio in force asks (the reserve is what the withdrawals draw on, so a
 *     withdrawal may use it). The central bank creates the money: its loan (274) against the money issued (1678), no cash of its own. With no central bank at work
 *     there is no refinancing, and the payment is refused.
 *   - `settleMonth`: each month, the bank pays the interest at the policy rate in force (what its cash cannot pay is added to the debt, no money moves), then repays
 *     out of its cash above the reserve. The repayment destroys the money the central bank created. Each line once (its business key).
 *     Every January, the central bank then pays its State what it earned (its result not yet paid): a real central bank's profit goes to the State. It credits the
 *     Treasury's account it holds; it has no money of its own to be short of.
 *     Last, the Treasury's account the central bank holds (1674) is brought level with the State's money (the écriture de centralisation of the month): what the State
 *     received from the public came back to the central bank, what it paid out is money issued, and its founding endowment was created once.
 *
 * The central bank is the State's institution (docs/gameplay/PLAN_BANK_MONEY.md): its books are held under the State (`centralBankAccountOf`), from the founding, whether
 * its building stands or not; the building opens the counter (the refinancing needs it working).
 */
export class BankRefinancing {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<string | null>} deps.findBankBuildingId the hamlet's bank, null while none is built
   * @param {() => Promise<string>} deps.findCentralBankId the account of this State's central bank, the institution (it always exists: `centralBankAccountOf`)
   * @param {() => Promise<{ refinancingAvailable: boolean, rate: number, reserveRatio: number }>} deps.getPolicyRateStatus whether this State's central bank works
   *   (it alone refinances this State's bank), and the federation's policy rate and reserve ratio in force
   * @param {(bankId: string) => Promise<{ status: 'sound' | 'warning' | 'frozen' | 'insolvent' }>} deps.getCapitalStatus the bank's equity against its loans (LoanRatePolicy.capitalStatusOf)
   * @param {() => Promise<import('../../domain/policies/LegsFold.js').LegsFold>} deps.getLegsFold
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * Before the bank does something that takes reserves or raises its deposits, it checks it keeps the reserve the ratio asks of its deposits afterwards; what it lacks,
   * a working central bank of its State lends it (it creates the reserves), otherwise the operation is refused. A loan to a customer takes no reserves (it creates the
   * deposit: `depositsAdded`); a loan to the State takes reserves (the money leaves the bank for the Treasury's account: `reservesOut`).
   * The central bank lends only against collateral (the bank's loans, less the haircut, and the loan it is about to make counts too): the bank owes it at most that value in all.
   * A bank that cannot be lent the whole shortfall is refused with the reason (`no_central_bank`, `collateral`), and one under its minimum capital ratio lends nothing new (`capital`). Two facilities: the marginal lending (the default, dearer: the
   * bank borrows at once to lend) and the main refinancing (`facility: 'main'`, the reserve upkeep at the month's close, which may lend what the collateral allows, `partial`).
   * @param {{ turn: number, bankId: string, reservesOut: number, depositsAdded: number, facility?: 'marginal' | 'main', partial?: boolean }} params euros
   * @returns {Promise<{ covered: boolean, borrowed: number, reason?: 'no_central_bank' | 'collateral' | 'capital' }>} `covered`: the bank can do it now; `borrowed`: what it took from the central
   *   bank for it, in euros
   */
  async coverShortfall({ turn, bankId, reservesOut, depositsAdded, facility = 'marginal', partial = false }) {
    if (!bankId) throw new Error('[refinancing] a shortfall is covered for a bank');
    for (const [name, value] of Object.entries({ reservesOut, depositsAdded })) {
      if (!Number.isFinite(value) || value < 0) throw new Error(`[refinancing] ${name} is a sum of zero or more, got ${value}`);
    }
    if (!FACILITIES[facility]) throw new Error(`[refinancing] "${facility}" is not a facility of the central bank (${Object.keys(FACILITIES).join(', ')})`);
    // The supervisor: a bank under its minimum capital ratio (or insolvent) lends nothing new, whatever its reserves.
    if (reservesOut + depositsAdded > 0 && ['frozen', 'insolvent'].includes((await this.deps.getCapitalStatus(bankId)).status)) return { covered: false, borrowed: 0, reason: 'capital' };
    const status = await this.deps.getPolicyRateStatus();
    const position = await this.#positionOf(bankId, this.deps.getTimeInfo(turn).year);
    const required = requiredReserveOf({ deposits: position.reserveBase + Math.round(depositsAdded * 100), reserveRatio: status.reserveRatio });
    const shortfall = required + Math.round(reservesOut * 100) - position.reserves;
    if (shortfall <= 0) return { covered: true, borrowed: 0 };
    // Only this State's own central bank refinances this State's bank: one that works elsewhere in the federation does not lend here.
    if (!status.refinancingAvailable) return { covered: false, borrowed: 0, reason: 'no_central_bank' };
    const centralBankId = await this.deps.findCentralBankId();
    // Against collateral: the loan the bank is about to make is collateral too (it is being made with this money).
    const capacity = collateralCapacityOf({ loans: position.loans, owed: position.main + position.marginal, newLending: Math.round((reservesOut + depositsAdded) * 100) });
    const lent = partial ? Math.min(shortfall, capacity) : shortfall;
    if ((!partial && shortfall > capacity) || lent <= 0) return { covered: false, borrowed: 0, reason: 'collateral' };

    const transactionId = uuidv4();
    const amount = lent / 100;
    const description = `${FACILITIES[facility].label} de la banque par la banque centrale (${amount.toFixed(2)} €)`;
    await this.#record({ turn, transactionId, type: FACILITIES[facility].received, amount, description, accountBuildingId: bankId, counterpartyBuildingId: centralBankId });
    await this.#record({ turn, transactionId, type: 'od_refinancing_issued', amount, description, accountBuildingId: centralBankId, counterpartyBuildingId: bankId });
    return { covered: lent >= shortfall, borrowed: amount, ...(lent >= shortfall ? {} : { reason: 'collateral' }) };
  }

  /**
   * What the bank owes the central bank now, in both facilities, read from the fold of the journal.
   * @param {number} turn the turn it is read at
   * @returns {Promise<number>} euros; 0 while no bank is built
   */
  async outstanding(turn) {
    const bankId = await this.deps.findBankBuildingId();
    if (!bankId) return 0;
    const owed = await this.#creditBalancesOf(bankId, this.deps.getTimeInfo(turn).year);
    return (owed(REFINANCING_ACCOUNT) + owed(MARGINAL_ACCOUNT)) / 100;
  }

  /**
   * The bank's reserves at the central bank against what its customers hold there and the reserve the ratio in force asks of it, read from the journal.
   * @param {number} turn
   * @returns {Promise<{ reserves: number, sightDeposits: number, savings: number, deposits: number, requiredReserve: number } | null>} euros (`deposits`: sight and savings
   *   together, what the reserve is asked on); null while no bank is built
   */
  async position(turn) {
    const bankId = await this.deps.findBankBuildingId();
    if (!bankId) return null;
    const position = await this.#positionOf(bankId, this.deps.getTimeInfo(turn).year);
    const { reserveRatio } = await this.deps.getPolicyRateStatus();
    return {
      reserves: position.reserves / 100,
      sightDeposits: position.sightDeposits / 100,
      savings: position.savings / 100,
      deposits: position.reserveBase / 100,
      requiredReserve: requiredReserveOf({ deposits: position.reserveBase, reserveRatio }) / 100,
      loans: position.loans / 100,
      owedMain: position.main / 100,
      owedMarginal: position.marginal / 100,
      collateralCapacity: collateralCapacityOf({ loans: position.loans, owed: position.main + position.marginal }) / 100,
    };
  }

  /**
   * The bank's position, live, from the fold (docs/gameplay/PLAN_BANK_MONEY.md, step 3). Its customers (every account of the State but the State's, its central bank's and
   * the bank's own) hold their money at it: their 512 is its sight deposits. Its reserves are what it holds at the central bank: its own cash (512, what it has paid and
   * received since the last centralisation), its reserves already centralised (5151), and what its customers' money grew by since then (their 512 less its 1651): a payment
   * between two customers moves no reserves, a loan to a customer neither, a payment out of the bank does.
   * @param {string} bankId @param {number} year
   * @returns {Promise<{ reserves: number, sightDeposits: number, savings: number, reserveBase: number, ownCash: number, centralisedReserves: number, centralisedDeposits: number,
   *   loans: number, main: number, marginal: number }>} centimes
   */
  async #positionOf(bankId, year) {
    const byAccount = (await this.deps.getLegsFold()).totalsByAccount({ hamletId: requireActiveHamletId(), untilYear: year });
    const net = (totals, account) => {
      const total = totals?.get(account);
      return total ? total.debit - total.credit : 0;
    };
    const bankKey = accountKeyOf({ accountBuildingId: bankId });
    const sightDeposits = customersMoneyOf(byAccount, bankKey);
    const bankTotals = byAccount.get(bankKey);
    const ownCash = net(bankTotals, DEPOSIT_ACCOUNT);
    const centralisedReserves = net(bankTotals, RESERVES_ACCOUNT);
    const centralisedDeposits = -net(bankTotals, SIGHT_DEPOSITS_ACCOUNT);
    const savings = -net(bankTotals, '165');
    return {
      reserves: ownCash + centralisedReserves + sightDeposits - centralisedDeposits,
      sightDeposits,
      savings,
      reserveBase: Math.max(0, sightDeposits) + Math.max(0, savings),
      ownCash,
      centralisedReserves,
      centralisedDeposits,
      // What the bank can pledge, and what it owes the central bank in each facility.
      loans: net(bankTotals, LOANS_ACCOUNT),
      main: -net(bankTotals, REFINANCING_ACCOUNT),
      marginal: -net(bankTotals, MARGINAL_ACCOUNT),
    };
  }

  /**
   * The écriture de centralisation of the bank, once a month, from balances (a second run writes nothing): its own cash is put on its reserves at the central bank (5151),
   * and its sight deposits (1651) are brought level with what its customers hold. The central bank's side follows: the reserves it holds for the bank (1673) are money it
   * issued (1678). Then the bank keeps its reserve: a bank under the reserve the ratio asks is refinanced by a working central bank of its State.
   * @param {{ time: number }} params
   */
  async centraliseBank({ time }) {
    const bankId = await this.deps.findBankBuildingId();
    if (!bankId) return;
    // The bank keeps its reserve: what it lacks, it is refinanced. First, so that the money it is lent is on its reserves with the rest when its books are centralised
    // (its live position already counts its cash not yet centralised): otherwise it would sit outside them, and read as money that came from abroad.
    await this.coverShortfall({ turn: time, bankId, reservesOut: 0, depositsAdded: 0, facility: 'main', partial: true });
    await this.centraliseBankBooks({ time, bankId, syncDeposits: true, keySuffix: 'month' });
  }

  /**
   * The bank's position, live, in centimes: its reserves and its customers' sight deposits (a liquidation pays them out of the reserves).
   * @param {string} bankId @param {number} turn
   * @returns {Promise<{ reserves: number, sightDeposits: number }>}
   */
  async liveReservesOf(bankId, turn) {
    const { reserves, sightDeposits } = await this.#positionOf(bankId, this.deps.getTimeInfo(turn).year);
    return { reserves, sightDeposits };
  }

  /**
   * The centralisation of the bank's books, from balances: its own cash onto its reserves at the central bank (5151), its sight deposits (1651) level with its customers'
   * money (unless `syncDeposits` is false: a bank being liquidated owes its customers nothing more once their deposits are paid out), and the reserves the central bank
   * holds for it (1673) level with what it holds there. Each line once per `keySuffix` and month.
   * @param {{ time: number, bankId: string, syncDeposits: boolean, keySuffix: string }} params
   */
  async centraliseBankBooks({ time, bankId, syncDeposits, keySuffix }) {
    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(time);
    const centralBankId = await this.deps.findCentralBankId();
    const position = await this.#positionOf(bankId, timeInfo.year);
    const stamp = `${timeInfo.year}:${timeInfo.monthIndex}:${keySuffix}`;
    const write = async (type, centimes, holder, description) => {
      if (centimes <= 0) return;
      await this.#record({ turn: time, type, amount: centimes / 100, description: `${description} - ${timeInfo.month} ${timeInfo.year}`, businessKey: `${type}:${hamletId}:${holder}:${stamp}`, accountBuildingId: holder, counterpartyBuildingId: holder === bankId ? centralBankId : bankId });
    };
    // The bank's own cash onto its reserves, and its deposits level with its customers' money.
    if (position.ownCash > 0) await write('od_bank_cash_to_reserves', position.ownCash, bankId, 'Trésorerie de la banque portée à ses réserves');
    else await write('od_bank_reserves_to_cash', -position.ownCash, bankId, 'Paiements de la banque pris sur ses réserves');
    let reserves = position.ownCash + position.centralisedReserves;
    if (syncDeposits) {
      const depositsMove = position.sightDeposits - position.centralisedDeposits;
      if (depositsMove > 0) await write('od_deposits_up', depositsMove, bankId, 'Dépôts reçus de l’extérieur par ses clients');
      else await write('od_deposits_down', -depositsMove, bankId, 'Dépôts payés à l’extérieur par ses clients');
      reserves = position.reserves;
    }
    // The central bank holds as much in reserves for the bank as the bank holds at it.
    const centralTotals = (await this.deps.getLegsFold()).totalsOf({ hamletId, accountKey: accountKeyOf({ accountBuildingId: centralBankId }) });
    const held = centralTotals.get(RESERVES_HELD_ACCOUNT);
    const reservesMove = reserves - (held ? held.credit - held.debit : 0);
    if (reservesMove > 0) await write('od_reserves_held_up', reservesMove, centralBankId, 'Réserves de la banque');
    else await write('od_reserves_held_down', -reservesMove, centralBankId, 'Réserves de la banque');
  }

  /** @param {string} bankId @param {number} year @returns {Promise<(account: string) => number>} an account's credit balance on the bank's books up to `year`, in centimes */
  async #creditBalancesOf(bankId, year) {
    const totals = (await this.deps.getLegsFold()).totalsByAccount({ hamletId: requireActiveHamletId(), untilYear: year }).get(accountKeyOf({ accountBuildingId: bankId }));
    return (account) => {
      const total = totals?.get(account);
      return total ? total.credit - total.debit : 0;
    };
  }

  /** @param {{ time: number }} params the turn the lines are dated by */
  async settleMonth({ time }) {
    await this.#payGuaranteePremium(time);
    await this.#settleRefinancing(time);
    await this.#payProfitToCity(time);
    await this.centraliseTreasury({ time });
    await this.centraliseBank({ time });
    await this.centraliseExternal({ time });
  }

  /**
   * The money of the State's economy that came from abroad or went there, centralised once a month from balances (docs/gameplay/PLAN_BANK_MONEY.md, step 4), last, once
   * the Treasury's account and the bank's books are: the central bank's money in the public's hands (1678) is what its customers hold in banknotes, all their money
   * when the State has no bank (it is held in banknotes until a bank opens), nothing when it has one (their money is then deposits, backed by the bank's reserves).
   * What differs is money that came from abroad (an export sold) or went there (an import, an upkeep paid outside the game): the central bank converted it, against its
   * foreign reserves (2761).
   * @param {{ time: number }} params
   */
  async centraliseExternal({ time }) {
    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(time);
    const centralBankId = await this.deps.findCentralBankId();
    const bankId = await this.deps.findBankBuildingId();
    const byAccount = (await this.deps.getLegsFold()).totalsByAccount({ hamletId, untilYear: timeInfo.year });
    const banknotes = bankId ? 0 : customersMoneyOf(byAccount, null);
    const issued = byAccount.get(accountKeyOf({ accountBuildingId: centralBankId }))?.get(ISSUED_MONEY_ACCOUNT);
    const gap = banknotes - (issued ? issued.credit - issued.debit : 0);
    if (gap === 0) return;
    const type = gap > 0 ? 'od_foreign_reserves_in' : 'od_foreign_reserves_out';
    await this.#record({
      turn: time,
      type,
      amount: Math.abs(gap) / 100,
      description: `${gap > 0 ? 'Argent venu de l’étranger' : 'Argent payé à l’étranger'} - ${timeInfo.month} ${timeInfo.year}`,
      businessKey: `${type}:${hamletId}:${timeInfo.year}:${timeInfo.monthIndex}`,
      accountBuildingId: centralBankId,
      counterpartyBuildingId: null,
    });
  }

  /**
   * The écriture de centralisation of the Treasury's account: the account the central bank holds for its State (1674) is brought level with the State's money (its
   * cash accounts), from balances, so a second run writes nothing and a purge loses nothing. What the State holds that came from its founding endowment (its 1021) was
   * created by the central bank once (2768); the rest it received from the public is money that came back (1678 debited), and what it paid out is money issued (1678
   * credited). The profit the central bank pays its State is already on both (it credits the Treasury's account itself). Between two runs, the two differ by the
   * month's movements: they agree at each month's close.
   * @param {{ time: number }} params
   */
  async centraliseTreasury({ time }) {
    const hamletId = requireActiveHamletId();
    const centralBankId = await this.deps.findCentralBankId();
    const timeInfo = this.deps.getTimeInfo(time);
    const fold = await this.deps.getLegsFold();
    const stateScope = { hamletId, accountKey: null };
    // The State's money now, and what of it came from its founding endowment (the flows against 1021, every year).
    const stateCash = [...CASH_ACCOUNTS].reduce((sum, account) => sum + fold.balanceOf(account, stateScope), 0);
    const endowed = fold.yearsOf(stateScope).reduce((sum, year) => {
      const flow = fold.cashFlowsOf({ ...stateScope, year }).get(FOUNDING_ACCOUNT);
      return sum + (flow ? flow.in - flow.out : 0);
    }, 0);
    // What the central bank's books already say: the Treasury's account (a credit balance) and the endowment it created (a debit balance).
    const bankTotals = fold.totalsOf({ hamletId, accountKey: accountKeyOf({ accountBuildingId: centralBankId }) });
    const balance = (account) => {
      const total = bankTotals.get(account);
      return total ? total.debit - total.credit : 0;
    };
    const founding = endowed - balance(ENDOWMENT_ACCOUNT);
    // What the central bank holds for the Treasury (its debt: a credit balance), and what the State gained or lost with the public since the last centralisation.
    const treasuryHeld = -balance(TREASURY_ACCOUNT_AT_BANK);
    const fromPublic = stateCash - treasuryHeld - founding;
    if (founding < 0) throw new Error(`[central-bank] the State's founding endowment fell (${founding / 100} €): an endowment is created once and never given back`);

    const stamp = `${timeInfo.year}:${timeInfo.monthIndex}`;
    const write = async (type, centimes, description) => {
      if (centimes === 0) return;
      await this.#record({ turn: time, type, amount: centimes / 100, description: `${description} - ${timeInfo.month} ${timeInfo.year}`, businessKey: `${type}:${hamletId}:${stamp}`, accountBuildingId: centralBankId, counterpartyBuildingId: null });
    };
    await write('od_treasury_founding', founding, 'Monnaie créée pour la fondation de l’État');
    if (fromPublic > 0) await write('od_treasury_inflow', fromPublic, 'Encaissements du Trésor dans le mois');
    else await write('od_treasury_outflow', -fromPublic, 'Paiements du Trésor dans le mois');
  }

  /**
   * Every January, the central bank pays its State what it earned and has not paid yet (its accumulated result, less what it already paid). It credits the Treasury's
   * account it holds: it has no money of its own, so nothing caps it but its result.
   * @param {number} time
   */
  async #payProfitToCity(time) {
    const timeInfo = this.deps.getTimeInfo(time);
    if (timeInfo.monthIndex !== 0 || timeInfo.year === 0) return;
    const centralBankId = await this.deps.findCentralBankId();
    const hamletId = requireActiveHamletId();
    const totalsUntil = async (year) =>
      (await this.deps.getLegsFold()).totalsByAccount({ hamletId, untilYear: year }).get(accountKeyOf({ accountBuildingId: centralBankId })) ?? new Map();
    // The result of the years closed (products less charges, and what a purge carried on 12), and what was already distributed (457), in centimes.
    let result = 0;
    for (const [account, total] of await totalsUntil(timeInfo.year - 1)) {
      if (account[0] === '7' || account === '12') result += total.credit - total.debit;
      else if (account[0] === '6') result -= total.debit - total.credit;
    }
    const paidOut = (await totalsUntil(timeInfo.year)).get('457');
    const distributed = paidOut ? paidOut.debit - paidOut.credit : 0;
    const profit = result - distributed;
    if (profit <= 0) return;

    const common = {
      turn: time,
      transactionId: `central_bank_profit:${centralBankId}:${timeInfo.year - 1}`,
      amount: profit / 100,
      description: `Résultat de la banque centrale reversé à l’État - année ${timeInfo.year - 1}`,
    };
    await this.#record({ ...common, type: 'od_central_bank_profit_paid', businessKey: `od_central_bank_profit_paid:${hamletId}:${centralBankId}:${timeInfo.year - 1}`, accountBuildingId: centralBankId, counterpartyBuildingId: null });
    await this.#record({ ...common, type: 'central_bank_profit_received', businessKey: `central_bank_profit_received:${hamletId}:${centralBankId}:${timeInfo.year - 1}`, accountBuildingId: null, counterpartyBuildingId: centralBankId });
  }

  /**
   * The deposit guarantee is funded by the banks: each month the bank pays the city a premium, a yearly share of the savings it holds (BankCatalog.js), a charge for the
   * bank and a product of the State. Once a month (business key).
   * @param {number} time
   */
  async #payGuaranteePremium(time) {
    const bankId = await this.deps.findBankBuildingId();
    if (!bankId) return;
    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(time);
    const { savings } = await this.#positionOf(bankId, timeInfo.year);
    const premium = Math.round((Math.max(0, savings) * DEPOSIT_GUARANTEE_PREMIUM_RATE) / MONTHS_PER_YEAR);
    if (premium <= 0) return;
    const common = {
      turn: time,
      transactionId: `deposit_guarantee_premium:${bankId}:${timeInfo.year}:${timeInfo.monthIndex}`,
      amount: premium / 100,
      description: `Prime de la garantie des dépôts - ${timeInfo.month} ${timeInfo.year}`,
    };
    const keyOf = (type) => `${type}:${hamletId}:${bankId}:${timeInfo.year}:${timeInfo.monthIndex}`;
    // The State is paid first, as it is everywhere a flow touches its Treasury: it receives, so nothing can refuse the pair.
    await this.#record({ ...common, type: 'deposit_guarantee_premium', businessKey: keyOf('deposit_guarantee_premium'), accountBuildingId: bankId, counterpartyBuildingId: null });
    await this.#record({ ...common, type: 'deposit_guarantee_premium_received', businessKey: keyOf('deposit_guarantee_premium_received'), accountBuildingId: null, counterpartyBuildingId: bankId });
  }

  /** @param {number} time */
  async #settleRefinancing(time) {
    const bankId = await this.deps.findBankBuildingId();
    if (!bankId) return;
    const hamletId = requireActiveHamletId();
    const timeInfo = this.deps.getTimeInfo(time);
    // The counterpart of the debt: the State's central bank, which exists from the founding whether its building stands or not.
    const centralBankId = await this.deps.findCentralBankId();
    const { rate, reserveRatio } = await this.deps.getPolicyRateStatus();
    const rates = corridorOf(rate);
    // The bank pays and repays out of its reserves at the central bank, keeping the reserve its deposits (sight and savings) ask.
    const position = await this.#positionOf(bankId, timeInfo.year);
    const stamp = `${timeInfo.month} ${timeInfo.year}`;
    const pair = async (facility, bankType, centralType, centimes, label) => {
      if (centimes <= 0) return;
      const keyOf = (type) => `${type}:${hamletId}:${bankId}:${facility}:${timeInfo.year}:${timeInfo.monthIndex}`;
      const transactionId = `refinancing:${bankId}:${facility}:${bankType}:${timeInfo.year}:${timeInfo.monthIndex}`;
      const common = { turn: time, transactionId, amount: centimes / 100, description: `${label} - ${stamp}` };
      await this.#record({ ...common, type: bankType, businessKey: keyOf(bankType), accountBuildingId: bankId, counterpartyBuildingId: centralBankId });
      await this.#record({ ...common, type: centralType, businessKey: keyOf(centralType), accountBuildingId: centralBankId, counterpartyBuildingId: bankId });
    };

    if (position.main > 0 || position.marginal > 0) {
      const month = refinancingMonthOf({
        main: position.main,
        marginal: position.marginal,
        rates,
        reserves: position.reserves,
        deposits: position.reserveBase,
        reserveRatio,
        monthsPerYear: MONTHS_PER_YEAR,
      });
      await pair('marginal', 'refinancing_interest_paid', 'od_refinancing_interest_received', month.marginal.interestPaid, 'Intérêts du prêt marginal de la banque');
      await pair('marginal', 'od_marginal_interest_capitalised', 'od_refinancing_interest_accrued', month.marginal.interestCapitalised, 'Intérêts du prêt marginal ajoutés à la dette');
      await pair('marginal', 'marginal_repaid', 'od_refinancing_retired', month.marginal.repayment, 'Prêt marginal remboursé à la banque centrale');
      await pair('main', 'refinancing_interest_paid', 'od_refinancing_interest_received', month.main.interestPaid, 'Intérêts du refinancement de la banque');
      await pair('main', 'od_refinancing_interest_capitalised', 'od_refinancing_interest_accrued', month.main.interestCapitalised, 'Intérêts du refinancement ajoutés à la dette');
      await pair('main', 'refinancing_repaid', 'od_refinancing_retired', month.main.repayment, 'Refinancement remboursé à la banque centrale');
    }

    // The deposit facility: the reserves above the reserve due earn the lower rate of the corridor, paid by the central bank (it creates the reserves it credits).
    const after = await this.#positionOf(bankId, timeInfo.year);
    const earned = reservesInterestOf({
      reserves: after.reserves,
      requiredReserve: requiredReserveOf({ deposits: after.reserveBase, reserveRatio }),
      depositRate: rates.deposit,
      monthsPerYear: MONTHS_PER_YEAR,
    });
    await pair('deposit', 'od_reserves_interest_received', 'od_reserves_interest_paid', earned, 'Intérêts de la facilité de dépôt sur les réserves de la banque');
  }

  /** A line already written (the month settled twice) is not a defect; any other refusal is. */
  async #record(line) {
    const result = await this.deps.recordLedgerEntry(line);
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[refinancing] the ${line.type} line "${line.description}" was not recorded: ${result.reason}`);
    }
  }
}
