/**
 * Orchestration: monthly windmill surplus cycle (flags, December collection, sales reset).
 */
export class RunWindmillSurplusCycle {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {import('./MarkWindmillCollectingSeason.js').MarkWindmillCollectingSeason} markWindmillCollectingSeason
   * @param {import('./ResetFarmsSoldToWindmill.js').ResetFarmsSoldToWindmill} resetFarmsSoldToWindmill
   * @param {import('./ProcessWindmillCollection.js').ProcessWindmillCollection} processWindmillCollection
   * @param {{ execute: (params: { windmillId: string }) => Promise<unknown> }} [rebalanceWindmillMarketAllocations]
   *   Any collaborator with this shape — composition wires the generic
   *   RebalanceHubAllocations behind an adapter that supplies food's categories.
   */
  constructor(
    supplyBuildingRepository,
    markWindmillCollectingSeason,
    resetFarmsSoldToWindmill,
    processWindmillCollection,
    rebalanceWindmillMarketAllocations = null
  ) {
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.markWindmillCollectingSeason = markWindmillCollectingSeason;
    this.resetFarmsSoldToWindmill = resetFarmsSoldToWindmill;
    this.processWindmillCollection = processWindmillCollection;
    this.rebalanceWindmillMarketAllocations = rebalanceWindmillMarketAllocations;
  }

  /**
   * @param {object} params
   * @param {string | null} params.month - English month label
   * @param {number} params.monthIndex - 0-based month index (11 = December)
   * @param {number} params.dayInMonth
   * @param {number} params.year
   * @returns {Promise<{ ranCollection: boolean, windmills?: object[] }>}
   */
  async execute({ month, monthIndex, dayInMonth, year }) {
    const isDecember = monthIndex === 11;

    if (!isDecember) {
      if (month) {
        await this.markWindmillCollectingSeason.execute(month);
      }
      await this.resetFarmsSoldToWindmill.execute({ onlyIfSet: true });
      return { ranCollection: false };
    }

    if (dayInMonth === 1) {
      await this.supplyBuildingRepository.resetFarmSalesForYear(year);
      await this.resetFarmsSoldToWindmill.execute({ onlyIfSet: false });
    }

    if (month) {
      await this.markWindmillCollectingSeason.execute(month);
    }

    const windmills = await this.supplyBuildingRepository.findWindmills();
    const farms = await this.supplyBuildingRepository.findFarms();
    const farmRefs = farms.map((farm) => ({
      id: farm.id,
      type: farm.type,
      x: farm.x,
      y: farm.y,
    }));

    const windmillResults = [];
    for (const windmill of windmills) {
      const outcome = await this.processWindmillCollection.execute({
        windmillId: windmill.id,
        farmRefs,
        month,
        year,
      });
      windmillResults.push(outcome);

      if (outcome.collected && this.rebalanceWindmillMarketAllocations) {
        await this.rebalanceWindmillMarketAllocations.execute({ windmillId: windmill.id });
      }
    }

    return { ranCollection: true, windmills: windmillResults };
  }
}
