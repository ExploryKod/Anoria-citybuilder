import { PAYABLE_KINDS } from '../../domain/catalogs/PayableCatalog.js';
import { PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { LIQUIDATED_MARKER, companiesToLiquidate, liquidatedIdsOf, openDebtsOf, stockRecoveryOf } from '../../domain/policies/LiquidationPolicy.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Application service — the liquidation of the companies that cannot pay (see LiquidationPolicy and docs/gameplay/PLAN_BANKRUPTCY_PAYABLES.md).
 *
 * It acts twice in the month's settlement:
 *  - `begin`, before the companies' charges are settled: a company that went the whole grace period with a debt open is liquidated. The day is marked in the
 *    journal (`info_company_liquidated`) and its stock is sold to the market at the recovery rate, so that the money is there to pay its creditors by rank, like
 *    any money it holds. From the marker on, the company is closed: SettleProducerCharges charges it nothing new and only pays its old debts;
 *  - `end`, once the charges are settled: what a liquidated company still owes and nothing can pay is forgiven at the company (an abandon de créance), written
 *    off at the creditor (a loss on an irrecoverable claim), except the workers' wages, which the city guarantees: it pays the households what they were owed.
 *
 * Every line is written once: the business key refuses a second one.
 */
export class LiquidateCompanies {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ id: string, type: string }>>} deps.listCompanies the companies of the active hamlet
   * @param {() => Promise<Array<object>>} deps.getJournalEntries
   * @param {(buildingId: string, period: { year: number, monthIndex: number }) => Promise<Array<{ value: number }>>} deps.valueStock what the company holds in stock, valued at cost
   * @param {() => Promise<{ id: string, businessAccount: string } | null>} deps.getOwner the owner of the premises (the rent debts are owed to it); null when none stands
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {{ time: number, deliveredTime: number }} params
   * @returns {Promise<string[]>} the companies liquidated by this call
   */
  async begin({ time, deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const hamletId = requireActiveHamletId();
    const companies = await this.deps.listCompanies();
    const entries = await this.deps.getJournalEntries();
    const due = companiesToLiquidate({ entries, companyIds: companies.map((company) => company.id), until: { year: timeInfo.year, month: timeInfo.monthIndex + 1 }, monthsPerYear: MONTHS_PER_YEAR });
    for (const id of due) {
      const company = companies.find((candidate) => candidate.id === id);
      const name = this.#nameOf(company);
      const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
      await this.#record({
        turn: time,
        type: LIQUIDATED_MARKER,
        amount: 0,
        description: `[Informatif] ${name} liquidée : impayés depuis trop longtemps - ${monthLabel}`,
        businessKey: `${LIQUIDATED_MARKER}:${hamletId}:${id}`,
        buildingInstanceId: id,
        accountBuildingId: id,
        accountKind: null,
      });
      const stock = (await this.deps.valueStock(id, timeInfo)).reduce((sum, item) => sum + item.value, 0);
      const recovered = stockRecoveryOf(stock);
      if (recovered > 0) {
        await this.#record({
          turn: time,
          type: 'liquidation_stock_sale',
          amount: recovered / 100,
          description: `Stock de ${name} vendu à la liquidation - ${monthLabel}`,
          businessKey: `liquidation_stock_sale:${hamletId}:${id}`,
          buildingInstanceId: id,
          accountBuildingId: id,
          accountKind: null,
          counterpartyBuildingId: null,
          transactionId: null,
        });
      }
    }
    return due;
  }

  /**
   * @param {{ time: number, deliveredTime: number }} params
   * @returns {Promise<void>}
   */
  async end({ time, deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const hamletId = requireActiveHamletId();
    const entries = await this.deps.getJournalEntries();
    const companies = await this.deps.listCompanies();
    const owner = await this.deps.getOwner();
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    for (const id of liquidatedIdsOf(entries)) {
      const company = companies.find((candidate) => candidate.id === id);
      // A liquidated company that was demolished since leaves no debt to follow (its lines stay in the journal).
      if (!company) continue;
      const name = this.#nameOf(company);
      for (const debt of openDebtsOf(entries, id)) {
        const facts = PAYABLE_KINDS[debt.kind];
        const creditorKey = debt.creditorId ?? 'city';
        const amount = debt.centimes / 100;
        await this.#record({
          turn: time,
          type: facts.forgiven,
          amount,
          description: `[OD] ${facts.label} dus par ${name}, abandonnés à la liquidation - ${monthLabel}`,
          businessKey: `${facts.forgiven}:${hamletId}:${id}:${creditorKey}:${timeInfo.year}:${timeInfo.monthIndex}`,
          buildingInstanceId: id,
          accountBuildingId: id,
          accountKind: null,
          counterpartyBuildingId: debt.creditorId,
        });
        if (debt.kind === 'wage') {
          // The workers' house is paid by the city: the guarantee of the wages, one flow between the two accounts.
          const flow = `${timeInfo.year}:${timeInfo.monthIndex}:wage_guarantee:${id}:${debt.creditorId}`;
          await this.#record({
            turn: time,
            type: 'wage_guarantee_paid',
            amount,
            description: `Garantie des salaires de ${name} - ${monthLabel}`,
            businessKey: `wage_guarantee_paid:${hamletId}:${id}:${debt.creditorId}:${timeInfo.year}:${timeInfo.monthIndex}`,
            buildingInstanceId: debt.creditorId,
            accountBuildingId: null,
            accountKind: null,
            counterpartyBuildingId: debt.creditorId,
            transactionId: flow,
          });
          await this.#record({
            turn: time,
            type: 'household_wage',
            amount,
            description: `Salaires de ${name} payés par la garantie de la ville - ${monthLabel}`,
            businessKey: `household_wage:${hamletId}:${id}:${debt.creditorId}:guarantee:${timeInfo.year}:${timeInfo.monthIndex}`,
            buildingInstanceId: debt.creditorId,
            accountBuildingId: debt.creditorId,
            accountKind: PERSONAL_ACCOUNT,
            counterpartyBuildingId: null,
            transactionId: flow,
          });
          continue;
        }
        const ownerOfClaim = debt.kind === 'premises_rent';
        // An owner that no longer stands has no books to write the claim off in: the debt is only released at the company.
        if (ownerOfClaim && owner?.id !== debt.creditorId) continue;
        await this.#record({
          turn: time,
          type: facts.badDebt,
          amount,
          description: `[OD] ${facts.label} de ${name}, irrécouvrables - ${monthLabel}`,
          businessKey: `${facts.badDebt}:${hamletId}:${id}:${timeInfo.year}:${timeInfo.monthIndex}`,
          buildingInstanceId: id,
          accountBuildingId: ownerOfClaim ? owner.id : null,
          accountKind: ownerOfClaim ? owner.businessAccount : null,
          counterpartyBuildingId: id,
        });
      }
    }
  }

  #nameOf(company) {
    const name = getBuildingDefinition(company.type)?.displayName;
    if (!name) throw new Error(`[liquidation] building ${company.id} has no catalog name for its journal lines`);
    return name;
  }

  async #record(params) {
    const result = await this.deps.recordLedgerEntry(params);
    if (!result.recorded && result.reason !== 'duplicate_business_key') throw new Error(`[liquidation] the ${params.type} line "${params.description}" was not recorded: ${result.reason}`);
  }
}
