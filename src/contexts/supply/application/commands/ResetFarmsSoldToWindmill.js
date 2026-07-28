/**
 * Command: clear farm `soldToWindmill` UI flags (outside December / day-1 reset).
 */
export class ResetFarmsSoldToWindmill {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} [params]
   * @param {boolean} [params.onlyIfSet=true] - skip farms already false (fewer writes)
   * @returns {Promise<{ farms: number, cleared: number }>}
   */
  async execute({ onlyIfSet = true } = {}) {
    const farms = await this.supplyBuildingRepository.findFarms();
    let cleared = 0;

    for (const farm of farms) {
      const view = await this.supplyBuildingRepository.findSupplyView(farm.id);
      if (!view) continue;
      if (onlyIfSet && view.soldToWindmill !== true) continue;

      await this.supplyBuildingRepository.saveMarketFlags(farm.id, {
        soldToWindmill: false,
      });
      cleared += 1;
    }

    return { farms: farms.length, cleared };
  }
}
