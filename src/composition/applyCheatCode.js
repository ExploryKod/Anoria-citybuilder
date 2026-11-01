/**
 * Cheat code registry and side effects.
 */

import { recordCheatActivation, normalizeCheatCode } from '../core/persistence/cheat/cheatCodeRepository.js';
import { GAME_CHEAT_FLAGS, writeGameCheatFlag } from '../core/persistence/cheat/gameCheatFlags.js';
import { isCheatCodesAllowed } from '../config/cheatCodes.js';
import { unlockAllHamlets } from '../core/persistence/hamlet/hamletAccess.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getTimeManager } from './sessionShell.js';
import { syncSessionHud } from './syncSessionHud.js';

/** @typedef {{ ok: true, code: string, message: string } | { ok: false, reason: string }} CheatApplyResult */

/**
 * The codes, by the lowercase word the player types. Two kinds: a one-shot (Treasury, HamletsAll: does something once) and a game flag
 * (GetLastLevel: a rule of this game changed for good, recorded in the game and read by the engine — see gameCheatFlags.js).
 * A new code is one entry here.
 */
const CHEAT_HANDLERS = Object.freeze({
  treasury: applyTreasuryCheat,
  hamletsall: applyHamletsAllCheat,
  getlastlevel: applyGetLastLevelCheat,
});

/**
 * @param {string} rawCode
 * @returns {string | null}
 */
function resolveCheatKey(rawCode) {
  const normalized = normalizeCheatCode(rawCode);
  if (!normalized) return null;
  return normalized.toLowerCase();
}

/**
 * @returns {Promise<CheatApplyResult>}
 */
async function applyTreasuryCheat() {
  const amount = 5000;
  const accounting = getOrCreateAccountingContext();
  const turn = getTimeManager()?.getCurrentTurn?.() ?? 0;

  const result = await accounting.recordCommerceExportIncome({
    turn,
    amount,
    description: 'Code triche : Treasury',
    productId: 'cheat_treasury',
  });

  if (!result.recorded) {
    return { ok: false, reason: result.reason ?? 'treasury_failed' };
  }

  await syncSessionHud();
  return { ok: true, code: 'Treasury', message: `+${amount} € ajoutés au trésor.` };
}

/**
 * @returns {Promise<CheatApplyResult>}
 */
async function applyHamletsAllCheat() {
  const unlocked = await unlockAllHamlets();
  return {
    ok: true,
    code: 'HamletsAll',
    message: unlocked > 0
      ? `${unlocked} hameau(x) débloqué(s).`
      : 'Tous les hameaux étaient déjà accessibles.',
  };
}

/**
 * Every house of this game goes to the highest level of its social category, whatever its services and requirements, and never goes down:
 * the engine reads the flag at each evolution pass (EvolveHouseBuilding). It is for building the later steps of the game without playing
 * up to them; it works only while cheat codes are allowed in Paramètres.
 * @returns {Promise<CheatApplyResult>}
 */
async function applyGetLastLevelCheat() {
  await writeGameCheatFlag(GAME_CHEAT_FLAGS.houseLevelsUnlocked, true);
  return {
    ok: true,
    code: 'GetLastLevel',
    message: 'Toutes les maisons passent au niveau maximum de leur catégorie, sans exigence, et ne redescendront plus.',
  };
}

/** The most inhabitants MaxPop<n> may ask for in a house: past it the simulation of the city (a citizen each) would no longer run. */
export const MAX_POP_CHEAT_LIMIT = 1000;

/**
 * Every house of this game holds exactly `count` inhabitants, filled at once: its ceiling and its count, at any level, whatever the level
 * normally allows. The engine reads the flag at each growth pass and each evolution pass (GrowHousePopulation, EvolveHouseBuilding).
 * @param {number} count
 * @returns {Promise<CheatApplyResult>}
 */
async function applyMaxPopCheat(count) {
  if (!Number.isInteger(count) || count < 1 || count > MAX_POP_CHEAT_LIMIT) {
    return { ok: false, reason: 'invalid_value' };
  }
  await writeGameCheatFlag(GAME_CHEAT_FLAGS.housePopulation, count);
  return {
    ok: true,
    code: `MaxPop${count}`,
    message: `Toutes les maisons sont remplies à ${count} habitant${count > 1 ? 's' : ''}, quel que soit leur niveau.`,
  };
}

/**
 * The codes that carry a number ("MaxPop12"): a word, then the whole number it is given.
 * @type {ReadonlyArray<{ word: string, apply: (count: number) => Promise<CheatApplyResult> }>}
 */
const NUMBERED_CHEATS = Object.freeze([
  { word: 'maxpop', apply: applyMaxPopCheat },
]);

/**
 * @param {string} key the lowercase code
 * @returns {(() => Promise<CheatApplyResult>) | null}
 */
function resolveCheatHandler(key) {
  if (CHEAT_HANDLERS[key]) return CHEAT_HANDLERS[key];
  for (const { word, apply } of NUMBERED_CHEATS) {
    const match = new RegExp(`^${word}(\\d+)$`).exec(key);
    if (match) return () => apply(Number(match[1]));
  }
  return null;
}

/**
 * @param {string} rawCode
 * @returns {Promise<CheatApplyResult>}
 */
export async function applyCheatCode(rawCode) {
  // First of all, before even saying whether the code exists: nothing opens unless the player allowed cheat codes (Paramètres).
  if (!isCheatCodesAllowed()) {
    return { ok: false, reason: 'not_allowed' };
  }
  const key = resolveCheatKey(rawCode);
  if (!key) {
    return { ok: false, reason: 'empty' };
  }

  const handler = resolveCheatHandler(key);
  if (!handler) {
    return { ok: false, reason: 'unknown' };
  }

  const displayCode = normalizeCheatCode(rawCode);
  const result = await handler();
  if (result.ok) {
    await recordCheatActivation(displayCode, { message: result.message });
  }
  return result;
}
