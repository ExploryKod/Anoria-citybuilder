import { listQuantityConsumerNeeds } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { listRoleEntries, shelfLifeTurnsAt, stockShapeFor } from '../../domain/policies/ResourceRolePolicy.js';
import { expireAges, reconcileAges } from '../../domain/policies/StockAgingPolicy.js';
import { takeCategoryAmount } from '../../domain/value-objects/ResourceStock.js';

/** The roles whose stock is a good that sits somewhere and can go bad (a consumer's stock is its meal of the month, eaten at once). */
const KEEPING_ROLES = Object.freeze(['producer', 'hub', 'distributor']);

/**
 * Orchestration: full monthly resource supply chain tick — producer harvest,
 * hub surplus collection, hub-to-distributor transfer, distributor reach,
 * and consumption (household gathering is just another 'producer' entry,
 * run by the producer step). Every step is the generic
 * RunResourceCommandForRole/RunCityResourceCycle/RunHubSurplusCycle/
 * UpdateConsumerDistributorReach mechanism — this class only sequences them.
 * Producer/consumer once-per-period locking and the hub-transfer leg's
 * link-storage field names are both self-resolved by each command from the
 * building's own catalog facts now (`periodLock` — see PeriodLockPolicy.js;
 * `hubLink` — see ResourceRolePolicy.getHubLinkForRole) — this class no
 * longer threads any bookkeeping config through at all. See
 * docs/period-lock-catalog-refactor.md.
 */
export class RunMonthlyResourceCycle {
  /**
   * @param {import('../commands/RunResourceCommandForRole.js').RunResourceCommandForRole} runProducerCommand
   * @param {import('../commands/procurement/RunCityResourceCycle.js').RunCityResourceCycle} runCityResourceCycle
   * @param {import('../commands/distribution/UpdateConsumerDistributorReach.js').UpdateConsumerDistributorReach} updateDistributorReach
   * @param {import('../commands/surplus/RunHubSurplusCycle.js').RunHubSurplusCycle} runHubSurplusCycle
   * @param {import('../commands/RunResourceCommandForRole.js').RunResourceCommandForRole} runConsumerCommand
   * @param {{ recordHouseConsumptions: Function, recordChainStates: Function, recordPopulationStates: Function, recordHarvestSales: Function, recordHubCollections: Function }} traceability
   * @param {{ supplyBuildingRepository: import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository, recordSpoilage: (loss: { period: object, building: object, category: string, quantity: number }) => Promise<void> }} aging
   *   what ages the stocks each tick: the buildings to read and write, and the trace of what goes bad
   * @param {object} config
   * @param {ReadonlyArray<string>} config.categories Every category any
   *   distributor covers — drives the actual distribution/restock leg,
   *   deliberately broader than just food (see createSupplyContext.js).
   * @param {ReadonlyArray<string>} [config.reachCategories] Narrower set
   *   the too-far reach check (`updateDistributorReach`) scopes to — keep
   *   this to just food's categories so a hub-less service like a fire station
   *   (also a 'distributor') never counts as "in range" for a house's food
   *   access. Omitted falls back to `categories` (pre-service behavior).
   */
  constructor(
    runProducerCommand,
    runCityResourceCycle,
    updateDistributorReach,
    runHubSurplusCycle,
    runConsumerCommand,
    traceability,
    aging,
    config
  ) {
    this.aging = aging;
    this.runProducerCommand = runProducerCommand;
    this.runCityResourceCycle = runCityResourceCycle;
    this.updateDistributorReach = updateDistributorReach;
    this.runHubSurplusCycle = runHubSurplusCycle;
    this.runConsumerCommand = runConsumerCommand;
    this.traceability = traceability;
    this.config = config;
  }

  /**
   * @param {object} params
   * @param {string | null} params.season
   * @param {string | null} params.month
   * @param {object} params.timeInfo
   * @returns {Promise<void>}
   */
  async execute({ season, month, timeInfo }) {
    // ONE time context for every step (producers, hubs, sale windows): a schedule names whichever field
    // it cares about (season, month, monthIndex, year, dayInMonth), whatever kind of building reads it.
    const timeContext = {
      season,
      month,
      monthIndex: timeInfo.monthIndex,
      year: timeInfo.year ?? 0,
      dayInMonth: timeInfo.dayInMonth ?? 1,
      // The tick itself: what a hub remembers of its clients is told per tick.
      turn: timeInfo.turn ?? timeInfo.days ?? 0,
    };

    // Measurement only: the milliseconds each step of the tick took, reported at its end (dev builds).
    const stageMs = {};
    let stageStartedAt = performance.now();
    const lap = (stage) => {
      const now = performance.now();
      stageMs[stage] = now - stageStartedAt;
      stageStartedAt = now;
    };

    // First, so what has outlived its shelf life is gone before this tick moves, sells or eats anything.
    await this.#ageStocks(timeContext);
    lap('aging');

    // No season gate here — each producer's own 'producer' schedule (see
    // buildingEconomy.js) decides whether it's an active period; the
    // once-per-year lock in ProduceResource still prevents double-production
    // across the months a season spans.
    await this.runProducerCommand.execute({
      role: 'producer',
      buildParams: (source) => ({
        buildingId: source.id,
        period: timeContext,
      }),
      successKey: 'produced',
    });
    lap('produce');

    await this.traceability.recordChainStates(timeInfo);
    await this.traceability.recordPopulationStates(timeInfo);
    lap('states');

    const surplus = await this.runHubSurplusCycle.execute(timeContext);

    await this.traceability.recordHubCollections(timeInfo, surplus.hubs);
    await this.traceability.recordHarvestSales(timeInfo, surplus.hubs);
    lap('hubCollection');

    await this.runCityResourceCycle.execute({
      categories: this.config.categories,
      season,
      month,
      timeInfo,
    });
    lap('marketCycle');

    await this.updateDistributorReach.execute({
      category: this.config.reachCategories ?? this.config.categories,
    });
    lap('reach');

    // Every need citizens have is used up the same way, one pass each (the diet, the goods they wear
    // out...). Each need is traced individually so the panel can show demand vs. taken per need type.
    for (const need of listQuantityConsumerNeeds()) {
      const { results } = await this.runConsumerCommand.execute({
        role: 'consumer',
        categories: need.categories,
        buildParams: (house) => ({
          buildingId: house.id,
          period: { monthIndex: timeInfo.monthIndex },
          category: need.categories[0],
        }),
        successKey: 'consumed',
      });
      await this.traceability.recordHouseConsumptions(
        timeInfo,
        results.map((r) => ({ ...r, houseId: r.buildingId })),
        need.totalKey
      );
    }
    lap('consumption');
    if (import.meta.env?.DEV) {
      console.info(`[tick-perf] supply.cycle ${Object.entries(stageMs).map(([stage, ms]) => `${stage}=${ms.toFixed(1)}`).join(' ')}`);
    }
  }

  /**
   * Every building keeping a good that can go bad: its batches are brought in step with its stock, and what has outlived its shelf life is
   * thrown away and traced. A good of infinite life is not aged at all (see StockAgingPolicy.js); the place's `shelfLifeFactor` (a hub role)
   * stretches the life of what it keeps.
   * @param {{ turn: number }} timeContext
   */
  async #ageStocks(timeContext) {
    const { supplyBuildingRepository, recordSpoilage } = this.aging;
    const services = new Set(getServiceCategories());
    const daysPerMonth = TimeManager.DAYS_PER_MONTH;
    const seen = new Set();

    for (const role of KEEPING_ROLES) {
      for (const building of await supplyBuildingRepository.findByResourceRole(role)) {
        if (seen.has(building.id)) continue;
        seen.add(building.id);

        let stocks = building.stocks;
        const ageBook = { ...(building.stockAges ?? {}) };
        let changed = false;
        const lostByCategory = [];
        const done = new Set();

        for (const keepingRole of KEEPING_ROLES) {
          for (const entry of listRoleEntries(building.type, keepingRole)) {
            for (const category of entry.categories) {
              if (done.has(category)) continue;
              done.add(category);
              if (services.has(category) || (!(category in ageBook) && !(stocks[category] > 0))) continue;
              const lifeTurns = shelfLifeTurnsAt(building.type, category, daysPerMonth);
              if (lifeTurns === Infinity) continue;

              const reconciled = reconcileAges(ageBook[category], stocks[category] ?? 0, timeContext.turn);
              const { kept, lost } = expireAges(reconciled, timeContext.turn, lifeTurns);
              if (JSON.stringify(kept) !== JSON.stringify(ageBook[category] ?? [])) {
                ageBook[category] = kept;
                changed = true;
              }
              if (lost > 0) {
                // What spoils leaves its total as what was harvested put into it (see stockShapeFor), not a total of the role's own.
                const shape = stockShapeFor(category, entry.totalKey);
                stocks = { ...stocks, ...takeCategoryAmount(stocks, category, lost, shape.categories, shape.totalKey) };
                lostByCategory.push({ category, quantity: lost });
              }
            }
          }
        }

        if (lostByCategory.length > 0) await supplyBuildingRepository.saveStocks(building.id, stocks);
        if (changed) await supplyBuildingRepository.updateBuildingFields(building.id, { stockAges: ageBook });
        for (const { category, quantity } of lostByCategory) {
          await recordSpoilage({ period: timeContext, building, category, quantity });
        }
      }
    }
  }
}
