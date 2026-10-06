import { buildProducerLineBusinessKey, buildServiceLineBusinessKey, buildTradeLineBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import {
  buildingChargeLines,
  serviceSaleLines,
  serviceSubsidyLines,
  tradeLines,
  wageSplitLines,
  wagesPaidOf,
  withholdIncomeTax,
} from '../../domain/policies/ProducerChargePolicy.js';
import { PERSONAL_ACCOUNT } from '../../domain/policies/AccountKeyPolicy.js';
import { serviceSubsidyShare } from '../../domain/policies/ServiceSubsidyPolicy.js';
import { addVatTo } from '../../domain/policies/VatIncludedPolicy.js';
import { payableServiceBills } from '../../domain/policies/ServiceSolvencyPolicy.js';
import { householdPublicPayOf } from '../../domain/policies/HouseholdPublicPayPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getResourceCategoryPresentation } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

/**
 * The private movements the economy register keeps, each under the building it concerns. Goods sales and purchases
 * (producer_revenue, producer_purchase) are already in the register as goods flows. The city's receipt of the corporate
 * tax (corporate_tax_revenue) repeats the company's corporate_tax, so it is not written twice.
 */
const ECONOMY_REGISTER_KINDS = new Set([
  'producer_wage',
  'household_wage',
  'maintenance',
  'subsidy_companies',
  'subsidy_housing',
  'corporate_tax',
]);

/** The journal words of each line kind; the company's name is added in front. */
const LINE_LABELS = Object.freeze({
  producer_revenue: 'Ventes HT',
  producer_purchase: 'Achats HT',
  producer_wage: 'Salaires des ouvriers',
  household_wage: 'Salaire perçu',
  maintenance: 'Entretien',
  subsidy_companies: 'Subvention entretien entreprise',
  subsidy_housing: 'Subvention entretien habitation',
  corporate_tax: 'Impôt sur les sociétés',
  corporate_tax_revenue: 'Impôt sur les sociétés perçu',
  service_sales: 'Ventes de services',
  service_purchase: 'Achats de services',
  service_subsidy: 'Subvention versée',
  service_subsidy_received: 'Subvention reçue',
  vat: 'TVA sur les services',
  income_tax: 'Impôt sur le revenu retenu',
  payroll_tax: 'Impôt sur le revenu perçu',
  salary: 'Salaires des fonctionnaires',
  public_wage: 'Salaire de fonctionnaire perçu',
  unemployment_benefit: 'Allocation chômage versée',
  household_benefit: 'Allocation chômage perçue',
});

const centimes = (amount) => Math.round(amount * 100) / 100;

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
   * @param {(service: string) => number} deps.getServicePrice the price (HT) of one unit, before the subsidy and the VAT
   * @param {() => Promise<Record<string, number>>} deps.getVatRates the hamlet's VAT rate per service, in percent
   * @param {(year: number, monthIndex: number) => Promise<Array<{ sellerId: string, amountHT: number }>>} deps.sumHouseSales the goods a company sold to the houses in the month, from the journal (HT)
   * @param {() => Promise<{ rate: number, threshold: number }>} deps.getSalaryTax the income tax: its rate on a wage (a fraction), and the monthly threshold under which a wage pays nothing
   * @param {() => Promise<Array<{ id: string, pop: number }>>} deps.listHouses the hamlet's households and their residents
   * @param {() => Promise<{ salaryPerMonth: number, unemploymentBenefitRate: number }>} deps.getPublicPay the reference salary and the benefit rate (a fraction)
   * @param {(houseId: string) => Promise<number>} deps.fundsOf what a house has in its personal account before this settlement
   * @param {(cutOff: { turn: number, year: number, monthIndex: number, houseId: string, service: string }) => Promise<void>} deps.recordServiceCutOff
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
    const pairs = await this.deps.sumGoodsFlowsByPair(timeInfo.year, timeInfo.monthIndex);
    const serviceFlows = await this.deps.sumServiceFlows(timeInfo.year, timeInfo.monthIndex);
    const subsidies = await this.deps.getServiceSubsidies();
    const ratesPercent = await this.deps.getVatRates();
    const buildings = await this.deps.listBuildings();
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
      const share = serviceSubsidyShare({
        units: flow.units,
        unitPrice: this.deps.getServicePrice(flow.service),
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
    const taxRate = await this.deps.getSalaryTax();

    // The city's pay to the households: the civil servants' salary and the unemployed's benefit, from the residents of each.
    const publicPay = await this.deps.getPublicPay();
    const households = await this.deps.listHouses();
    const workersIn = (houseId) => buildings.reduce((sum, building) => sum + (building.workerSources?.[houseId] ?? 0), 0);
    const publicByHouse = new Map();
    const benefitByHouse = new Map();
    const publicCountByHouse = new Map();
    for (const household of households) {
      const pay = householdPublicPayOf({
        pop: household.pop,
        workers: workersIn(household.id),
        referenceSalaryPerMonth: publicPay.salaryPerMonth,
        unemploymentBenefitRate: publicPay.unemploymentBenefitRate,
      });
      publicCountByHouse.set(household.id, pay);
      if (pay.publicPay > 0) publicByHouse.set(household.id, pay.publicPay);
      if (pay.benefit > 0) benefitByHouse.set(household.id, pay.benefit);
    }

    for (const household of households) {
      const { civilServants, unemployed, publicPay: salary, benefit } = publicCountByHouse.get(household.id);
      const name = nameOf(household.id);
      if (salary > 0) {
        await this.#record(
          { kind: 'salary', amount: salary, holder: null, counterparty: household.id, accountKind: null },
          {
            time,
            key: buildProducerLineBusinessKey('salary', household.id, timeInfo, hamletId),
            description: `${LINE_LABELS.salary} : ${civilServants} fonct. pour ${name} - ${monthLabel}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
        await this.#record(
          { kind: 'public_wage', amount: salary, holder: household.id, counterparty: null, accountKind: PERSONAL_ACCOUNT },
          {
            time,
            key: buildProducerLineBusinessKey('public_wage', household.id, timeInfo, hamletId),
            description: `${LINE_LABELS.public_wage} - ${monthLabel}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
      }
      if (benefit > 0) {
        await this.#record(
          { kind: 'unemployment_benefit', amount: benefit, holder: null, counterparty: household.id, accountKind: null },
          {
            time,
            key: buildProducerLineBusinessKey('unemployment_benefit', household.id, timeInfo, hamletId),
            description: `${LINE_LABELS.unemployment_benefit} : ${unemployed} chôm. pour ${name} - ${monthLabel}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
        await this.#record(
          { kind: 'household_benefit', amount: benefit, holder: household.id, counterparty: null, accountKind: PERSONAL_ACCOUNT },
          {
            time,
            key: buildProducerLineBusinessKey('household_benefit', household.id, timeInfo, hamletId),
            description: `${LINE_LABELS.household_benefit} - ${monthLabel}`,
            buildingInstanceId: household.id,
            timeInfo,
          },
        );
      }
    }

    const { payable, wagesByBuilding } = this.#planMonth({ bills, pairs, houseSales, buildings, fundsByHouse, taxRate, publicByHouse, benefitByHouse });

    for (const pair of pairs) {
      for (const line of tradeLines(pair)) {
        await this.#record(line, {
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
      for (const line of serviceSaleLines({ sellerId: bill.buildingId, buyerId: bill.houseId, ttc: bill.ttc, ht: bill.ht, vat: bill.vat })) {
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

    // The income tax is per household (foyer): its wages of the month, from every workplace, are taxed once, above the threshold.
    const grossByHouse = new Map(publicByHouse);
    for (const building of buildings) {
      const { salesHT, wagesHT } = wagesByBuilding.get(building.id);
      const purchasesHT = sumWhere(pairs, (pair) => pair.buyerId === building.id);
      const subsidyHT = subsidiesHT.get(building.id) ?? 0;
      const sources = building.workerSources ?? {};

      // The wages go to the houses the workers come from: each house receives its workers' share, on its own account.
      for (const line of wageSplitLines({ workplaceId: building.id, wagesHT, sources })) {
        await this.#record(line, {
          time,
          key: buildTradeLineBusinessKey(line.kind, line.holder, line.counterparty, timeInfo, hamletId),
          description: line.kind === 'producer_wage'
            ? `${LINE_LABELS[line.kind]} ${nameOf(line.holder)} → ${nameOf(line.counterparty)} - ${monthLabel}`
            : `${LINE_LABELS[line.kind]} de ${nameOf(line.counterparty)} - ${monthLabel}`,
          buildingInstanceId: line.holder,
          timeInfo,
        });
        if (line.kind === 'household_wage') grossByHouse.set(line.holder, centimes((grossByHouse.get(line.holder) ?? 0) + line.amount));
      }

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
        salesHT,
        subsidiesHT: subsidyHT,
        purchasesHT,
        wagesHT,
        maintenanceCost: this.deps.buildingMaintenanceCost(building.type),
      });
      for (const line of lines) {
        await this.#record(line, {
          time,
          key: buildProducerLineBusinessKey(line.kind, building.id, timeInfo, hamletId),
          description: `${LINE_LABELS[line.kind]} ${nameOf(building.id)} - ${monthLabel}`,
          buildingInstanceId: building.id,
          timeInfo,
        });
      }
    }

    for (const [houseId, gross] of grossByHouse) {
      const { incomeTax } = withholdIncomeTax({ gross, ...taxRate });
      if (incomeTax <= 0) continue;
      await this.#record(
        { kind: 'income_tax', amount: incomeTax, holder: houseId, counterparty: null, accountKind: PERSONAL_ACCOUNT },
        {
          time,
          key: buildProducerLineBusinessKey('income_tax', houseId, timeInfo, hamletId),
          description: `${LINE_LABELS.income_tax} du foyer ${nameOf(houseId)} - ${monthLabel}`,
          buildingInstanceId: houseId,
          timeInfo,
        },
      );
      await this.#record(
        { kind: 'payroll_tax', amount: incomeTax, holder: null, counterparty: houseId, accountKind: null },
        {
          time,
          key: buildProducerLineBusinessKey('payroll_tax', houseId, timeInfo, hamletId),
          description: `${LINE_LABELS.payroll_tax} du foyer ${nameOf(houseId)} - ${monthLabel}`,
          buildingInstanceId: houseId,
          timeInfo,
        },
      );
    }
  }

  /**
   * Which bills are paid, and each company's wages. The wages depend on the sales, the sales on the bills paid, and the bills
   * on the wages a house receives: the paid set can only shrink, so it is found by repeating until it stops changing.
   * @returns {{ payable: boolean[], wagesByBuilding: Map<string, { salesHT: number, wagesHT: number }> }}
   */
  #planMonth({ bills, pairs, houseSales, buildings, fundsByHouse, taxRate, publicByHouse, benefitByHouse }) {
    let payable = bills.map(() => true);
    for (let round = 0; round <= bills.length + 1; round += 1) {
      const grossByHouse = new Map(publicByHouse);
      const wagesByBuilding = new Map();
      for (const building of buildings) {
        const servicesHT = bills.reduce(
          (sum, bill, index) => (payable[index] && bill.buildingId === building.id ? sum + bill.ht : sum),
          0,
        );
        const goodsToHousesHT = sumWhere(houseSales, (sale) => sale.sellerId === building.id);
        const salesHT = centimes(sumWhere(pairs, (pair) => pair.sellerId === building.id) + goodsToHousesHT + servicesHT);
        const sources = building.workerSources ?? {};
        const workers = Object.values(sources).reduce((sum, count) => sum + count, 0);
        const wagesHT = wagesPaidOf({ type: building.type, salesHT, workers });
        wagesByBuilding.set(building.id, { salesHT, wagesHT });
        for (const line of wageSplitLines({ workplaceId: building.id, wagesHT, sources })) {
          if (line.kind !== 'household_wage') continue;
          grossByHouse.set(line.holder, centimes((grossByHouse.get(line.holder) ?? 0) + line.amount));
        }
      }
      // The house's budget is its month's wages, from every workplace, after the income tax on that total.
      // The benefit is not taxed: a household's budget is its net wages plus its benefit.
      const wageCreditByHouse = new Map(
        [...grossByHouse].map(([houseId, gross]) => [houseId, withholdIncomeTax({ gross, ...taxRate }).net]),
      );
      for (const [houseId, benefit] of benefitByHouse) {
        wageCreditByHouse.set(houseId, centimes((wageCreditByHouse.get(houseId) ?? 0) + benefit));
      }
      const next = payableServiceBills(bills, (houseId) =>
        fundsByHouse.get(houseId) + (wageCreditByHouse.get(houseId) ?? 0),
      );
      if (next.every((paid, index) => paid === payable[index])) return { payable, wagesByBuilding };
      payable = next;
    }
    throw new Error('[producer] the services of the month did not settle: the bills paid kept changing');
  }

  /**
   * A private movement is written to the economy register first (its business key makes that idempotent), then the
   * journal line is recorded. The goods flows are already in the register, written by the supply.
   * @param {{ kind: string, amount: number, holder: string | null, counterparty: string | null, accountKind?: string | null }} line
   * @param {{ time: number, key: string, description: string, buildingInstanceId: string, timeInfo: { year: number, monthIndex: number } }} written
   */
  async #record(line, { time, key, description, buildingInstanceId, timeInfo }) {
    if (ECONOMY_REGISTER_KINDS.has(line.kind)) {
      await this.deps.recordEconomyMovement({
        turn: time,
        monthIndex: timeInfo.monthIndex,
        year: timeInfo.year,
        kind: line.kind,
        amount: line.amount,
        buildingId: buildingInstanceId,
        counterpartyId: line.counterparty,
        businessKey: key,
      });
    }
    const result = await this.deps.recordLedgerEntry({
      turn: time,
      type: line.kind,
      amount: line.amount,
      description,
      businessKey: key,
      buildingInstanceId,
      accountBuildingId: line.holder,
      accountKind: line.accountKind ?? null,
      counterpartyBuildingId: line.counterparty,
    });
    // A month already settled is not charged again; any other refusal is a defect, not a skipped line.
    if (!result.recorded && result.reason !== 'duplicate_business_key') {
      throw new Error(`[producer] the ${line.kind} line for ${description} was not recorded: ${result.reason}`);
    }
  }
}

/** @param {Array<{ amountHT: number }>} pairs @param {(pair: object) => boolean} predicate */
function sumWhere(pairs, predicate) {
  return Math.round(pairs.filter(predicate).reduce((sum, pair) => sum + pair.amountHT, 0) * 100) / 100;
}
