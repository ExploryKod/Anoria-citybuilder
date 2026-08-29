/**
 * Cheat code registry and side effects.
 */

import { recordCheatActivation, normalizeCheatCode } from '../core/persistence/cheat/cheatCodeRepository.js';
import { unlockAllHamlets } from '../core/persistence/hamlet/hamletAccess.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getTimeManager } from './sessionShell.js';
import { syncSessionHud } from './syncSessionHud.js';

/** @typedef {{ ok: true, code: string, message: string } | { ok: false, reason: string }} CheatApplyResult */

const CHEAT_HANDLERS = Object.freeze({
  treasury: applyTreasuryCheat,
  hamletsall: applyHamletsAllCheat,
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
 * @param {string} rawCode
 * @returns {Promise<CheatApplyResult>}
 */
export async function applyCheatCode(rawCode) {
  const key = resolveCheatKey(rawCode);
  if (!key) {
    return { ok: false, reason: 'empty' };
  }

  const handler = CHEAT_HANDLERS[key];
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
