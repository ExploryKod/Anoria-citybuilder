import { getTradeCatalogEntry } from '../domain/catalogs/TradeCatalog.js';

/**
 * Whether a trade relation with `cityId` can be opened right now.
 *
 * Each openingRequirements key maps to one check function below.
 * To add a new condition: declare the key in TradeCatalog, implement the
 * check here, add it to the checks array — nothing else changes.
 *
 * @param {string} cityId
 * @returns {Promise<boolean>}
 */
export async function canOpenRelation(cityId) {
  const entry = getTradeCatalogEntry(cityId);
  if (!entry) throw new Error(`[canOpenRelation] No trade catalog entry for "${cityId}"`);

  const req = entry.openingRequirements;
  if (!req || Object.keys(req).length === 0) return true;

  const checks = await Promise.all([
    // checkMerchantCount(req.minMerchants),      // ← uncomment when implemented
    // checkAttractiveness(req.minAttractiveness), // ← idem
    // checkGiftsSent(req.giftsSent),              // ← idem
    // checkIdeology(req.ideology),                // ← idem
    // checkWarStatus(req.noWarWith),              // ← idem
  ]);
  return checks.every(Boolean);
}
