import { describe, test, expect } from '@jest/globals';
import { buildingAccountTrace } from '../../../src/contexts/accounting/domain/policies/BuildingAccountTracePolicy.js';

describe('account trace — a company sees the movements of its own account, with the company it traded with', () => {
  test('the city lines and the other companies lines are left out', () => {
    const entries = [
      { id: 1, turn: 3, type: 'producer_revenue', amount: 100, description: 'Ventes', accountBuildingId: 'farm', counterpartyBuildingId: 'market' },
      { id: 2, turn: 3, type: 'producer_purchase', amount: 100, description: 'Achats', accountBuildingId: 'market', counterpartyBuildingId: 'farm' },
      { id: 3, turn: 3, type: 'vat', amount: 5, description: 'TVA', accountBuildingId: null, counterpartyBuildingId: null },
    ];
    expect(buildingAccountTrace(entries, 'farm')).toEqual([
      { id: 1, turn: 3, type: 'producer_revenue', amount: 100, description: 'Ventes', counterpartyBuildingId: 'market' },
    ]);
  });
});
