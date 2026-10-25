import { describe, test, expect } from '@jest/globals';
import { benefitBaseOf, nextWageRate, startWageOf, wageFloorOf } from '../../../src/contexts/accounting/domain/policies/WageRatePolicy.js';
import { START_WAGE_BASE, START_WAGE_BY_SKILL, WAGE_ADJUSTMENT } from '../../../src/contexts/accounting/domain/catalogs/LabourMarketCatalog.js';
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

// The first lever of the economic regime: a hamlet with no minimum wage lets the market alone set wages, and the benefit still has a base.
describe('a hamlet with no minimum wage', () => {
  test('the floor is none, and a wage falls below where a floor would have held it', () => {
    const floor = wageFloorOf({ minimumWageMode: 'none', minimumWage: 20 });
    const next = nextWageRate({ current: 20.5, jobs: 10, vacancies: 0, idle: 10, minimumWage: floor });

    expect(floor).toBeNull();
    expect(next.rate).toBeCloseTo(20.5 * (1 - WAGE_ADJUSTMENT.maxMonthlyStep), 2);
    expect(next.rate).toBeLessThan(20);
    expect(next.atFloor).toBe(false);
  });

  test('a fixed minimum wage is the floor, and an unknown mode throws', () => {
    expect(wageFloorOf({ minimumWageMode: 'fixed', minimumWage: 20 })).toBe(20);
    expect(wageFloorOf({ minimumWageMode: 'indexed', minimumWage: 7.5 })).toBe(7.5);
    expect(() => wageFloorOf({ minimumWageMode: 'barter', minimumWage: 20 })).toThrow(/unknown minimum wage mode/);
  });

  test('the benefit base is the lowest wage in force, the floor included', () => {
    expect(benefitBaseOf({ floor: null, rates: [8, 5.5, 11] })).toBe(5.5);
    expect(benefitBaseOf({ floor: 6, rates: [8, 5.5, 11] })).toBe(6);
  });
});

describe('the starting wages', () => {
  test('every skill a workplace requires has a starting wage', () => {
    for (const definition of Object.values(buildingCatalog)) {
      if (!definition.employment?.requiredSkill) continue;
      expect(startWageOf(definition.employment.requiredSkill, 1)).toBeGreaterThan(0);
    }
  });

  test('an advanced trade starts above the base, and a skill has one level: any other is refused', () => {
    for (const skill of Object.keys(START_WAGE_BY_SKILL)) expect(startWageOf(skill, 1)).toBeGreaterThan(START_WAGE_BASE);
    expect(startWageOf('fermier', 1)).toBe(START_WAGE_BASE);
    expect(() => startWageOf('fermier', 2)).toThrow('one level');
  });
});
