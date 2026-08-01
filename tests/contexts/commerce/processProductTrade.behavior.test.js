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
      buyingPrice: 12,
      sellingPrice: 20,
      stockpiling: false,
      buyingMax: 100,
      sellingMax: 100,
    })),
    canTradeWithPartner: jest.fn(() => true),
    getPartnerTradeLimit: jest.fn(() => ({ maxPerTurn: 2 })),
    canImportProduct: jest.fn(() => true),
    canExportProduct: jest.fn(() => true),
    updatePartnerTrade: jest.fn(),
    isStockable: jest.fn(() => true),
    getPartner: jest.fn(() => ({ name: 'Deserta' })),
    windmillStock: {
      addToStock: jest.fn(async () => ({ windmillId: 'w1', addedQuantity: 1 })),
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
      productId: 'dattes',
      time: 0,
      quantity: 1,
      partnerId: 'deserta',
    });

    expect(result).toMatchObject({
      productId: 'dattes',
      quantity: 1,
      totalCost: 12,
      stockAdded: true,
    });
    expect(simulation.recordImportExpense).toHaveBeenCalled();
    expect(simulation.updatePartnerTrade).toHaveBeenCalledWith('deserta', 'dattes', 'import');
    expect(simulation.commerceRepository.updateProductStats).toHaveBeenCalledWith(
      'dattes',
      { imports: 1 }
    );
  });

  test('returns null when import is not allowed', async () => {
    const simulation = createSimulationStub({
      canImportProduct: jest.fn(() => false),
    });
    const command = new ProcessProductImport(simulation);

    expect(
      await command.execute({ productId: 'dattes', time: 0, quantity: 1 })
    ).toBeNull();
  });
});

describe('ProcessProductExport', () => {
  test('records income and reduces stock', async () => {
    const simulation = createSimulationStub();
    const command = new ProcessProductExport(simulation);

    const result = await command.execute({
      productId: 'carrot',
      time: 7,
      quantity: 1,
      partnerId: 'deserta',
    });

    expect(result).toMatchObject({
      productId: 'carrot',
      quantity: 1,
      totalRevenue: 20,
      remainingStock: 4,
    });
    expect(simulation.recordExportIncome).toHaveBeenCalled();
    expect(simulation.windmillStock.reduceStock).toHaveBeenCalledWith('carrot', 1, 'deserta');
  });
});
