import { DEFAULT_FOOD_DISTRIBUTION_DISTANCE } from '../../contexts/supply/domain/catalogs/SupplySimulationCatalog.js';

export const TICK_MS_MIN = 500;
export const TICK_MS_MAX = 20000;
export const DEFAULT_TICK_MS = 4000;
export const DEFAULT_CITY_SIZE = 12;

/** @returns {{ tickMsMin: number, tickMsMax: number, defaultTickMs: number, citySize: number, foodDistributionDistance: number }} */
export function getSimulationDefaults() {
  return {
    tickMsMin: TICK_MS_MIN,
    tickMsMax: TICK_MS_MAX,
    defaultTickMs: DEFAULT_TICK_MS,
    citySize: DEFAULT_CITY_SIZE,
    foodDistributionDistance: DEFAULT_FOOD_DISTRIBUTION_DISTANCE,
  };
}
