/**
 * Per-turn commerce simulation — partner trades and yearly resets.
 */
export class RunCommerceTurn {
  /** @param {import('../services/CommerceSimulationService.js').CommerceSimulationService} simulation */
  constructor(simulation) {
    this.simulation = simulation;
  }

  /** @param {object} _city @param {number} [time] */
  async execute(_city, time = 0) {
    const simulation = this.simulation;
    const timeInfo = simulation.getTimeInfo(time);

    simulation.loadPartners();

    if (timeInfo.year !== simulation.lastProcessedYear) {
      if (simulation.lastProcessedYear !== -1) {
        simulation.yearlyImports = {};
        simulation.yearlyExports = {};
        simulation.commerceRepository.resetYearlyStats();

        if (simulation.partnersData) {
          simulation.partnersData.forEach((partner) => {
            partner.buysFromUs?.forEach((line) => {
              line.currentYearly = 0;
            });
            partner.sellsToUs?.forEach((line) => {
              line.currentYearly = 0;
            });
          });
          simulation.commerceRepository.savePartners(simulation.partnersData);
        }
      }
      simulation.lastProcessedYear = timeInfo.year;
    }

    const config = simulation.commerceRepository.loadConfig();
    if (!config) {
      return { imports: [], exports: [] };
    }

    simulation.loadPartners();

    const imports = [];
    const exports = [];

    if (simulation.partnersData) {
      for (const partner of simulation.partnersData) {
        for (const sellLine of partner.sellsToUs ?? []) {
          if (simulation.canTradeWithPartner(partner.id, sellLine.productId, 'import', time)) {
            const limit = simulation.getPartnerTradeLimit(partner.id, sellLine.productId, 'import');
            const quantity = limit ? Math.min(limit.maxPerTurn, 1) : 1;

            const importResult = await simulation.processProductImportCommand.execute({
              productId: sellLine.productId,
              time,
              quantity,
              partnerId: partner.id,
            });
            if (importResult) {
              imports.push(importResult);
            }
          }
        }

        for (const buyLine of partner.buysFromUs ?? []) {
          if (simulation.canTradeWithPartner(partner.id, buyLine.productId, 'export', time)) {
            const limit = simulation.getPartnerTradeLimit(partner.id, buyLine.productId, 'export');
            const quantity = limit ? Math.min(limit.maxPerTurn, 1) : 1;

            const exportResult = await simulation.processProductExportCommand.execute({
              productId: buyLine.productId,
              time,
              quantity,
              partnerId: partner.id,
            });
            if (exportResult) {
              exports.push(exportResult);
            }
          }
        }
      }
    }

    return { imports, exports };
  }
}
