import { DexieCitizenRegistry } from '../shared/citizens/DexieCitizenRegistry.js';
import { getSessionGameTime } from './sessionRuntime.js';

/** @type {DexieCitizenRegistry | null} */
let shared = null;

/**
 * The game's one citizens registry: the housing, construction, parcels and accounting contexts share it, so its in-memory
 * reading is dropped by whoever changes the citizens.
 * @returns {DexieCitizenRegistry}
 */
export function getOrCreateCitizenRegistry() {
  if (!shared) {
    shared = new DexieCitizenRegistry({
      currentTurn: getSessionGameTime,
      random: () => Math.random(),
      newId: () => crypto.randomUUID(),
    });
  }
  return shared;
}

/** @internal Tests only */
export function resetCitizenRegistryForTests() {
  shared = null;
}
