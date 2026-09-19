import { WALKER_ASSETS, WALKER_TYPES } from '../assets/walkerAssets.js';

/**
 * Index into a pool for a `pick` strategy.
 *
 * @param {'sequence' | 'random' | undefined} pick
 * @param {number} length pool size
 * @param {number} counter walkers of this type spawned before
 * @param {() => number} random
 * @returns {number}
 */
export function pickAppearanceIndex(pick, length, counter, random) {
  if (pick === 'random') {
    return Math.min(length - 1, Math.floor(random() * length));
  }
  return ((counter % length) + length) % length;
}

/**
 * Picks the visual (WALKER_ASSETS id) for a walker type, per the type's
 * declarative pool and `pick` strategy.
 *
 * @param {string} walkerType key of WALKER_TYPES
 * @param {number} [counter] how many walkers of this type were spawned before (drives 'sequence')
 * @param {() => number} [random] injectable RNG for 'random' (defaults to Math.random)
 * @returns {string}
 */
export function resolveWalkerAppearanceId(walkerType, counter = 0, random = Math.random) {
  const type = WALKER_TYPES[walkerType];
  if (!type?.appearances?.length) {
    throw new Error(`[walkerAppearance] Unknown walker type "${walkerType}" — declare it in walkerAssets.js WALKER_TYPES`);
  }
  const { appearances, pick } = type;
  return appearances[pickAppearanceIndex(pick, appearances.length, counter, random)];
}

/**
 * @param {string} appearanceId
 * @returns {typeof WALKER_ASSETS[string]}
 */
export function getWalkerAsset(appearanceId) {
  const asset = WALKER_ASSETS[appearanceId];
  if (!asset) {
    throw new Error(`[walkerAppearance] No walker asset "${appearanceId}" — declare it in walkerAssets.js WALKER_ASSETS`);
  }
  return asset;
}

/**
 * Which clip plays for a role ('idle', 'walk'): the first name the asset
 * declares that the model really has. With no declared name available, idle
 * falls back to the model's first clip and walk to its second (or null).
 *
 * @param {string} appearanceId
 * @param {string} role
 * @param {ReadonlyArray<string>} availableClipNames
 * @returns {string | null}
 */
export function resolveWalkerClipName(appearanceId, role, availableClipNames) {
  const declared = getWalkerAsset(appearanceId).animations?.[role] ?? [];
  const match = declared.find((name) => availableClipNames.includes(name));
  if (match) return match;
  if (role === 'idle') return availableClipNames[0] ?? null;
  if (role === 'walk') return availableClipNames[1] ?? null;
  return null;
}
