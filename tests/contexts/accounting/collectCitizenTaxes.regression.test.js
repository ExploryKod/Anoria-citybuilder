import { describe, test, expect } from '@jest/globals';
import { CollectCitizenTaxes } from '../../../src/contexts/accounting/application/services/game/CollectCitizenTaxes.js';

// Regression: the citizen tax must be visible on each taxed house's own account (citizen_tax_paid, accountKind
// 'particulier'), not only folded into the city's lump sum (citizen_tax) — see buildingFinanceInfoView.js's
// "Impôt citoyen" row, which reads a house's own journal lines.
describe('CollectCitizenTaxes — one citizen_tax_paid line per taxed house, alongside the city lump sum', () => {
  function buildService({ houses, lastTaxYear = -1 }) {
    const cityLines = [];
    const houseLines = [];
    const service = new CollectCitizenTaxes({
      getTreasurySnapshot: { execute: async () => ({ turn: 320, lastTaxYear }) },
      recordCitizenTaxIncome: {
        execute: async (params) => {
          cityLines.push(params);
          return { recorded: true, skipped: false };
        },
      },
      recordLedgerEntry: {
        execute: async (params) => {
          houseLines.push(params);
          return { recorded: true, skipped: false };
        },
      },
      houseReadPort: { listHouses: async () => houses },
      getCitizenTaxPerCapita: async () => 25,
      getTimeInfo: () => ({ year: 3, monthIndex: 10 }),
    });
    return { service, cityLines, houseLines };
  }

  test('one citizen_tax_paid debit per taxed house, summing to the city lump sum', async () => {
    const houses = [
      { id: 'house-1', type: 'House-Blue', pop: 3, level: 2 },
      { id: 'house-2', type: 'House-Red', pop: 4, level: 2 },
      { id: 'house-3', type: 'House-Purple', pop: 5, level: 1 }, // exempt (level 1)
    ];
    const { service, cityLines, houseLines } = buildService({ houses, lastTaxYear: -1 });

    await service.execute({ time: 320 });

    expect(cityLines).toHaveLength(1);
    expect(cityLines[0].amount).toBe(175); // (3 + 4) * 25

    expect(houseLines).toHaveLength(2);
    expect(houseLines.map((l) => ({ houseId: l.accountBuildingId, accountKind: l.accountKind, type: l.type, amount: l.amount }))).toEqual([
      { houseId: 'house-1', accountKind: 'particulier', type: 'citizen_tax_paid', amount: 75 },
      { houseId: 'house-2', accountKind: 'particulier', type: 'citizen_tax_paid', amount: 100 },
    ]);
    expect(houseLines.reduce((sum, l) => sum + l.amount, 0)).toBe(cityLines[0].amount);
    expect(houseLines.every((l) => l.businessKey.includes(l.accountBuildingId) && l.businessKey.includes('3'))).toBe(true);
  });

  test('already taxed this year: nothing is written, neither city nor house lines', async () => {
    const houses = [{ id: 'house-1', type: 'House-Blue', pop: 3, level: 2 }];
    const { service, cityLines, houseLines } = buildService({ houses, lastTaxYear: 3 });

    await service.execute({ time: 320 });

    expect(cityLines).toHaveLength(0);
    expect(houseLines).toHaveLength(0);
  });

  test('outside the collection month: nothing is written', async () => {
    const houses = [{ id: 'house-1', type: 'House-Blue', pop: 3, level: 2 }];
    const cityLines = [];
    const houseLines = [];
    const service = new CollectCitizenTaxes({
      getTreasurySnapshot: { execute: async () => ({ turn: 10, lastTaxYear: -1 }) },
      recordCitizenTaxIncome: { execute: async (p) => { cityLines.push(p); return { recorded: true, skipped: false }; } },
      recordLedgerEntry: { execute: async (p) => { houseLines.push(p); return { recorded: true, skipped: false }; } },
      houseReadPort: { listHouses: async () => houses },
      getCitizenTaxPerCapita: async () => 25,
      getTimeInfo: () => ({ year: 3, monthIndex: 0 }),
    });

    await service.execute({ time: 10 });

    expect(cityLines).toHaveLength(0);
    expect(houseLines).toHaveLength(0);
  });
});
