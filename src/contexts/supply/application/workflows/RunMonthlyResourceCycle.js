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
   * @param {{ recordHouseConsumptions: Function, recordProducerStates: Function, recordHarvestSales: Function }} traceability
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
    // No season gate here — each producer's own 'producer' schedule (see
    // buildingEconomy.js) decides whether it's an active period; the
    // once-per-year lock in ProduceResource still prevents double-production
    // across the months a season spans.
    await this.runProducerCommand.execute({
      role: 'producer',
      buildParams: (source) => ({
        buildingId: source.id,
        period: { season, year: timeInfo.year ?? 0, monthIndex: timeInfo.monthIndex },
      }),
      successKey: 'produced',
    });

    await this.traceability.recordProducerStates(timeInfo);

    const surplus = await this.runHubSurplusCycle.execute({
      month,
      monthIndex: timeInfo.monthIndex,
      dayInMonth: timeInfo.dayInMonth ?? 1,
      year: timeInfo.year ?? 0,
    });

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

    const { results: consumptions } = await this.runConsumerCommand.execute({
      role: 'consumer',
      buildParams: (house) => ({
        buildingId: house.id,
        period: { monthIndex: timeInfo.monthIndex },
      }),
      successKey: 'consumed',
    });

    await this.traceability.recordHouseConsumptions(
      timeInfo,
      consumptions.map((r) => ({ ...r, houseId: r.buildingId }))
    );
  }
}
