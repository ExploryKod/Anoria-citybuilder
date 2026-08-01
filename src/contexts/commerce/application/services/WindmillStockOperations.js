import { getProductStockKey, isStockableProduct } from '../../domain/catalogs/ProductCatalog.js';
import { tryInstanceIdFromHouseRow } from '../../../../shared/building-identity/index.js';

/**
 * Windmill stock mutations for commerce import/export flows.
 */
export class WindmillStockOperations {
  /**
   * @param {object} deps
   * @param {() => Promise<Array>} deps.listCommercializableWindmills
   * @param {(row: object) => string} [deps.instanceIdFromHouseRow]
   * @param {(id: string) => Promise<object|null>} deps.getSupplyBuildingRow
   * @param {(id: string, fields: object) => Promise<unknown>} deps.updateSupplyBuildingFields
   * @param {() => Promise<Array>} deps.listWindmillSupplyViews
   * @param {(partnerId: string) => object|null} deps.getPartner
   */
  constructor(deps) {
    this.listCommercializableWindmills = deps.listCommercializableWindmills;
    this.instanceIdFromHouseRow = deps.instanceIdFromHouseRow;
    this.getSupplyBuildingRow = deps.getSupplyBuildingRow;
    this.updateSupplyBuildingFields = deps.updateSupplyBuildingFields;
    this.listWindmillSupplyViews = deps.listWindmillSupplyViews;
    this.getPartner = deps.getPartner;
  }

  /**
   * Resolve UUID from a windmill DTO or Dexie row (legacy DTOs used `buildingId` only).
   * @param {object} windmill
   * @returns {string | null}
   */
  resolveWindmillInstanceId(windmill) {
    if (!windmill || typeof windmill !== 'object') return null;
    const fromRow = tryInstanceIdFromHouseRow(windmill);
    if (fromRow) return fromRow;
    return tryInstanceIdFromHouseRow({
      instanceId: windmill.buildingId ?? windmill.name,
    });
  }

  isStockable(productId) {
    return isStockableProduct(productId);
  }

  getStockKey(productId) {
    return getProductStockKey(productId);
  }

  async getCommercializableWindmills() {
    try {
      return this.listCommercializableWindmills();
    } catch (error) {
      console.warn('[CommerceService] Error getting commercializable windmills:', error);
      return [];
    }
  }

  async getTotalStock(productId) {
    if (!this.isStockable(productId)) return 0;

    try {
      const windmills = await this.getCommercializableWindmills();
      const stockKey = this.getStockKey(productId);
      if (!stockKey) return 0;

      let totalStock = 0;
      for (const windmill of windmills) {
        const stocks = windmill.stocks || {};
        if (stocks[stockKey]) {
          totalStock += stocks[stockKey] || 0;
        }
      }

      return totalStock;
    } catch (error) {
      console.warn(`[CommerceService] Error getting windmill stock for ${productId}:`, error);
      return 0;
    }
  }

  async addToStock(productId, quantity, partnerId = null) {
    if (quantity <= 0 || !this.isStockable(productId)) return null;

    try {
      const windmills = await this.getCommercializableWindmills();

      if (windmills.length === 0) {
        console.warn('[CommerceService] No commercializable windmills available for import');
        return null;
      }

      const stockKey = this.getStockKey(productId);
      if (!stockKey) return null;

      const firstWindmill = windmills.find((w) => this.resolveWindmillInstanceId(w));
      if (!firstWindmill) {
        console.warn('[CommerceService] No windmill with valid instanceId for import');
        return null;
      }

      const windmillId = this.resolveWindmillInstanceId(firstWindmill);
      const windmillData = await this.getSupplyBuildingRow(windmillId);
      if (!windmillData) {
        console.warn(`[CommerceService] Windmill not found: ${windmillId}`);
        return null;
      }

      const stocks = windmillData.stocks || {};
      const isFood = productId !== 'wood';
      const updatedStocks = {
        ...stocks,
        [stockKey]: (stocks[stockKey] || 0) + quantity,
        food: isFood ? (stocks.food || 0) + quantity : stocks.food || 0,
      };

      const existingLastImport = windmillData.lastImport || {};
      const lastImport = {
        ...existingLastImport,
        [stockKey]: (existingLastImport[stockKey] || 0) + quantity,
        total: (existingLastImport.total || 0) + quantity,
      };

      const existingLastImportDetails = windmillData.lastImportDetails || {};
      const lastImportDetails = { ...existingLastImportDetails };

      if (partnerId) {
        const partner = this.getPartner(partnerId);
        const partnerName = partner ? partner.name : partnerId;

        if (!lastImportDetails[stockKey]) {
          lastImportDetails[stockKey] = [];
        }

        const existingPartnerIndex = lastImportDetails[stockKey].findIndex(
          (p) => p.partnerId === partnerId
        );

        if (existingPartnerIndex >= 0) {
          lastImportDetails[stockKey][existingPartnerIndex].quantity += quantity;
        } else {
          lastImportDetails[stockKey].push({
            partnerId,
            partnerName,
            quantity,
          });
        }
      }

      await this.updateSupplyBuildingFields(windmillId, {
        stocks: updatedStocks,
        lastImport,
        lastImportDetails,
      });

      return { windmillId, addedQuantity: quantity };
    } catch (error) {
      console.warn(`[CommerceService] Error adding to windmill stock for ${productId}:`, error);
      return null;
    }
  }

  async reduceStock(productId, quantity, partnerId = null) {
    if (quantity <= 0 || !this.isStockable(productId)) return false;

    try {
      const windmills = await this.getCommercializableWindmills();

      if (windmills.length === 0) {
        console.warn('[CommerceService] No commercializable windmills available for export');
        return false;
      }

      const stockKey = this.getStockKey(productId);
      if (!stockKey) return false;

      let remaining = quantity;

      for (const windmill of windmills) {
        if (remaining <= 0) break;

        const windmillId = this.resolveWindmillInstanceId(windmill);
        if (!windmillId) continue;

        const row = await this.getSupplyBuildingRow(windmillId);
        const stocks = row?.stocks || windmill.stocks || {};
        const currentStock = stocks[stockKey] || 0;

        if (currentStock > 0) {
          const toReduce = Math.min(remaining, currentStock);
          const newStock = currentStock - toReduce;
          remaining -= toReduce;

          const isFood = productId !== 'wood';
          const updatedStocks = {
            ...stocks,
            [stockKey]: newStock,
            food: isFood
              ? Math.max(0, (stocks.food || 0) - toReduce)
              : stocks.food || 0,
          };

          if (partnerId) {
            const existingLastExportDetails = row?.lastExportDetails || {};
            const lastExportDetails = { ...existingLastExportDetails };

            if (!lastExportDetails[stockKey]) {
              lastExportDetails[stockKey] = [];
            }

            const partner = this.getPartner(partnerId);
            const partnerName = partner ? partner.name : partnerId;
            const existingPartnerIndex = lastExportDetails[stockKey].findIndex(
              (p) => p.partnerId === partnerId
            );

            if (existingPartnerIndex >= 0) {
              lastExportDetails[stockKey][existingPartnerIndex].quantity += toReduce;
            } else {
              lastExportDetails[stockKey].push({
                partnerId,
                partnerName,
                quantity: toReduce,
              });
            }

            await this.updateSupplyBuildingFields(windmillId, {
              stocks: updatedStocks,
              lastExportDetails,
            });
          } else {
            await this.updateSupplyBuildingFields(windmillId, { stocks: updatedStocks });
          }
        }
      }

      return remaining === 0;
    } catch (error) {
      console.warn(`[CommerceService] Error reducing windmill stock for ${productId}:`, error);
      return false;
    }
  }

  async resetImportsDisplay() {
    try {
      const windmills = await this.listWindmillSupplyViews();

      for (const windmill of windmills) {
        const windmillId = this.resolveWindmillInstanceId(windmill);
        if (!windmillId) continue;
        try {
          const windmillData = await this.getSupplyBuildingRow(windmillId);
          if (windmillData && windmillData.lastImport !== undefined) {
            await this.updateSupplyBuildingFields(windmillId, {
              lastImport: { wheat: 0, carrot: 0, cabbage: 0, wood: 0, dattes: 0, total: 0 },
              lastImportDetails: {},
            });
          }
        } catch (_error) {
          // preserve silent failure per windmill
        }
      }
    } catch (error) {
      console.warn('[CommerceService] Error resetting windmill imports display:', error);
    }
  }
}
