/**
 * Query (CQRS read): for each need of the citizens that is a stock (what they eat, the goods they wear out, their heat, their light), whether the producers
 * standing now make enough of it in theory, how many producer buildings are missing, and what really happened to it over the last twelve months: what the
 * producers sold on, what was sold to the houses, what was lost to spoilage, and what is in stock now at each stage (see SupplyBalancePolicy.js). The theory
 * comes from the catalog and the buildings standing now; what happened comes from the transfers logged.
 */
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';
import { listRoleEntries } from '../../domain/policies/ResourceRolePolicy.js';
import { listQuantityConsumerNeeds } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import {
  chainVerdictOf,
  declaredCalendarOf,
  declaredYearlyYield,
  neverCollected,
  supplyBalanceOf,
  yearlyDemandOf,
  yearlyUnitsOf,
} from '../../domain/policies/SupplyBalancePolicy.js';

const sum = (values) => values.reduce((total, value) => total + value, 0);

export class DescribeSupplyBalance {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {object} deps
   * @param {(range: { fromKey: number, toKey: number }) => Promise<{ collected: Record<string, number>, sold: Record<string, number>, spoiled: Record<string, number> }>} deps.readChainFlows
   * @param {() => number} deps.currentMonthKey the current month, `year × MONTHS_PER_YEAR + monthIndex`
   */
  constructor(supplyBuildingRepository, { readChainFlows, currentMonthKey }) {
    if (typeof readChainFlows !== 'function' || typeof currentMonthKey !== 'function') {
      throw new Error('[supply] the supply balance needs the chain flows (readChainFlows) and the current month (currentMonthKey)');
    }
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.readChainFlows = readChainFlows;
    this.currentMonthKey = currentMonthKey;
  }

  async execute() {
    const toKey = this.currentMonthKey();
    const fromKey = Math.max(0, toKey - MONTHS_PER_YEAR + 1);
    const months = toKey - fromKey + 1;
    const flows = await this.readChainFlows({ fromKey, toKey });
    const balances = [];
    // A need with no total (water, energy: services handed out as a flag) has no stock to make, so no balance.
    for (const need of listQuantityConsumerNeeds().filter((entry) => entry.totalKey)) {
      const consumers = await this.supplyBuildingRepository.findByResourceRole('consumer', need.categories);
      const producers = await this.supplyBuildingRepository.findByResourceRole('producer', need.categories);
      const hubs = await this.supplyBuildingRepository.findByResourceRole('hub', need.categories);
      const distributors = await this.supplyBuildingRepository.findByResourceRole('distributor', need.categories);
      const working = (building) => isOperational({ type: building.type, roadCount: building.roadCount, worker: building.worker, workerNeed: building.workerNeed });
      const stockOf = (buildings, category) => sum(buildings.map((building) => building.stocks?.[category] ?? 0));

      let capacity = 0;
      let producersWorking = 0;
      const goods = need.categories.map((category) => {
        const makers = producers.filter((producer) => listRoleEntries(producer.type, 'producer').some((role) => role.categories.includes(category)));
        const makersWorking = makers.filter(working);
        for (const maker of makersWorking) {
          capacity += yearlyUnitsOf(listRoleEntries(maker.type, 'producer').find((role) => role.categories.includes(category)));
          producersWorking += 1;
        }
        const collected = flows.collected[category] ?? 0;
        return {
          category,
          producers: makers.length,
          working: makersWorking.length,
          collected,
          sold: flows.sold[category] ?? 0,
          spoiled: flows.spoiled[category] ?? 0,
          stocks: { producers: stockOf(makers, category), hubs: stockOf(hubs, category), distributors: stockOf(distributors, category) },
          neverCollected: neverCollected({ working: makersWorking.length, collected, months }),
          calendar: declaredCalendarOf(category),
        };
      });

      const yieldPerBuilding = declaredYearlyYield(need.categories);
      const balance = supplyBalanceOf({ demand: yearlyDemandOf(consumers, need.categories), capacity, yieldPerBuilding });
      balances.push({
        totalKey: need.totalKey,
        categories: [...need.categories],
        producers: sum(goods.map((good) => good.producers)),
        working: producersWorking,
        yieldPerBuilding,
        ...balance,
        months,
        goods,
        observed: { collected: sum(goods.map((good) => good.collected)), sold: sum(goods.map((good) => good.sold)), spoiled: sum(goods.map((good) => good.spoiled)) },
        stocks: {
          producers: sum(goods.map((good) => good.stocks.producers)),
          hubs: sum(goods.map((good) => good.stocks.hubs)),
          distributors: sum(goods.map((good) => good.stocks.distributors)),
        },
        verdict: chainVerdictOf({ judged: balance.judged, buildingsMissing: balance.buildingsMissing, goods }),
      });
    }
    return balances;
  }
}
