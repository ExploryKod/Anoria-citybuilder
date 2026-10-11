import { describe, test, expect } from '@jest/globals';
import { nextWageRate, startWageOf } from '../../../src/contexts/accounting/domain/policies/WageRatePolicy.js';
import { START_WAGE_BY_SKILL_LEVEL, WAGE_ADJUSTMENT } from '../../../src/contexts/accounting/domain/catalogs/LabourMarketCatalog.js';
import { buildingCatalog } from '../../../src/shared/building-catalog/buildingCatalog.js';

// The labour market settles the wages: a shortage raises them, slack lowers them, a few percent a month at most, never under the minimum wage.
describe('nextWageRate — the labour market moves a wage', () => {
  const market = { current: 30, jobs: 10, minimumWage: 20 };

  test('a shortage raises the wage, by the market\'s pressure', () => {
    const next = nextWageRate({ ...market, vacancies: 1, idle: 0 }); // 10 % of the jobs unfilled: pressure 0.1 × gain 0.5 = +5 %

    expect(next.signal).toBe('shortage');
    expect(next.rate).toBeCloseTo(30 * 1.05, 2);
  });

  test('a move never exceeds the monthly step, however deep the shortage', () => {
    const next = nextWageRate({ ...market, vacancies: 10, idle: 0 });

    expect(next.rate).toBeCloseTo(30 * (1 + WAGE_ADJUSTMENT.maxMonthlyStep), 2);
  });

  test('slack lowers the wage, down to the minimum wage and no further', () => {
    const lowered = nextWageRate({ ...market, vacancies: 0, idle: 10 });
    const floored = nextWageRate({ current: 20.5, jobs: 10, vacancies: 0, idle: 10, minimumWage: 20 });

    expect(lowered.signal).toBe('slack');
    expect(lowered.rate).toBeCloseTo(30 * (1 - WAGE_ADJUSTMENT.maxMonthlyStep), 2);
    expect(floored.rate).toBe(20);
    expect(floored.atFloor).toBe(true);
  });

  test('a market in balance leaves the wage where it is', () => {
    expect(nextWageRate({ ...market, vacancies: 0, idle: 0 })).toMatchObject({ rate: 30, signal: 'balanced' });
  });

  test('a minimum wage above the market lifts the wage to it at once', () => {
    expect(nextWageRate({ current: 22, jobs: 10, vacancies: 0, idle: 0, minimumWage: 28 }).rate).toBe(28);
  });

  test('a labour market with no jobs has no wage to settle: it throws', () => {
    expect(() => nextWageRate({ current: 30, jobs: 0, vacancies: 0, idle: 0, minimumWage: 20 })).toThrow(/no jobs/);
  });
});

describe('the starting wages', () => {
  test('every skill level a workplace requires has a starting wage', () => {
    for (const definition of Object.values(buildingCatalog)) {
      if (!definition.employment?.requiredSkill) continue;
      expect(startWageOf(definition.employment.requiredSkillLevel ?? 1)).toBeGreaterThan(0);
    }
  });

  test('a higher level starts higher', () => {
    const levels = Object.keys(START_WAGE_BY_SKILL_LEVEL).map(Number).sort((a, b) => a - b);
    for (let index = 1; index < levels.length; index += 1) {
      expect(START_WAGE_BY_SKILL_LEVEL[levels[index]]).toBeGreaterThan(START_WAGE_BY_SKILL_LEVEL[levels[index - 1]]);
    }
  });
});
