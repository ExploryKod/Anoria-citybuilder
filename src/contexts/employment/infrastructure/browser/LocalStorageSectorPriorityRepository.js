import { DEFAULT_SECTOR_PRIORITIES } from '../../domain/catalogs/EmploymentSectorCatalog.js';

/**
 * localStorage adapter — employment sector priorities (player settings).
 */
export class LocalStorageSectorPriorityRepository {
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
    this.PRIORITIES_STORAGE_KEY = 'employment_priorities';
  }

  /** @returns {Record<number, number>} */
  loadUserPriorities() {
    try {
      const stored = this.storage?.getItem(this.PRIORITIES_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (err) {
      console.warn('[SectorPriorityRepository] Error reading priorities:', err);
    }
    return {};
  }

  /** @param {Record<number|string, number>} priorities */
  saveUserPriorities(priorities) {
    try {
      this.storage?.setItem(this.PRIORITIES_STORAGE_KEY, JSON.stringify(priorities));
    } catch (err) {
      console.error('[SectorPriorityRepository] Error saving priorities:', err);
    }
  }

  /** Initialize localStorage with defaults on first run. */
  ensureInitialized() {
    const userPriorities = this.loadUserPriorities();
    if (!userPriorities || Object.keys(userPriorities).length === 0) {
      this.saveUserPriorities({ ...DEFAULT_SECTOR_PRIORITIES });
    }
  }
}
