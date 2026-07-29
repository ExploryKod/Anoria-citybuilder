import productionJournalManager from '../../../../js/stores/ProductionJournalManager.js';

/**
 * Legacy production journal side-effects.
 */
export class SupplyProductionJournal {
  getPrice(productType) {
    return productionJournalManager.getPrice(productType);
  }

  async addProductionEntry(
    time,
    factoryId,
    eventType,
    productType,
    quantity,
    remainingStocks,
    materialConsumed = null,
    totalPrice = null,
    productionTurns = null
  ) {
    return productionJournalManager.addProductionEntry(
      time,
      factoryId,
      eventType,
      productType,
      quantity,
      remainingStocks,
      materialConsumed,
      totalPrice,
      productionTurns
    );
  }
}
