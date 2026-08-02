import {
  createDefaultPartners,
  migrateStoredPartners,
} from '../../domain/catalogs/PartnerCatalog.js';
import { createDefaultProductConfig, normalizeStoredProductConfig } from '../../domain/catalogs/ProductConfigCatalog.js';

/**
 * localStorage adapter — commerce config, stats, partners.
 */
export class LocalStorageCommerceRepository {
  constructor(storage = typeof localStorage !== 'undefined' ? localStorage : null) {
    this.storage = storage;
    this.STORAGE_KEY_CONFIG = 'commerce_config';
    this.STORAGE_KEY_STATS = 'commerce_stats';
    this.STORAGE_KEY_PARTNERS = 'commerce_partners';
  }

  /** @param {Array} goodsData */
  saveConfig(goodsData) {
    try {
      this.storage?.setItem(this.STORAGE_KEY_CONFIG, JSON.stringify(goodsData));
    } catch (error) {
      console.warn('[CommerceRepository] Error saving config:', error);
    }
  }

  loadConfig() {
    try {
      const stored = this.storage?.getItem(this.STORAGE_KEY_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (error) {
      console.warn('[CommerceRepository] Error loading config:', error);
    }
    return null;
  }

  loadOrSeedConfig() {
    const existing = this.loadConfig();
    if (existing) {
      const normalized = normalizeStoredProductConfig(existing);
      this.saveConfig(normalized);
      return normalized;
    }
    const defaults = createDefaultProductConfig();
    this.saveConfig(defaults);
    return defaults;
  }

  /** @param {string} productId */
  getProductConfig(productId) {
    const config = this.loadConfig();
    if (!config) {
      return null;
    }
    return config.find((g) => g.id === productId) || null;
  }

  /** @param {object} stats */
  saveStats(stats) {
    try {
      this.storage?.setItem(this.STORAGE_KEY_STATS, JSON.stringify(stats));
    } catch (error) {
      console.warn('[CommerceRepository] Error saving stats:', error);
    }
  }

  loadStats() {
    try {
      const stored = this.storage?.getItem(this.STORAGE_KEY_STATS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[CommerceRepository] Error loading stats:', error);
    }
    return null;
  }

  /** @param {string} productId @param {object} productStats */
  updateProductStats(productId, productStats) {
    const currentStats = this.loadStats() || { yearlyImports: {}, yearlyExports: {} };

    if (!currentStats.yearlyImports) currentStats.yearlyImports = {};
    if (!currentStats.yearlyExports) currentStats.yearlyExports = {};

    if (productStats.imports !== undefined) {
      currentStats.yearlyImports[productId] = productStats.imports;
    }
    if (productStats.exports !== undefined) {
      currentStats.yearlyExports[productId] = productStats.exports;
    }

    this.saveStats(currentStats);
  }

  resetYearlyStats() {
    this.saveStats({
      yearlyImports: {},
      yearlyExports: {},
    });
  }

  loadPartners() {
    try {
      const stored = this.storage?.getItem(this.STORAGE_KEY_PARTNERS);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.warn('[CommerceRepository] Error loading partners:', error);
    }
    return null;
  }

  loadOrSeedPartners() {
    const stored = this.loadPartners();
    if (stored) {
      try {
        const { partners, needsSave } = migrateStoredPartners(stored);
        if (needsSave) {
          this.savePartners(partners);
        }
        return partners;
      } catch (_error) {
        const defaults = createDefaultPartners();
        this.savePartners(defaults);
        return defaults;
      }
    }

    const defaults = createDefaultPartners();
    this.savePartners(defaults);
    return defaults;
  }

  /** @param {Array} partnersData */
  savePartners(partnersData) {
    try {
      this.storage?.setItem(this.STORAGE_KEY_PARTNERS, JSON.stringify(partnersData));
    } catch (error) {
      console.warn('[CommerceRepository] Error saving partners:', error);
    }
  }

  clear() {
    try {
      this.storage?.removeItem(this.STORAGE_KEY_CONFIG);
      this.storage?.removeItem(this.STORAGE_KEY_STATS);
      this.storage?.removeItem(this.STORAGE_KEY_PARTNERS);
    } catch (error) {
      console.warn('[CommerceRepository] Error clearing:', error);
    }
  }
}
