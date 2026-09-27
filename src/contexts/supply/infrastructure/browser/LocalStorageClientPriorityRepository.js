/**
 * localStorage adapter — the player's client priorities per producer type (player settings, like the
 * employment priorities): for each producer type, the order in which the building types that buy its goods
 * are served and the ones it does not serve. No entry for a type means the catalog's defaults.
 */
export class LocalStorageClientPriorityRepository {
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
    this.STORAGE_KEY = 'supply_client_priorities';
  }

  /** @returns {Record<string, { order: string[], disabled: string[] }>} */
  load() {
    try {
      const stored = this.storage?.getItem(this.STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch (err) {
      console.warn('[ClientPriorityRepository] Error reading priorities:', err);
    }
    return {};
  }

  /** @param {Record<string, { order: string[], disabled: string[] }>} priorities */
  save(priorities) {
    try {
      this.storage?.setItem(this.STORAGE_KEY, JSON.stringify(priorities));
    } catch (err) {
      console.error('[ClientPriorityRepository] Error saving priorities:', err);
    }
  }
}
