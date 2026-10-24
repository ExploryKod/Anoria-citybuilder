import db from '../../../../core/persistence/dexie/db.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * Per-skill employment priorities (the player's settings), one set per hamlet: they live on the hamlet's own row (`employmentSkillPriorities`), so they
 * belong to the game, follow it, and a hamlet's priorities never touch another's. The player sets those of the hamlet they are in.
 *
 * Read from memory, never from the database at the moment of use: the monthly redistribution reads them on every tick and the panel on every key.
 * `preload(hamletId)` fills the memory when a hamlet becomes the active one (boot, travel); reading before that throws, never answers the defaults.
 * No row field yet means the player has changed nothing there (the catalog's default ranks apply, see SkillPriorityPolicy.js).
 */
export class DexieHamletSkillPriorityRepository {
  /** @type {Map<string, Record<string, number>>} hamlet id → its stored overrides */
  #loaded = new Map();

  /** @param {typeof db} [database] */
  constructor(database = db) {
    this.db = database;
  }

  /** @param {string} hamletId */
  async preload(hamletId) {
    const row = await this.db.hamlets.get(hamletId);
    if (!row) throw new Error(`[employment] hamlet ${hamletId} has no row: its skill priorities cannot be read`);
    this.#loaded.set(hamletId, { ...(row.employmentSkillPriorities ?? {}) });
  }

  /** @returns {Record<string, number>} the active hamlet's overrides */
  loadUserPriorities() {
    const hamletId = requireActiveHamletId();
    const priorities = this.#loaded.get(hamletId);
    if (!priorities) throw new Error(`[employment] the skill priorities of hamlet ${hamletId} are not loaded: preload(hamletId) runs when a hamlet becomes active`);
    return priorities;
  }

  /** @param {Record<string, number>} priorities the active hamlet's overrides */
  saveUserPriorities(priorities) {
    const hamletId = requireActiveHamletId();
    this.#loaded.set(hamletId, { ...priorities });
    this.db.hamlets.update(hamletId, { employmentSkillPriorities: { ...priorities } }).catch((error) => {
      console.error(`[employment] the skill priorities of hamlet ${hamletId} could not be saved:`, error);
    });
  }
}
