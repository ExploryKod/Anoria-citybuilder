import { listQuantityConsumerNeeds } from '../../../../shared/building-catalog/resourceRoleQueries.js';

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
   * @param {{ recordHouseConsumptions: Function, recordChainStates: Function, recordPopulationStates: Function, recordBuildingStates: Function, recordHarvestSales: Function }} traceability
   * @param {object} config
   * @param {ReadonlyArray<string>} config.categories Every category any
   *   distributor covers — drives the actual distribution/restock leg,
   *   deliberately broader than just food (see createSupplyContext.js).
   * @param {ReadonlyArray<string>} [config.reachCategories] Narrower set
   *   the too-far reach check (`updateDistributorReach`) scopes to — keep
   *   this to just food's categories so a hub-less service like a chapel
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
    config
  ) {
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

    await this.traceability.recordChainStates(timeInfo);
    await this.traceability.recordPopulationStates(timeInfo);

    const surplus = await this.runHubSurplusCycle.execute(timeContext);

    await this.traceability.recordHarvestSales(timeInfo, surplus.hubs);

    await this.runCityResourceCycle.execute({
      categories: this.config.categories,
      season,
      month,
      timeInfo,
    });

    await this.updateDistributorReach.execute({
      category: this.config.reachCategories ?? this.config.categories,
    });

    // Every need citizens have is used up the same way, one pass each (the diet, the goods they wear
    // out...). The traceability follows the first: the primary need.
    let consumptions = [];
    for (const [index, need] of listQuantityConsumerNeeds().entries()) {
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
      if (index === 0) consumptions = results;
    }

    await this.traceability.recordHouseConsumptions(
      timeInfo,
      consumptions.map((r) => ({ ...r, houseId: r.buildingId }))
    );

    // Last, so the state is what the tick ended with — after collection, distribution and
    // the meal — and not what it started from.
    await this.traceability.recordBuildingStates(timeInfo);
  }
}
