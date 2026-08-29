/**
 * Cheat code activations — dedicated IndexedDB table (`cheatCodes`).
 */

import db from '../dexie/db.js';

/**
 * @typedef {{
 *   code: string,
 *   activatedAt: string,
 *   activationCount: number,
 *   lastMeta?: Record<string, unknown>,
 * }} CheatCodeRecord
 */

/**
 * @param {string} code
 * @returns {string}
 */
export function normalizeCheatCode(code) {
  return String(code ?? '').trim();
}

/**
 * @param {string} code
 * @param {Record<string, unknown>} [meta]
 * @returns {Promise<CheatCodeRecord>}
 */
export async function recordCheatActivation(code, meta = {}) {
  const normalized = normalizeCheatCode(code);
  if (!normalized) {
    throw new Error('cheatCodeRepository: empty code');
  }

  const existing = await db.cheatCodes.get(normalized);
  const next = {
    code: normalized,
    activatedAt: new Date().toISOString(),
    activationCount: (existing?.activationCount ?? 0) + 1,
    lastMeta: meta,
  };
  await db.cheatCodes.put(next);
  return next;
}

/**
 * @returns {Promise<CheatCodeRecord[]>}
 */
export async function listCheatActivations() {
  return db.cheatCodes.toArray();
}

/**
 * @param {string} code
 * @returns {Promise<CheatCodeRecord | undefined>}
 */
export async function getCheatActivation(code) {
  return db.cheatCodes.get(normalizeCheatCode(code));
}
