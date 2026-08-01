import { describe, test, expect } from '@jest/globals';
import {
  evaluateDefaultActivationConditions,
  evaluatePartnerActivationConditions,
} from '../../../src/contexts/commerce/domain/policies/PartnerActivationPolicy.js';

describe('PartnerActivationPolicy', () => {
  const metricsOk = {
    population: 10,
    unemployment: 5,
    stocksCheck: { hasStocks: true, missingProducts: [] },
  };

  const metricsKo = {
    population: 3,
    unemployment: 15,
    stocksCheck: { hasStocks: false, missingProducts: ['Blé (stock: 0)'] },
  };

  test('evaluateDefaultActivationConditions', () => {
    expect(
      evaluateDefaultActivationConditions({ partner: { id: 'deserta' }, metrics: metricsOk }).canActivate
    ).toBe(true);

    const result = evaluateDefaultActivationConditions({ partner: { id: 'deserta' }, metrics: metricsKo });
    expect(result.canActivate).toBe(false);
    expect(result.unmetConditions).toHaveLength(3);
  });

  test('evaluatePartnerActivationConditions uses deserta defaults when no conditions', () => {
    expect(
      evaluatePartnerActivationConditions({
        partner: { id: 'deserta' },
        activationConditions: [],
        metrics: metricsOk,
      }).canActivate
    ).toBe(true);

    expect(
      evaluatePartnerActivationConditions({
        partner: { id: 'tropicala' },
        activationConditions: [],
        metrics: metricsKo,
      }).canActivate
    ).toBe(true);
  });

  test('evaluatePartnerActivationConditions checks explicit conditions', () => {
    const result = evaluatePartnerActivationConditions({
      partner: { id: 'deserta' },
      activationConditions: ['population_min_5', 'unemployment_max_10'],
      metrics: metricsKo,
    });

    expect(result.canActivate).toBe(false);
    expect(result.unmetConditions.some((c) => c.includes('Population'))).toBe(true);
    expect(result.unmetConditions.some((c) => c.includes('Chômage'))).toBe(true);
  });
});
