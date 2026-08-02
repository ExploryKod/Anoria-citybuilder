/**
 * Command — process a commerce product import (partner or internal limits).
 */
import { getPartnerTradePrice } from '../../domain/policies/PartnerTradePolicy.js';
import { getDefaultTradePrice } from '../../domain/catalogs/ProductCatalog.js';

export class ProcessProductImport {
  /** @param {import('../services/CommerceSimulationService.js').CommerceSimulationService} simulation */
  constructor(simulation) {
    this.simulation = simulation;
  }

  /**
   * @param {object} params
   * @param {string} params.productId
   * @param {number} params.time
   * @param {number} [params.quantity]
   * @param {object|null} [params.conditions]
   * @param {string|null} [params.partnerId]
   */
  async execute({ productId, time, quantity = 1, conditions = null, partnerId = null }) {
    const simulation = this.simulation;
    const config = simulation.getProductConfig(productId);
    if (!config) {
      console.warn(`[CommerceService] No config found for product: ${productId}`);
      return null;
    }

    if (partnerId) {
      if (!simulation.canTradeWithPartner(partnerId, productId, 'import', time)) {
        return null;
      }
      const partnerLimit = simulation.getPartnerTradeLimit(partnerId, productId, 'import');
      if (partnerLimit && quantity > partnerLimit.maxPerTurn) {
        quantity = partnerLimit.maxPerTurn;
      }
    }

    if (!simulation.canImportProduct(productId, quantity, conditions)) {
      return null;
    }

    const partner = partnerId ? simulation.getPartner(partnerId) : null;
    const partnerName = partner ? partner.name : null;
    const pricePerUnit =
      getPartnerTradePrice(partner, productId, 'import')
      ?? getDefaultTradePrice(productId, 'import')
      ?? 5;
    const totalCost = quantity * pricePerUnit;

    let description = `Import ${productId}`;
    if (partnerName) {
      const breakdown = [{
        label: partnerName,
        quantity,
        unitCost: pricePerUnit,
        total: totalCost,
      }];
      description += ` |BREAKDOWN|${JSON.stringify(breakdown)}|BREAKDOWN|`;
    } else {
      description += ` (${quantity} panier × ${pricePerUnit}€)`;
    }

    await simulation.recordImportExpense(totalCost, description, productId, partnerId);

    if (partnerId) {
      simulation.updatePartnerTrade(partnerId, productId, 'import');
    }

    let stockAdded = false;
    if (simulation.isStockable(productId)) {
      const stockResult = await simulation.windmillStock.addToStock(productId, quantity, partnerId);
      stockAdded = stockResult !== null;
    }

    simulation.yearlyImports[productId] = (simulation.yearlyImports[productId] || 0) + quantity;

    simulation.commerceRepository.updateProductStats(productId, {
      imports: simulation.yearlyImports[productId],
    });

    return {
      productId,
      quantity,
      pricePerUnit,
      totalCost,
      description,
      stockAdded,
    };
  }
}
