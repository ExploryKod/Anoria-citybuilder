import { describe, test, expect } from '@jest/globals';
import { evaluatePartnerActivationConditions } from '../../../src/contexts/commerce/domain/policies/PartnerActivationPolicy.js';

describe('PartnerActivationPolicy', () => {
  const metricsOk = {
    population: 10,
    unemployment: 5,
    stocksCheck: { hasStocks: true, missingProducts: [] },
  };

  const metricsKo = {
    population: 3,
    unemployment: 15,
    stocksCheck: { hasStocks: false, missingProducts: ['Bois (stock: 0)'] },
  };

  const oliveaConditions = [
    'population_min_5',
    'unemployment_max_10',
  ];

  test('evaluatePartnerActivationConditions with olivea default conditions', () => {
    expect(
      evaluatePartnerActivationConditions({
        partner: { id: 'olivea' },
        activationConditions: oliveaConditions,
        metrics: metricsOk,
      }).canActivate
    ).toBe(true);

    const result = evaluatePartnerActivationConditions({
      partner: { id: 'olivea' },
      activationConditions: oliveaConditions,
      metrics: metricsKo,
    });
    expect(result.canActivate).toBe(false);
    expect(result.unmetConditions).toHaveLength(2);
  });

  test('evaluatePartnerActivationConditions allows partners without conditions', () => {
    expect(
      evaluatePartnerActivationConditions({
        partner: { id: 'silvania' },
        activationConditions: [],
        metrics: metricsKo,
      }).canActivate
    ).toBe(true);
  });

  test('evaluatePartnerActivationConditions checks explicit conditions', () => {
    const result = evaluatePartnerActivationConditions({
      partner: { id: 'olivea' },
      activationConditions: ['population_min_5', 'unemployment_max_10'],
      metrics: metricsKo,
    });

    expect(result.canActivate).toBe(false);
    expect(result.unmetConditions.some((c) => c.includes('Population'))).toBe(true);
    expect(result.unmetConditions.some((c) => c.includes('Chômage'))).toBe(true);
  });
});
