
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
  500, // 9
  350, // 10
  250, // 11
  150, // 12
  80, // 13 — max. GameLoop's in-flight guard skips a tick rather than piling
  // up lag if a tick's own work outlasts the interval, so this ceiling is safe
  // to raise further later — it degrades to "as fast as a tick actually runs", never backs up.
]);

/**
 * Simulated days advanced per GameLoop tick fire, same index as SPEED_LEVELS_MS.
 * Levels 1-9 present every day (one day per tick, full render). Past that, a single
 * tick's own render cost (scene.update's mesh sync) already exceeds the requested
 * interval, so shortening the interval further has no visible effect — see
 * project_game_speed_fast_forward_deferred memory. Levels 10-13 instead batch several
 * simulated days per tick fire: interim days run the simulation (ECS + economy) only,
 * skipping scene/HUD/notification presentation (see runGameTick's `silent` option),
 * and only the batch's last day renders — Caesar-3-style fast-forward, not a shorter clock.
 */
export const SPEED_LEVELS_DAYS = Object.freeze([
  1, 1, 1, 1, 1, 1, 1, 1, 1, // 1-9
  2, // 10
  4, // 11
  8, // 12
  16, // 13 — max
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
 * @param {number} level 1-based speed level
 * @returns {number} simulated days to batch-advance per tick fire
 */
export function speedLevelToDays(level) {
  const clamped = Math.max(SPEED_LEVEL_MIN, Math.min(SPEED_LEVEL_MAX, Math.round(level)));
  return SPEED_LEVELS_DAYS[clamped - 1];
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

/**
 * Keeps a ms value within the ladder's overall range WITHOUT forcing it onto one of the discrete
 * steps — for a direct numeric control (seconds-per-turn in Settings) that wants a precise value,
 * not just the nearest of 13 presets. The +/- HUD buttons still store an exact ladder step, so
 * clamping them is a no-op; only a fine-tuned value actually differs from snapTickMs here.
 * @param {number} ms
 * @returns {number}
 */
export function clampTickMs(ms) {
  const value = Number(ms);
  if (!Number.isFinite(value)) return DEFAULT_TICK_MS;
  return Math.max(TICK_MS_MIN, Math.min(TICK_MS_MAX, value));
}

/** @returns {{ tickMsMin: number, tickMsMax: number, defaultTickMs: number, citySize: number, speedLevelMin: number, speedLevelMax: number, defaultSpeedLevel: number }} */
export function getSimulationDefaults() {
  return {
    tickMsMin: TICK_MS_MIN,
    tickMsMax: TICK_MS_MAX,
    defaultTickMs: DEFAULT_TICK_MS,
    speedLevelMin: SPEED_LEVEL_MIN,
    speedLevelMax: SPEED_LEVEL_MAX,
    defaultSpeedLevel: DEFAULT_SPEED_LEVEL,
    citySize: DEFAULT_CITY_SIZE,
  };
}
