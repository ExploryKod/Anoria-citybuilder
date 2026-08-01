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

    if (simulation.partnersData) {
      for (const partner of simulation.partnersData) {
        if (partner.isActive) {
          simulation.checkAndDeactivateFinishedContract(partner.id);
        }
      }
    }

    if (timeInfo.year !== simulation.lastProcessedYear) {
      if (simulation.lastProcessedYear !== -1) {
        simulation.yearlyImports = {};
        simulation.yearlyExports = {};
        simulation.commerceRepository.resetYearlyStats();

        if (simulation.partnersData) {
          simulation.partnersData.forEach((partner) => {
            partner.imports.forEach((imp) => {
              imp.currentYearly = 0;
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
        for (const importTrade of partner.exports) {
          if (simulation.canTradeWithPartner(partner.id, importTrade.productId, 'import', time)) {
            const limit = simulation.getPartnerTradeLimit(partner.id, importTrade.productId, 'import');
            const quantity = limit ? Math.min(limit.maxPerTurn, 1) : 1;

            const importResult = await simulation.processProductImportCommand.execute({
              productId: importTrade.productId,
              time,
              quantity,
              partnerId: partner.id,
            });
            if (importResult) {
              imports.push(importResult);
            }
          }
        }

        for (const exportTrade of partner.imports) {
          if (simulation.canTradeWithPartner(partner.id, exportTrade.productId, 'export', time)) {
            const limit = simulation.getPartnerTradeLimit(partner.id, exportTrade.productId, 'export');
            const quantity = limit ? Math.min(limit.maxPerTurn, 1) : 1;

            const exportResult = await simulation.processProductExportCommand.execute({
              productId: exportTrade.productId,
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

    if (timeInfo.dayInMonth === 1 && timeInfo.monthIndex !== simulation.lastResetMonth) {
      await simulation.windmillStock.resetImportsDisplay();
      simulation.lastResetMonth = timeInfo.monthIndex;
    }

    return { imports, exports };
  }
}
