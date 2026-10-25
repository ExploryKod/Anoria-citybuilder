import { buildProducerLineBusinessKey, buildServiceLineBusinessKey, buildTradeLineBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import {
  buildingChargeLines,
  corporateTaxDueOf,
  corporateTaxLines,
  isLucrativeBuilding,
  employerContributionLines,
  serviceSaleLines,
  serviceSubsidyLines,
  tradeLines,
  wageSplitLines,
  payrollOf,
  withholdIncomeTax,
} from '../../domain/policies/ProducerChargePolicy.js';
import { PERSONAL_ACCOUNT, businessAccountOf } from '../../domain/policies/AccountKeyPolicy.js';
import { payablesOf, planCompanyPayments } from '../../domain/policies/DebtPolicy.js';
import { PAYABLE_KINDS } from '../../domain/catalogs/PayableCatalog.js';
import { houseEnterpriseOf, houseEnterprises, houseHoldsSkill } from '../../../../shared/population/workforceQueries.js';
import { OWNER_SKILL } from '../../../../shared/population/socialCategoryCatalog.js';
import { allocateEnterpriseResult, enterpriseLines } from '../../domain/policies/EnterpriseAllocationPolicy.js';
import { legalFormOf } from '../../../../shared/accounting-catalog/LegalFormCatalog.js';
import { LINE_LABELS, recordDebtPayment, recordLine } from './DebtLines.js';
import { serviceSubsidyShare } from '../../domain/policies/ServiceSubsidyPolicy.js';
import { addVatTo } from '../../domain/policies/VatIncludedPolicy.js';
import { payableServiceBills } from '../../domain/policies/ServiceSolvencyPolicy.js';
import { householdPublicPayOf } from '../../domain/policies/HouseholdPublicPayPolicy.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { payslipLegs, planWithholding } from '../../domain/policies/WithholdingPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getResourceCategoryPresentation } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

/** What a company owes the city when it cannot pay: the receivable the city books on its own account (an opération diverse), by kind of debt. */
const CITY_RECEIVABLES = Object.freeze({ corporate_tax: 'od_receivable_corporate_tax', contribution: 'od_receivable_contribution' });

const centimes = (amount) => Math.round(amount * 100) / 100;
/** @param {number} euros @returns {number} whole centimes */
const toCentimes = (euros) => Math.round(euros * 100);

/**
 * Application service — settles one delivered month of the active hamlet's chain, on the first day of the month after it.
 *
 * Goods between two companies are written on both accounts with their counterparty. A good sold to a house is paid when it
 * is delivered (RecordConsumerPurchases), not here. A service is a bill for the month's use, paid from the house's money on
 * this same day: its money is what the house had, plus the salary of that month, less the bills already paid. The first
 * bill a house cannot pay cuts off its other services for the month, and the unpaid bill is written as a cut-off (no sale,
 * no subsidy). Then each company's own lines (wages, upkeep, corporate tax) are written. Every line is written once per
 * month: the business key refuses a second charge. The city's lines hold no account.
 */
export class SettleProducerCharges {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {() => Promise<Array<{ id: string, type: string, workerSources: Record<string, number> }>>} deps.listBuildings the hamlet's buildings, with the houses their workers come from
   * @param {(year: number, monthIndex: number) => Promise<Array<{ sellerId: string, buyerId: string | null, amountHT: number }>>} deps.sumGoodsFlowsByPair
   * @param {(year: number, monthIndex: number) => Promise<Array<{ buildingId: string, houseId: string, service: string, units: number }>>} deps.sumServiceFlows the services each company sold to each house in the month
   * @param {() => Promise<Record<string, number>>} deps.getServiceSubsidies percent per service, of the active hamlet
   * @param {(sale: { service: string, building: { id: string, type: string }, period: { year: number, monthIndex: number } }) => Promise<number> | number} deps.getServicePrice
   *   the price (HT) of one unit the building sold in the month, before the subsidy and the VAT
   * @param {() => Promise<Record<string, number>>} deps.getVatRates the hamlet's VAT rate per service, in percent
   * @param {(year: number, monthIndex: number) => Promise<Array<{ sellerId: string, amountHT: number }>>} deps.sumHouseSales the goods a company sold to the houses in the month, from the journal (HT)
   * @param {(year: number, monthIndex: number) => Promise<Array<{ buildingId: string, amountHT: number }>>} deps.sumBankInterestByBuilding the interest a bank earned on its loans in the month, read straight from the
   *   journal's `loan_interest_received` lines (no supply-chain trace exists for a loan) — this is what lets a
   *   bank fund its own wages/upkeep/corporate tax from what it actually earns, the same way goods and service
   *   sales do for every other lucrative building
   * @param {() => Promise<{ threshold1: number, rate1: number, threshold2: number, rate2: number }>} deps.getSalaryTax the progressive income tax bands: see withholdIncomeTax
   *   (all nil when nobody holds the collection of the income tax)
   * @param {(year: number, monthIndex: number) => Promise<Array<{ buildingId: string, units: number, lostRevenue: number }>>} deps.listSpoilage what each building lost to
   *   spoilage in the month, and what it would have sold for
   * @param {() => Promise<number>} deps.getHouseMaintenanceSubsidyRate the share of a house's upkeep the hamlet pays, a fraction (the household pays the rest)
   * @param {() => Promise<number>} deps.getCorporateTaxRate the corporate tax rate in force, a fraction: the player's, or 0 while nobody holds its collection
   * @param {() => Promise<Array<{ id: string, pop: number }>>} deps.listHouses the hamlet's households and their residents who look for a job (the
   *   ones the unemployment benefit counts: the administrators do not look for one)
   * @param {() => Promise<{ benefitBase: number, unemploymentBenefitRate: number, employerContributionRate: number, employeeContributionRate: number, administratorStipend: number }>} deps.getPublicPay
   *   the benefit base (the lowest wage the city pays), the benefit rate (a fraction of it), the two social contribution rates (fractions of the gross wage)
   *   and the monthly stipend of one administrator (the player's setting)
   * @param {() => Promise<(skill: string, level: number) => number>} deps.getWageRateOf the monthly gross wage the labour market gives a skill at a level
   *   (never under the minimum wage), as it stands for the month being settled
   * @param {(houseId: string) => Promise<number>} deps.fundsOf what a house has in its personal account before this settlement
   * @param {(houseId: string, businessAccount: string) => Promise<number>} deps.businessFundsOf what one enterprise of a house holds in its business account: only that can be shared out
   * @param {(buildingId: string) => Promise<number>} deps.companyFundsOf what a company holds in its own account now, the month's sales and subsidies included
   * @param {() => Promise<Array<object>>} deps.getJournalEntries the journal lines (the debts the companies carry are derived from them)
   * @param {(cutOff: { turn: number, year: number, monthIndex: number, houseId: string, service: string }) => Promise<void>} deps.recordServiceCutOff
   * @param {(houseId: string, year: number) => Promise<{ incomeYearToDate: number, taxWithheldYearToDate: number }>} deps.readHouseholdYear what a household took in over a
   *   year (wages net of the employee's contribution, benefit, stipend, and what its enterprises paid it) and the income tax already withheld, off its personal account
   * @param {(buildingId: string, year: number, accountKind?: string | null) => Promise<{ rcaiYearToDate: number, taxPaidYearToDate: number }>} deps.readCompanyYear an account's
   *   résultat courant avant impôts and the corporate tax booked so far in a year, read off its compte de résultat (the one the player reads): a company's account, or a
   *   house's business account (`accountKind`)
   * @param {(type: string) => number} deps.buildingMaintenanceCost
   * @param {(params: object) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   * @param {(movement: object) => Promise<void>} deps.recordEconomyMovement the economy register
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {object} params
   * @param {number} params.time the turn the lines are dated by: the first turn after the delivered month
   * @param {number} params.deliveredTime a turn of the delivered month
   */
  async execute({ time, deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const settledAt = this.deps.getTimeInfo(time);
    const hamletId = requireActiveHamletId();
    const listed = await this.deps.listBuildings();
    // A building that no longer stands (the player demolished it, a disaster took it) has no account left to book on: what it sold, bought or served during
    // the month is not settled — the goods it traded with another company are written on neither side, the services it supplied or received are not billed,
    // and the workers a company drew from a house that is gone are not paid (the employment is redistributed each day, but a disaster can strike after it).
    // The rest of the month, and the other party's own charges, are settled as usual; the movements stay in the supply traceability.
    const standing = new Set(listed.map((building) => building.id));
    const buildings = listed.map((building) => ({
      ...building,
      workerSources: Object.fromEntries(Object.entries(building.workerSources ?? {}).filter(([houseId]) => standing.has(houseId))),
    }));
    const pairs = (await this.deps.sumGoodsFlowsByPair(timeInfo.year, timeInfo.monthIndex))
      .filter((pair) => standing.has(pair.sellerId) && (pair.buyerId === null || standing.has(pair.buyerId)));
    const serviceFlows = (await this.deps.sumServiceFlows(timeInfo.year, timeInfo.monthIndex))
      .filter((flow) => standing.has(flow.buildingId) && standing.has(flow.houseId));
    const subsidies = await this.deps.getServiceSubsidies();
    const ratesPercent = await this.deps.getVatRates();
    const monthLabel = `${timeInfo.month} ${timeInfo.year}`;
    const nameOf = (buildingId) => {
      const building = buildings.find((candidate) => candidate.id === buildingId);
      const name = building && getBuildingDefinition(building.type)?.displayName;
      if (!name) throw new Error(`[producer] building ${buildingId} has no catalog name for its journal lines`);
      return name;
    };

    // One bill per (company, house, service) delivered. The catalog's price is HT: the city's subsidy is taken off it (a
    // subsidy cannot be taken on a tax), and the VAT is charged on what the house pays. The house pays that TTC, the company
    // sells the HT, and the city receives the VAT.
    const bills = [];
    for (const flow of serviceFlows) {
      if (flow.units === 0) continue;
      const seller = buildings.find((candidate) => candidate.id === flow.buildingId);
      if (!seller) throw new Error(`[producer] building ${flow.buildingId} sold a service but is not in the hamlet: its price cannot be read`);
      const share = serviceSubsidyShare({
        units: flow.units,
        // The price the building sold it at in the month delivered: its cost plus its margin for a plant or a tank, the base value for the others.
        unitPrice: await this.deps.getServicePrice({ service: flow.service, building: seller, period: timeInfo }),
        subsidyPercent: subsidies[flow.service],
      });
      const price = addVatTo({ ht: share.habitantShare, ratePercent: ratesPercent[flow.service] });
      bills.push({ ...flow, amount: price.ttc, ttc: price.ttc, ht: price.ht, vat: price.vat, citySubsidy: share.citySubsidy });
    }
    const fundsByHouse = new Map();
    for (const bill of bills) {
      if (!fundsByHouse.has(bill.houseId)) fundsByHouse.set(bill.houseId, await this.deps.fundsOf(bill.houseId));
    }

    const houseSales = await this.deps.sumHouseSales(timeInfo.year, timeInfo.monthIndex);
    const bankInterest = await this.deps.sumBankInterestByBuilding(timeInfo.year, timeInfo.monthIndex);
    const taxRate = await this.deps.getSalaryTax();
    const corporateTaxRate = await this.deps.getCorporateTaxRate();
    const houseSubsidyRate = await this.deps.getHouseMaintenanceSubsidyRate();

    // The city's pay to the households: the unemployed's benefit, from the residents of each. Civil servants
    // were removed (2026-10-10, "suppress it for now") — a resident is either a worker or unemployed, the
    // city no longer directly employs a fixed share of the population.
    const publicPay = await this.deps.getPublicPay();
    for (const field of ['benefitBase', 'unemploymentBenefitRate', 'employerContributionRate', 'employeeContributionRate', 'administratorStipend']) {
      if (!Number.isFinite(publicPay[field])) throw new Error(`[producer] the hamlet's ${field} is not a number (${publicPay[field]}): the month cannot be settled`);
    }
    const households = await this.deps.listHouses();
    // A house that sells its own output (an artisan's, a savant's, a merchant's little business — see
    // buildingEconomy.js's activityRecipe) is still a house, never a company: the money moves on its business
    // account of its enterprise that makes and sells goods (businessAccountOf), not the bare company-style key a lucrative building's holder gets.
    const houseIds = new Set(households.map((household) => household.id));
    const typeOfBuilding = new Map(buildings.map((building) => [building.id, building.type]));
    // The owner of the houses: the house whose category holds the owner skill (the mayor's), standing whether or not people live in it yet. Its
    // property company bears the upkeep of every house, its own included. None stands once it is demolished: the hamlet then bears it (see buildingChargeLines).
    const ownerHouse = buildings.find((building) => houseIds.has(building.id) && houseHoldsSkill(building.type, 1, OWNER_SKILL));
    const owner = ownerHouse
      ? {
        id: ownerHouse.id,
        businessAccount: businessAccountOf(houseEnterpriseOf(ownerHouse.type, 'rental').id),
        rentMargin: legalFormOf(houseEnterpriseOf(ownerHouse.type, 'rental').id).regime.rentMargin,
      }
      : null;
    const workersIn = (houseId) => buildings.reduce((sum, building) => sum + (building.workerSources?.[houseId] ?? 0), 0);
    const benefitByHouse = new Map();
    const unemployedCountByHouse = new Map();
    for (const household of households) {
      const pay = householdPublicPayOf({
        pop: household.pop,
        workers: workersIn(household.id),
        benefitBase: publicPay.benefitBase,
        unemploymentBenefitRate: publicPay.unemploymentBenefitRate,
      });
      unemployedCountByHouse.set(household.id, pay.unemployed);
      if (pay.benefit > 0) benefitByHouse.set(household.id, pay.benefit);
    }

    // The administrators do not look for a job and have no workplace: the city pays them the stipend the player sets
    // (`administratorStipend`, apart from the minimum wage) per administrator and month. A direct charge on the city's funds; without
    // enough of it their house cannot pay its needs, its services are cut off and its tiers (so its skills) stay out of reach.
    const stipendByHouse = new Map();
    for (const household of households) {
      if (!Number.isInteger(household.salaried) || household.salaried < 0) {
        throw new Error(`[producer] house ${household.id} has no count of salaried residents (${household.salaried}): the month cannot be settled`);
      }
      const stipend = centimes(household.salaried * publicPay.administratorStipend);
      if (stipend <= 0) continue;
      stipendByHouse.set(household.id, stipend);
    }
    // What the city pays a house is taxed and spent like a wage: the benefit and the stipend together.
    const publicPayByHouse = new Map(benefitByHouse);
    for (const [houseId, stipend] of stipendByHouse) {
      publicPayByHouse.set(houseId, centimes((publicPayByHouse.get(houseId) ?? 0) + stipend));
    }

    const { payable, wagesByBuilding } = this.#planMonth({ bills, pairs, houseSales, bankInterest, buildings, fundsByHouse, taxRate, benefitByHouse: publicPayByHouse, wageRateOf: await this.deps.getWageRateOf(), employeeRate: publicPay.employeeContributionRate });

    // The withholding at source: each pay of a household (its wages from every workplace, the city's benefit and stipend) keeps back its share of the employee's
    // contribution and of the income tax, which is the household's: progressive over all it receives in the month.
    const slots = [];
    for (const building of buildings) {
      const { wagesHT } = wagesByBuilding.get(building.id);
      for (const line of wageSplitLines({ workplaceId: building.id, wagesHT, sources: building.workerSources ?? {} })) {
        if (line.kind === 'household_wage') slots.push({ key: `wage|${building.id}|${line.holder}`, houseId: line.holder, kind: 'wage', gross: toCentimes(line.amount) });
      }
    }
    for (const [houseId, benefit] of benefitByHouse) slots.push({ key: `benefit|${houseId}`, houseId, kind: 'public', gross: toCentimes(benefit) });
    for (const [houseId, stipend] of stipendByHouse) slots.push({ key: `stipend|${houseId}`, houseId, kind: 'public', gross: toCentimes(stipend) });
    const withholding = planWithholding({ slots, employeeRate: publicPay.employeeContributionRate, taxRate });

    // What the city pays the households: the benefit of the unemployed and the stipend of the administrators. The city withholds the tax itself.
    for (const household of households) {
      const benefit = benefitByHouse.get(household.id);
      if (benefit > 0) {
        await this.#record(
          { kind: 'unemployment_benefit', amount: benefit, holder: null, counterparty: household.id, accountKind: null, flow: `benefit:${household.id}` },
          {
            time,
            key: buildProducerLineBusinessKey('unemployment_benefit', household.id, timeInfo, hamletId),
            description: `${LINE_LABELS.unemployment_benefit} : ${unemployedCountByHouse.get(household.id)} chôm. pour ${nameOf(household.id)} - ${monthLabel}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
        await this.#recordPayslip({
          kind: 'household_benefit', houseId: household.id, gross: toCentimes(benefit), withheld: withholding.get(`benefit|${household.id}`), payerId: null, flow: `benefit:${household.id}`,
          key: `${household.id}:benefit`, description: `${LINE_LABELS.household_benefit} - ${monthLabel}`, time, timeInfo, hamletId, monthLabel, nameOf,
        });
      }
      const stipend = stipendByHouse.get(household.id);
      if (stipend > 0) {
        await this.#record(
          { kind: 'salary', amount: stipend, holder: null, counterparty: household.id, accountKind: null, flow: `stipend:${household.id}` },
          {
            time,
            key: buildProducerLineBusinessKey('salary', household.id, timeInfo, hamletId),
            description: `${LINE_LABELS.salary} : ${household.salaried} administrateur(s) pour ${nameOf(household.id)} - ${monthLabel}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
        await this.#recordPayslip({
          kind: 'public_wage', houseId: household.id, gross: toCentimes(stipend), withheld: withholding.get(`stipend|${household.id}`), payerId: null, flow: `stipend:${household.id}`,
          key: `${household.id}:stipend`, description: `${LINE_LABELS.public_wage} - ${monthLabel}`, time, timeInfo, hamletId, monthLabel, nameOf,
        });
      }
    }

    for (const pair of pairs) {
      for (const line of tradeLines(pair)) {
        const accountKind = houseIds.has(line.holder) ? businessAccountOf(houseEnterpriseOf(typeOfBuilding.get(line.holder), 'recipes').id) : null;
        await this.#record({ ...line, accountKind }, {
          time,
          key: buildTradeLineBusinessKey(line.kind, line.holder, line.counterparty, timeInfo, hamletId),
          description: `${LINE_LABELS[line.kind]} ${nameOf(line.holder)}${line.counterparty ? ` avec ${nameOf(line.counterparty)}` : ''} - ${monthLabel}`,
          buildingInstanceId: line.holder,
          timeInfo,
        });
      }
    }

    // A paid bill is a sale on the company's account and a purchase on the house's personal account. An unpaid bill is cut
    // off for the month the settlement falls in: the house is not served, and nothing is sold or subsidised.
    const subsidiesHT = new Map();
    for (const [index, bill] of bills.entries()) {
      if (!payable[index]) {
        await this.deps.recordServiceCutOff({
          turn: time,
          year: settledAt.year,
          monthIndex: settledAt.monthIndex,
          houseId: bill.houseId,
          service: bill.service,
        });
        continue;
      }
      const label = getResourceCategoryPresentation(bill.service).label;
      for (const line of serviceSaleLines({ sellerId: bill.buildingId, buyerId: bill.houseId, service: bill.service, ttc: bill.ttc, ht: bill.ht, vat: bill.vat })) {
        await this.#record(line, {
          time,
          key: buildServiceLineBusinessKey(line.kind, line.holder ?? 'city', line.counterparty, bill.service, timeInfo, hamletId),
          description: `${LINE_LABELS[line.kind]} ${label} : ${nameOf(bill.buildingId)} avec ${nameOf(bill.houseId)} - ${monthLabel}`,
          buildingInstanceId: line.holder ?? line.counterparty,
          timeInfo,
        });
      }
      subsidiesHT.set(bill.buildingId, centimes((subsidiesHT.get(bill.buildingId) ?? 0) + bill.citySubsidy));
    }

    // The debts the companies carry (a charge they could not pay), and what each holds once its charges of the month are paid.
    const payables = payablesOf(await this.deps.getJournalEntries());
    const cashAfterCharges = new Map();
    for (const building of buildings) {
      const { wagesHT, workers, wagePerWorker } = wagesByBuilding.get(building.id);
      const subsidyHT = subsidiesHT.get(building.id) ?? 0;
      const sources = building.workerSources ?? {};
      const isCompany = isLucrativeBuilding(building.type);

      if (isCompany) {
        // A company pays what it owes as far as its money goes: its old debts first, then the charges of the month by rank (wages, contributions, rent);
        // what it cannot pay becomes a debt (see DebtPolicy). What it holds after is what the year's tax may use.
        cashAfterCharges.set(building.id, await this.#settleCompanyMonth({
          building, wagesHT, workers, wagePerWorker, sources, subsidyHT, owner, houseSubsidyRate, publicPay, payables,
          time, timeInfo, hamletId, monthLabel, nameOf, withholding,
        }));
      } else {
        // The city's subsidy to a company: a city expense and the company's receipt, both for the month.
        for (const line of serviceSubsidyLines({ sellerId: building.id, citySubsidy: subsidyHT })) {
          await this.#record(line, {
            time,
            key: buildProducerLineBusinessKey(line.kind, building.id, timeInfo, hamletId),
            description: `${LINE_LABELS[line.kind]} ${nameOf(building.id)} - ${monthLabel}`,
            buildingInstanceId: building.id,
            timeInfo,
          });
        }

        const lines = buildingChargeLines({
          id: building.id,
          type: building.type,
          maintenanceCost: this.deps.buildingMaintenanceCost(building.type),
          houseSubsidyRate,
          owner,
        });
        // A house's upkeep with no owner standing is the hamlet's: the line says why, so the player is not left to guess.
        const ownerless = owner === null && houseIds.has(building.id) ? ' (sans propriétaire : à la charge du hameau)' : '';
        for (const line of lines) {
          await this.#record(line, {
            time,
            key: buildProducerLineBusinessKey(line.kind, building.id, timeInfo, hamletId),
            description: `${LINE_LABELS[line.kind]} ${nameOf(building.id)}${ownerless} - ${monthLabel}`,
            buildingInstanceId: building.id,
            timeInfo,
          });
        }
      }

      // The corporate tax is a yearly one, settled when the fiscal year closes: this settlement opens a new year, so the lines of the year
      // that ended are all written. It is read off the company's statement of that year, so it is based on the same résultat courant avant
      // impôts the player reads, not on a second computation of it, and it is dated in the year it taxes (its last turn).
      if (timeInfo.monthIndex === MONTHS_PER_YEAR - 1 && isLucrativeBuilding(building.type)) {
        const { rcaiYearToDate, taxPaidYearToDate } = await this.deps.readCompanyYear(building.id, timeInfo.year);
        const taxLines = corporateTaxLines({ id: building.id, amount: corporateTaxDueOf({ rcaiYearToDate, taxPaidYearToDate, rate: corporateTaxRate }) });
        // The tax is paid with what the company holds once its charges of the month are paid; what it cannot pay is a debt to the city.
        const due = taxLines.length > 0 ? Math.round(taxLines[0].amount * 100) : 0;
        // `cashAfterCharges` is what it still holds once its charges of the month are paid.
        const payment = planCompanyPayments({ cash: cashAfterCharges.get(building.id), debts: [], charges: [{ id: 'tax', rank: PAYABLE_KINDS.corporate_tax.rank, amount: due }] });
        const taxPaid = payment.chargePaid.get('tax') ?? 0;
        for (const line of taxLines) {
          if (taxPaid <= 0) break;
          await this.#record({ ...line, amount: taxPaid / 100 }, {
            time: deliveredTime,
            key: buildProducerLineBusinessKey(line.kind, building.id, timeInfo, hamletId),
            description: `${LINE_LABELS[line.kind]} ${nameOf(building.id)} - ${monthLabel}`,
            buildingInstanceId: building.id,
            timeInfo,
          });
        }
        if (due - taxPaid > 0) {
          await this.#recordPayable({ kind: 'corporate_tax', debtorId: building.id, accountKind: null, creditorId: null, amount: (due - taxPaid) / 100, time: deliveredTime, timeInfo, hamletId, description: `${LINE_LABELS.corporate_tax} ${nameOf(building.id)} non payé - ${monthLabel}` });
        }
      }

      // A house's own business is a cooperative: its surplus is shared once a year, when the fiscal year closes, between the residents
      // (participation, interest on the parts sociales), the tax and its reserves. A house is no company: it has no payroll, its residents
      // are paid out of the surplus. The surplus is the résultat courant avant impôts of the business account over the year, as its
      // statement shows it, and the lines are dated in the year they share (its last turn).
      // Each enterprise of the house is a legal person of its own: it shares its own result, out of its own account.
      if (timeInfo.monthIndex === MONTHS_PER_YEAR - 1 && houseIds.has(building.id)) {
        for (const enterprise of houseEnterprises(building.type).enterprises) {
          const businessAccount = businessAccountOf(enterprise.id);
          // The rule of its legal form: how it shares, whether it pays the corporate tax, and the words of its jargon for the journal.
          const form = legalFormOf(enterprise.id);
          const { rcaiYearToDate: result } = await this.deps.readCompanyYear(building.id, timeInfo.year, businessAccount);
          const sharing = allocateEnterpriseResult({
            result,
            businessCash: result > 0 ? await this.deps.businessFundsOf(building.id, businessAccount) : 0,
            shares: form.regime.shares,
            corporateTaxRate: form.regime.taxed ? corporateTaxRate : 0,
          });
          const sharingWords = {
            ...LINE_LABELS,
            enterprise_participation: form.terms.participation?.paid,
            household_participation: form.terms.participation?.received,
            enterprise_dividend: form.terms.dividend.paid,
            household_dividend: form.terms.dividend.received,
          };
          for (const line of enterpriseLines({ houseId: building.id, businessAccount, ...sharing })) {
            await this.#record(line, {
              time: deliveredTime,
              key: buildProducerLineBusinessKey(line.kind, `${building.id}:${enterprise.id}`, timeInfo, hamletId),
              description: `${sharingWords[line.kind]} ${nameOf(building.id)} · ${enterprise.label} - ${monthLabel}`,
              buildingInstanceId: building.id,
              timeInfo,
            });
          }
        }
      }
    }

    // What the buildings lost to spoilage in the month: an informative line each (the manque à gagner), on the account of the building or of its
    // enterprise. It moves no money, it only tells the player what the loss would have sold for.
    for (const loss of await this.deps.listSpoilage(timeInfo.year, timeInfo.monthIndex)) {
      // The loss of a building that is gone is not told: there is no account of it left to tell it on.
      if (!(loss.lostRevenue > 0) || !standing.has(loss.buildingId)) continue;
      const accountKind = houseIds.has(loss.buildingId) ? businessAccountOf(houseEnterpriseOf(typeOfBuilding.get(loss.buildingId), 'recipes').id) : null;
      await this.#record(
        { kind: 'info_goods_spoiled', amount: loss.lostRevenue, holder: loss.buildingId, counterparty: null, accountKind },
        {
          time,
          key: buildProducerLineBusinessKey('info_goods_spoiled', loss.buildingId, timeInfo, hamletId),
          description: `[Informatif] Avarie ${nameOf(loss.buildingId)} : ${loss.units} unité${loss.units > 1 ? 's' : ''} jetée${loss.units > 1 ? 's' : ''}, manque à gagner - ${monthLabel}`,
          buildingInstanceId: loss.buildingId,
          timeInfo,
        },
      );
    }

    // The year closes: each household's income tax is recalculated on the whole year's income, what its enterprises paid it included (the
    // participation and the dividends are taxed with the wages, on the same bands). The monthly withholdings were an advance on the wages;
    // what is still owed is charged now, dated in the year it taxes. An advance that turns out too high is not refunded (no refund line
    // exists): it is only never topped up.
    if (timeInfo.monthIndex === MONTHS_PER_YEAR - 1) {
      for (const household of households) {
        const year = await this.deps.readHouseholdYear(household.id, timeInfo.year);
        const annualTax = withholdIncomeTax({
          gross: year.incomeYearToDate,
          threshold1: taxRate.threshold1 * MONTHS_PER_YEAR,
          rate1: taxRate.rate1,
          threshold2: taxRate.threshold2 * MONTHS_PER_YEAR,
          rate2: taxRate.rate2,
        }).incomeTax;
        // Positive: the advances did not cover the tax of the year, the household owes the rest. Negative: they went beyond it, the city gives back
        // the difference (never more than was withheld, since the tax of the year is never below nothing).
        const balance = centimes(annualTax - year.taxWithheldYearToDate);
        if (balance === 0) continue;
        const refund = balance < 0;
        const amount = Math.abs(balance);
        const description = `du foyer ${nameOf(household.id)} - régularisation ${timeInfo.year}`;
        const [householdKind, cityKind] = refund ? ['income_tax_refund', 'payroll_tax_refund'] : ['income_tax', 'payroll_tax'];
        await this.#record(
          { kind: householdKind, amount, holder: household.id, counterparty: null, accountKind: PERSONAL_ACCOUNT, flow: `income_tax_annual:${household.id}` },
          {
            time: deliveredTime,
            key: buildProducerLineBusinessKey(householdKind, `${household.id}:annual`, timeInfo, hamletId),
            description: `${LINE_LABELS[householdKind]} ${description}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
        await this.#record(
          { kind: cityKind, amount, holder: null, counterparty: household.id, accountKind: null, flow: `income_tax_annual:${household.id}` },
          {
            time: deliveredTime,
            key: buildProducerLineBusinessKey(cityKind, `${household.id}:annual`, timeInfo, hamletId),
            description: `${LINE_LABELS[cityKind]} ${description}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
      }
    }
  }

  /**
   * Which bills are paid, and each company's wages. The wages depend on the sales, the sales on the bills paid, and the bills
   * on the wages a house receives: the paid set can only shrink, so it is found by repeating until it stops changing.
   * @returns {{ payable: boolean[], wagesByBuilding: Map<string, { salesHT: number, wagesHT: number }> }}
   */
  #planMonth({ bills, pairs, houseSales, bankInterest, buildings, fundsByHouse, taxRate, benefitByHouse, wageRateOf, employeeRate }) {
    let payable = bills.map(() => true);
    for (let round = 0; round <= bills.length + 1; round += 1) {
      const grossByHouse = new Map();
      for (const [houseId, benefit] of benefitByHouse) {
        grossByHouse.set(houseId, centimes((grossByHouse.get(houseId) ?? 0) + benefit));
      }
      const wagesReceivedByHouse = new Map();
      const wagesByBuilding = new Map();
      for (const building of buildings) {
        const servicesHT = bills.reduce(
          (sum, bill, index) => (payable[index] && bill.buildingId === building.id ? sum + bill.ht : sum),
          0,
        );
        const goodsToHousesHT = sumWhere(houseSales, (sale) => sale.sellerId === building.id);
        // The bank's own fourth source: interest earned on its loans, read from the journal, not the three
        // supply-chain-derived sources above (a loan leaves no traceability row — see sumBankInterestByBuilding).
        const bankInterestHT = sumWhere(bankInterest, (interest) => interest.buildingId === building.id);
        const salesHT = centimes(sumWhere(pairs, (pair) => pair.sellerId === building.id) + goodsToHousesHT + servicesHT + bankInterestHT);
        const sources = building.workerSources ?? {};
        const workers = Object.values(sources).reduce((sum, count) => sum + count, 0);
        // The payroll follows the staffing, not the sales: the same whatever the month sold.
        const wagesHT = payrollOf({ type: building.type, workers, wageRateOf });
        wagesByBuilding.set(building.id, { salesHT, wagesHT, workers, wagePerWorker: workers > 0 && wagesHT > 0 ? centimes(wagesHT / workers) : null });
        for (const line of wageSplitLines({ workplaceId: building.id, wagesHT, sources })) {
          if (line.kind !== 'household_wage') continue;
          wagesReceivedByHouse.set(line.holder, centimes((wagesReceivedByHouse.get(line.holder) ?? 0) + line.amount));
        }
      }
      // What a house has to spend is its wages less the employee's social contribution, with the benefit, less the income tax on that total.
      for (const [houseId, wages] of wagesReceivedByHouse) {
        const withheld = centimes(wages * employeeRate);
        grossByHouse.set(houseId, centimes((grossByHouse.get(houseId) ?? 0) + wages - withheld));
      }
      // The house's budget is its month's wages and benefit, from every workplace, after the income tax on that total:
      // the benefit is taxed exactly like a wage, folded into the same gross before the same brackets apply.
      const wageCreditByHouse = new Map(
        [...grossByHouse].map(([houseId, gross]) => [houseId, withholdIncomeTax({ gross, ...taxRate }).net]),
      );
      const next = payableServiceBills(bills, (houseId) =>
        fundsByHouse.get(houseId) + (wageCreditByHouse.get(houseId) ?? 0),
      );
      if (next.every((paid, index) => paid === payable[index])) return { payable, wagesByBuilding };
      payable = next;
    }
    throw new Error('[producer] the services of the month did not settle: the bills paid kept changing');
  }

  /**
   * The month of one company's charges, paid as far as its money goes. Its old debts are paid first, then the charges of the month by rank (the wages of
   * each house, the employer's contributions, the rent of its premises); what it cannot pay of them becomes a new debt (an opération diverse that books
   * the charge against what is owed). What has no creditor in the game (the upkeep when no owner stands) is written whole, as before.
   * @returns {Promise<number>} what the company holds once all is paid, in centimes
   */
  async #settleCompanyMonth({ building, wagesHT, workers, wagePerWorker, sources, subsidyHT, owner, houseSubsidyRate, publicPay, payables, time, timeInfo, hamletId, monthLabel, nameOf, withholding }) {
    const id = building.id;
    const toC = (euros) => Math.round(euros * 100);
    const write = (line, description, key) => this.#record(line, { time, key, description, buildingInstanceId: id, timeInfo });

    // What comes in, and what has no creditor, is written first: the company's money for the month is what is left of them.
    for (const line of serviceSubsidyLines({ sellerId: id, citySubsidy: subsidyHT })) {
      await write(line, `${LINE_LABELS[line.kind]} ${nameOf(id)} - ${monthLabel}`, buildProducerLineBusinessKey(line.kind, id, timeInfo, hamletId));
    }
    const chargeLines = buildingChargeLines({ id, type: building.type, maintenanceCost: this.deps.buildingMaintenanceCost(building.type), houseSubsidyRate, owner });
    const isRentLine = (line) => line.kind === 'premises_rent_paid' || line.kind === 'premises_rent_received';
    for (const line of chargeLines.filter((candidate) => !isRentLine(candidate))) {
      await write(line, `${LINE_LABELS[line.kind]} ${nameOf(id)} - ${monthLabel}`, buildProducerLineBusinessKey(line.kind, id, timeInfo, hamletId));
    }

    // What it owes, and what it has.
    const wageLines = wageSplitLines({ workplaceId: id, wagesHT, sources });
    const employerLines = employerContributionLines({ workplaceId: id, wagesHT, rate: publicPay.employerContributionRate });
    const rentLines = chargeLines.filter(isRentLine);
    const charges = [];
    for (let index = 0; index < wageLines.length; index += 2) {
      charges.push({ id: `wage|${wageLines[index].counterparty}`, rank: PAYABLE_KINDS.wage.rank, amount: toC(wageLines[index].amount) });
    }
    if (employerLines.length > 0) charges.push({ id: 'contribution', rank: PAYABLE_KINDS.contribution.rank, amount: toC(employerLines[0].amount) });
    if (rentLines.length > 0) charges.push({ id: 'premises_rent', rank: PAYABLE_KINDS.premises_rent.rank, amount: toC(rentLines[0].amount) });
    // A debt of rent is payable only while the owner it is owed to stands.
    const debts = [...payables.values()]
      .filter((debt) => debt.debtorId === id && debt.accountKind === null && (debt.kind !== 'premises_rent' || owner?.id === debt.creditorId))
      .map((debt) => ({ id: `${debt.kind}|${debt.creditorId ?? ''}`, rank: PAYABLE_KINDS[debt.kind].rank, amount: debt.centimes, debt }));
    const cash = toC(await this.deps.companyFundsOf(id));
    const plan = planCompanyPayments({ cash, debts, charges });

    for (const { id: debtId, debt } of debts) {
      const paid = plan.debtPaid.get(debtId) ?? 0;
      if (paid > 0) await this.#recordDebtPayment({ debt, amount: paid / 100, owner, time, timeInfo, hamletId, monthLabel, nameOf });
    }

    // The charges of the month: the paid part is written as the charge, the rest is a debt.
    const scaled = (line, kindPaid) => ({ ...line, amount: kindPaid / 100 });
    for (let index = 0; index < wageLines.length; index += 2) {
      const [wage, received] = [wageLines[index], wageLines[index + 1]];
      const chargeId = `wage|${wage.counterparty}`;
      const paid = plan.chargePaid.get(chargeId) ?? 0;
      if (paid > 0) {
        await write(scaled(wage, paid), `${LINE_LABELS.producer_wage} ${nameOf(id)} → ${nameOf(wage.counterparty)} (${workers} ouvriers à ${wagePerWorker.toFixed(2)} €) - ${monthLabel}`, buildTradeLineBusinessKey(wage.kind, wage.holder, wage.counterparty, timeInfo, hamletId));
        // The employer pays the wage and keeps back the contribution and the tax the plan gave this pay (in proportion, when it can pay only part of it): the
        // household receives its payslip, the city what was withheld.
        const planned = withholding.get(`wage|${id}|${received.holder}`);
        const share = (centimesWithheld) => (paid === toCentimes(received.amount) ? centimesWithheld : Math.round((centimesWithheld * paid) / toCentimes(received.amount)));
        await this.#recordPayslip({
          kind: 'household_wage', houseId: received.holder, gross: paid, withheld: { contribution: share(planned.contribution), tax: share(planned.tax) }, payerId: id, flow: received.flow,
          key: `${id}:${received.holder}`, description: `${LINE_LABELS.household_wage} de ${nameOf(id)} - ${monthLabel}`, time, timeInfo, hamletId, monthLabel, nameOf,
        });
      }
      const unpaid = plan.chargeUnpaid.get(chargeId) ?? 0;
      if (unpaid > 0) {
        await this.#recordPayable({ kind: 'wage', debtorId: id, accountKind: null, creditorId: wage.counterparty, amount: unpaid / 100, time, timeInfo, hamletId, description: `${LINE_LABELS.producer_wage} ${nameOf(id)} → ${nameOf(wage.counterparty)} non payés - ${monthLabel}` });
      }
    }
    if (employerLines.length > 0) {
      const [contribution, received] = employerLines;
      const paid = plan.chargePaid.get('contribution') ?? 0;
      if (paid > 0) {
        await write(scaled(contribution, paid), `${LINE_LABELS.employer_contribution} ${nameOf(id)} - ${monthLabel}`, buildProducerLineBusinessKey(contribution.kind, id, timeInfo, hamletId));
        await write(scaled(received, paid), `${LINE_LABELS.social_contribution} de ${nameOf(id)} - ${monthLabel}`, buildProducerLineBusinessKey(received.kind, id, timeInfo, hamletId));
      }
      const unpaid = plan.chargeUnpaid.get('contribution') ?? 0;
      if (unpaid > 0) {
        await this.#recordPayable({ kind: 'contribution', debtorId: id, accountKind: null, creditorId: null, amount: unpaid / 100, time, timeInfo, hamletId, description: `${LINE_LABELS.employer_contribution} ${nameOf(id)} non payées - ${monthLabel}` });
      }
    }
    if (rentLines.length > 0) {
      const [rent, received] = rentLines;
      const paid = plan.chargePaid.get('premises_rent') ?? 0;
      if (paid > 0) {
        await write(scaled(rent, paid), `${LINE_LABELS.premises_rent_paid} ${nameOf(id)} - ${monthLabel}`, buildProducerLineBusinessKey(rent.kind, id, timeInfo, hamletId));
        await write(scaled(received, paid), `${LINE_LABELS.premises_rent_received} ${nameOf(id)} - ${monthLabel}`, buildProducerLineBusinessKey(received.kind, id, timeInfo, hamletId));
      }
      const unpaid = plan.chargeUnpaid.get('premises_rent') ?? 0;
      if (unpaid > 0) {
        await this.#recordPayable({ kind: 'premises_rent', debtorId: id, accountKind: null, creditorId: owner.id, amount: unpaid / 100, time, timeInfo, hamletId, description: `${LINE_LABELS.premises_rent_paid} ${nameOf(id)} non payé - ${monthLabel}` });
        await this.#recordReceivable({ ownerId: owner.id, businessAccount: owner.businessAccount, debtorId: id, amount: unpaid / 100, time, timeInfo, hamletId, description: `${LINE_LABELS.premises_rent_paid} ${nameOf(id)} à encaisser - ${monthLabel}` });
      }
    }
    return plan.left;
  }

  /**
   * A company's debt paid off, in whole or in part: the line of money against the debt account, and what the creditor receives (the house of the workers,
   * the city's social security or treasury, the owner).
   */
  async #recordDebtPayment(params) {
    await recordDebtPayment(this.deps, params);
  }

  /**
   * The charge a company could not pay, booked against what it owes: an opération diverse on its account, to the one it is owed to.
   * @param {{ kind: string, debtorId: string, accountKind: string | null, creditorId: string | null, amount: number, time: number, timeInfo: object, hamletId: string, description: string }} debt
   */
  async #recordPayable({ kind, debtorId, accountKind, creditorId, amount, time, timeInfo, hamletId, description }) {
    const type = PAYABLE_KINDS[kind].payable;
    const result = await this.deps.recordLedgerEntry({
      turn: time,
      type,
      amount,
      description: `[OD] ${description}`,
      businessKey: `${type}:${hamletId}:${debtorId}:${creditorId ?? 'city'}:${timeInfo.year}:${timeInfo.monthIndex}`,
      buildingInstanceId: debtorId,
      accountBuildingId: debtorId,
      accountKind,
      counterpartyBuildingId: creditorId,
      // What a company cannot pay is its creditor's receivable (the owner's for the rent, the city's for the tax and the contributions): the two écritures are one flow.
      ...(kind === 'premises_rent' ? { transactionId: this.#rentDueFlow(debtorId, timeInfo) } : {}),
      ...(CITY_RECEIVABLES[kind] ? { transactionId: this.#cityDebtFlow(kind, debtorId, timeInfo) } : {}),
    });
    if (!result.recorded && result.reason !== 'duplicate_business_key') throw new Error(`[producer] the ${type} line "${description}" was not recorded: ${result.reason}`);
    // The city, owed by the company, books its receivable on its own account the same month.
    if (CITY_RECEIVABLES[kind]) {
      const receivable = CITY_RECEIVABLES[kind];
      const booked = await this.deps.recordLedgerEntry({
        turn: time,
        type: receivable,
        amount,
        description: `[OD] ${description} (créance de la ville)`,
        businessKey: `${receivable}:${hamletId}:${debtorId}:${timeInfo.year}:${timeInfo.monthIndex}`,
        buildingInstanceId: debtorId,
        accountBuildingId: null,
        accountKind: null,
        counterpartyBuildingId: debtorId,
        transactionId: this.#cityDebtFlow(kind, debtorId, timeInfo),
      });
      if (!booked.recorded && booked.reason !== 'duplicate_business_key') throw new Error(`[producer] the ${receivable} line "${description}" was not recorded: ${booked.reason}`);
    }
  }

  /** @returns {string} the flow of what a company owes the city for a month (tax or contributions): its debt and the city's receivable carry it */
  #cityDebtFlow(kind, debtorId, timeInfo) {
    return `${timeInfo.year}:${timeInfo.monthIndex}:debt_due:${kind}:${debtorId}`;
  }

  /**
   * A household's pay as a payslip, and what its payer withheld from it. The household's écriture credits the gross to what the payer owes it and debits what
   * reaches its account (the net) and what was withheld (431, 4421): it has more than two legs when something is withheld. The city receives the contribution and
   * the tax from the payer (an employer remits what it withheld; the city retains what it withholds from its own pay), each on its own account.
   * @param {{ kind: 'household_wage' | 'public_wage' | 'household_benefit', houseId: string, gross: number, withheld: { contribution: number, tax: number }, payerId: string | null,
   *   flow: string, key: string, description: string, time: number, timeInfo: object, hamletId: string, monthLabel: string, nameOf: (id: string) => string }} payslip
   *   `gross` and what is withheld in centimes; `payerId` the employer, null for the city; `key` tells this payslip from another of the same kind that month
   */
  async #recordPayslip({ kind, houseId, gross, withheld, payerId, flow, key, description, time, timeInfo, hamletId, monthLabel, nameOf }) {
    const creditAccount = kind === 'household_benefit' ? '437' : '421';
    const legs = payslipLegs({ creditAccount, gross, contribution: withheld.contribution, tax: withheld.tax });
    const counterparty = payerId ?? houseId;
    await this.#record(
      { kind, amount: gross / 100, holder: houseId, counterparty: payerId, accountKind: PERSONAL_ACCOUNT, flow, ...(legs ? { legs } : {}) },
      {
        time,
        key: kind === 'household_wage' ? buildTradeLineBusinessKey(kind, houseId, payerId, timeInfo, hamletId) : buildProducerLineBusinessKey(kind, houseId, timeInfo, hamletId),
        description,
        buildingInstanceId: houseId,
        timeInfo,
      },
    );
    const keyOf = (type) => (payerId ? buildTradeLineBusinessKey(type, payerId, houseId, timeInfo, hamletId) : buildProducerLineBusinessKey(type, key, timeInfo, hamletId));
    if (withheld.contribution > 0) {
      await this.#record(
        { kind: 'social_contribution', amount: withheld.contribution / 100, holder: null, counterparty, accountKind: null, flow },
        { time, key: keyOf('social_contribution'), description: `${LINE_LABELS.social_contribution} sur le salaire de ${nameOf(houseId)} - ${monthLabel}`, buildingInstanceId: houseId, timeInfo },
      );
    }
    if (withheld.tax > 0) {
      await this.#record(
        { kind: 'payroll_tax', amount: withheld.tax / 100, holder: null, counterparty, accountKind: null, flow },
        { time, key: keyOf('payroll_tax'), description: `${LINE_LABELS.payroll_tax} du foyer ${nameOf(houseId)} - ${monthLabel}`, buildingInstanceId: houseId, timeInfo },
      );
    }
  }

  /** @returns {string} the flow of the rent a company owes its owner for a month: its debt and the owner's receivable carry it */
  #rentDueFlow(debtorId, timeInfo) {
    return `${timeInfo.year}:${timeInfo.monthIndex}:rent_due:${debtorId}`;
  }

  /** The rent of the premises the owner is owed and has not received: an opération diverse on its account (an income against a receivable). */
  async #recordReceivable({ ownerId, businessAccount, debtorId, amount, time, timeInfo, hamletId, description }) {
    const result = await this.deps.recordLedgerEntry({
      turn: time,
      type: 'od_receivable_premises_rent',
      amount,
      description: `[OD] ${description}`,
      businessKey: `od_receivable_premises_rent:${hamletId}:${debtorId}:${timeInfo.year}:${timeInfo.monthIndex}`,
      buildingInstanceId: debtorId,
      accountBuildingId: ownerId,
      accountKind: businessAccount,
      counterpartyBuildingId: debtorId,
      transactionId: this.#rentDueFlow(debtorId, timeInfo),
    });
    if (!result.recorded && result.reason !== 'duplicate_business_key') throw new Error(`[producer] the premises rent receivable "${description}" was not recorded: ${result.reason}`);
  }

  /**
   * A private movement is written to the economy register first (its business key makes that idempotent), then the
   * journal line is recorded. The goods flows are already in the register, written by the supply.
   * @param {{ kind: string, amount: number, holder: string | null, counterparty: string | null, accountKind?: string | null }} line
   * @param {{ time: number, key: string, description: string, buildingInstanceId: string, timeInfo: { year: number, monthIndex: number } }} written
   */
  async #record(line, written) {
    await recordLine(this.deps, line, written);
  }
}

/** @param {Array<{ amountHT: number }>} pairs @param {(pair: object) => boolean} predicate */
function sumWhere(pairs, predicate) {
  return Math.round(pairs.filter(predicate).reduce((sum, pair) => sum + pair.amountHT, 0) * 100) / 100;
}
