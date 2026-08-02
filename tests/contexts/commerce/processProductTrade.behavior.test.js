import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ProcessProductImport } from '../../../src/contexts/commerce/application/commands/ProcessProductImport.js';
import { ProcessProductExport } from '../../../src/contexts/commerce/application/commands/ProcessProductExport.js';

function createSimulationStub(overrides = {}) {
  return {
    yearlyImports: {},
    yearlyExports: {},
    commerceRepository: {
      updateProductStats: jest.fn(),
    },
    recordImportExpense: jest.fn(async () => {}),
    recordExportIncome: jest.fn(async () => {}),
    getProductConfig: jest.fn((productId) => ({
      id: productId,
      buyingMax: 100,
      sellingMax: 100,
    })),
    getPartner: jest.fn(() => ({
      name: 'Olivea',
      sellsToUs: [{ productId: 'figs', pricePerUnit: 14 }],
      buysFromUs: [{ productId: 'wood', pricePerUnit: 25 }],
    })),
    canTradeWithPartner: jest.fn(() => true),
    getPartnerTradeLimit: jest.fn(() => ({ maxPerTurn: 2 })),
    canImportProduct: jest.fn(() => true),
    canExportProduct: jest.fn(() => true),
    updatePartnerTrade: jest.fn(),
    isStockable: jest.fn(() => true),
    commerceHubStock: {
      addToStock: jest.fn(async () => ({ hubId: 'barn1', addedQuantity: 1 })),
      getTotalStock: jest.fn(async () => 5),
      reduceStock: jest.fn(async () => true),
    },
    ...overrides,
  };
}

describe('ProcessProductImport', () => {
  test('records expense and updates yearly stats', async () => {
    const simulation = createSimulationStub();
    const command = new ProcessProductImport(simulation);

    const result = await command.execute({
      productId: 'figs',
      time: 0,
      quantity: 1,
      partnerId: 'olivea',
    });

    expect(result).toMatchObject({
      productId: 'figs',
      quantity: 1,
      totalCost: 14,
      stockAdded: true,
    });
    expect(simulation.recordImportExpense).toHaveBeenCalled();
    expect(simulation.updatePartnerTrade).toHaveBeenCalledWith('olivea', 'figs', 'import');
    expect(simulation.commerceRepository.updateProductStats).toHaveBeenCalledWith(
      'figs',
      { imports: 1 }
    );
  });

  test('returns null when import is not allowed', async () => {
    const simulation = createSimulationStub({
      canImportProduct: jest.fn(() => false),
    });
    const command = new ProcessProductImport(simulation);

    expect(
      await command.execute({ productId: 'figs', time: 0, quantity: 1 })
    ).toBeNull();
  });
});

describe('ProcessProductExport', () => {
  test('records income and reduces stock', async () => {
    const simulation = createSimulationStub();
    const command = new ProcessProductExport(simulation);

    const result = await command.execute({
      productId: 'wood',
      time: 7,
      quantity: 1,
      partnerId: 'olivea',
    });

    expect(result).toMatchObject({
      productId: 'wood',
      quantity: 1,
      totalRevenue: 25,
      remainingStock: 4,
    });
    expect(simulation.recordExportIncome).toHaveBeenCalled();
    expect(simulation.commerceHubStock.reduceStock).toHaveBeenCalledWith('wood', 1, 'olivea');
  });
});
