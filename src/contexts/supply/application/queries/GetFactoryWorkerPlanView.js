import {
  FACTORY_BUILDING_MAX_WORKERS,
  computeFactoryCommodityWorkerDemand,
  computeFactoryTotalWorkerNeed,
  computeFactoryProductWorkerDistribution,
  listFactoryCommodityLinesForFactory,
} from '../../domain/manufacturing/FactoryProductWorkerDistributionPolicy.js';
import { isFactoryCommodityProductionEnabled } from '../../domain/manufacturing/FactoryCommodityProductionPolicy.js';

/**
 * Read model for factory admin UI — worker demand/allocation derived from line caps.
 */
export class GetFactoryWorkerPlanView {
  /**
   * @param {object} params
   * @param {object|null|undefined} params.factory
   * @param {Record<string, number>} [params.lineMaxCaps]
   * @param {Record<string, boolean>} [params.commodityProductionEnabled]
   */
  execute({ factory, lineMaxCaps, commodityProductionEnabled } = {}) {
    if (!factory) {
      return Object.freeze({
        buildingMaxWorkers: FACTORY_BUILDING_MAX_WORKERS,
        totalWorkerNeed: 0,
        lines: Object.freeze([]),
      });
    }

    const previewFactory = lineMaxCaps || commodityProductionEnabled
      ? {
          ...factory,
          ...(lineMaxCaps
            ? {
                lineMaxCaps: {
                  ...(factory.lineMaxCaps || {}),
                  ...lineMaxCaps,
                },
              }
            : {}),
          ...(commodityProductionEnabled
            ? {
                commodityProductionEnabled: {
                  ...(factory.commodityProductionEnabled || {}),
                  ...commodityProductionEnabled,
                },
              }
            : {}),
        }
      : factory;

    const distribution = computeFactoryProductWorkerDistribution(previewFactory);
    const lines = listFactoryCommodityLinesForFactory(previewFactory).map((commodityId) =>
      Object.freeze({
        commodityId,
        productionEnabled: isFactoryCommodityProductionEnabled(previewFactory, commodityId),
        workerDemand: computeFactoryCommodityWorkerDemand(previewFactory, commodityId),
        workersAllocated: distribution[commodityId] || 0,
      })
    );

    return Object.freeze({
      buildingMaxWorkers: FACTORY_BUILDING_MAX_WORKERS,
      totalWorkerNeed: computeFactoryTotalWorkerNeed(previewFactory),
      lines: Object.freeze(lines),
    });
  }
}
