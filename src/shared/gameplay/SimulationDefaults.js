import { DEFAULT_FOOD_DISTRIBUTION_DISTANCE } from '../../contexts/supply/domain/catalogs/SupplySimulationCatalog.js';

/**
 * Discrete speed ladder for the player UI (1 = slowest … N = fastest).
 * Under the hood each step maps to a turn interval in ms.
 */
export const SPEED_LEVELS_MS = Object.freeze([
  16000, // 1 — très lent
  12000, // 2
  8000, // 3
  6000, // 4
  4000, // 5 — normal (défaut)
  3000, // 6
  2000, // 7
  1000, // 8
  500, // 9 — max
]);

/** 1-based index into SPEED_LEVELS_MS */
export const DEFAULT_SPEED_LEVEL = 5;
export const SPEED_LEVEL_MIN = 1;
export const SPEED_LEVEL_MAX = SPEED_LEVELS_MS.length;

export const DEFAULT_TICK_MS = SPEED_LEVELS_MS[DEFAULT_SPEED_LEVEL - 1];
export const TICK_MS_MIN = SPEED_LEVELS_MS[SPEED_LEVEL_MAX - 1];
export const TICK_MS_MAX = SPEED_LEVELS_MS[0];
export const DEFAULT_CITY_SIZE = 12;

/**
 * @param {number} level 1-based speed level
 * @returns {number} turn interval in ms
 */
export function speedLevelToMs(level) {
  const clamped = Math.max(SPEED_LEVEL_MIN, Math.min(SPEED_LEVEL_MAX, Math.round(level)));
  return SPEED_LEVELS_MS[clamped - 1];
}

/**
 * Snap any ms value (incl. legacy localStorage) to the nearest ladder step,
 * then return the 1-based level (higher = faster).
 * @param {number} ms
 * @returns {number}
 */
export function msToSpeedLevel(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) {
    return DEFAULT_SPEED_LEVEL;
  }
  let bestLevel = DEFAULT_SPEED_LEVEL;
  let bestDist = Infinity;
  for (let i = 0; i < SPEED_LEVELS_MS.length; i += 1) {
    const dist = Math.abs(SPEED_LEVELS_MS[i] - value);
    if (dist < bestDist) {
      bestDist = dist;
      bestLevel = i + 1;
    }
  }
  return bestLevel;
}

/**
 * @param {number} ms
 * @returns {number} nearest ladder interval in ms
 */
export function snapTickMs(ms) {
  return speedLevelToMs(msToSpeedLevel(ms));
}

/** @returns {{ tickMsMin: number, tickMsMax: number, defaultTickMs: number, citySize: number, foodDistributionDistance: number, speedLevelMin: number, speedLevelMax: number, defaultSpeedLevel: number }} */
export function getSimulationDefaults() {
  return {
    tickMsMin: TICK_MS_MIN,
    tickMsMax: TICK_MS_MAX,
    defaultTickMs: DEFAULT_TICK_MS,
    speedLevelMin: SPEED_LEVEL_MIN,
    speedLevelMax: SPEED_LEVEL_MAX,
    defaultSpeedLevel: DEFAULT_SPEED_LEVEL,
    citySize: DEFAULT_CITY_SIZE,
    foodDistributionDistance: DEFAULT_FOOD_DISTRIBUTION_DISTANCE,
  };
}
