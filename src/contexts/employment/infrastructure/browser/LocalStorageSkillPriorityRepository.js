/**
 * localStorage adapter — per-skill employment priorities (player settings).
 *
 * New key (`employment_skill_priorities`), not a migration of the old
 * `employment_priorities` (sector-keyed) — that shape is meaningless once
 * priorities are keyed by skill id, so it's simply abandoned; a returning
 * player just gets catalog defaults again, no save-critical data is lost.
 */
export class LocalStorageSkillPriorityRepository {
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
    this.PRIORITIES_STORAGE_KEY = 'employment_skill_priorities';
  }

  /** @returns {Record<string, number>} */
  loadUserPriorities() {
    try {
      const stored = this.storage?.getItem(this.PRIORITIES_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('[SkillPriorityRepository] Error reading priorities:', err);
    }
    return {};
  }

  /** @param {Record<string, number>} priorities */
  saveUserPriorities(priorities) {
    try {
      this.storage?.setItem(this.PRIORITIES_STORAGE_KEY, JSON.stringify(priorities));
    } catch (err) {
      console.error('[SkillPriorityRepository] Error saving priorities:', err);
    }
  }
}
