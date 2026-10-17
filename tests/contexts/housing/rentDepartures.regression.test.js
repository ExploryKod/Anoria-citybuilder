import { describe, test, expect } from '@jest/globals';
import { RunMonthlyDepartures } from '../../../src/contexts/housing/application/commands/departure/RunMonthlyDepartures.js';
import { GrowHousePopulation } from '../../../src/contexts/housing/application/commands/growth/GrowHousePopulation.js';
import { DEPARTURE_CAUSES } from '../../../src/shared/population/DepartureCauseCatalog.js';
import { rentArrearsMonthsByHouse, rentDebtsOf } from '../../../src/contexts/accounting/domain/policies/RentPolicy.js';

// A house that cannot pay its rent warns, then loses an inhabitant a month; the crisis is remembered as x/y and ends when the debt is paid.
class Repository {
  constructor(house) {
    this.house = house;
  }
  async findResidentialHouses() {
    return [this.house];
  }
  async findById() {
    return this.house;
  }
  async saveDepartures(_id, { departures, repopulationBans, pop }) {
    this.house = { ...this.house, departures, repopulationBans, pop };
  }
}

const due = (year, month, amount = 2) => ({ type: 'info_rent_due', year, month, amount, counterpartyBuildingId: 'h1' });
const paid = (year, month, amount) => ({ type: 'rent_paid', year, month, amount, accountBuildingId: 'h1' });

describe('the months a house ends in rent arrears', () => {
  test('counts the months in a row ending with a debt, and none once it is settled', () => {
    expect(rentArrearsMonthsByHouse([due(1, 1), due(1, 2)]).get('h1')).toBe(2);
    expect(rentArrearsMonthsByHouse([due(1, 1), due(1, 2), paid(1, 2, 2)]).get('h1')).toBe(2); // 2 still owed
    expect(rentArrearsMonthsByHouse([due(1, 1), due(1, 2), paid(1, 2, 4)]).has('h1')).toBe(false);
    expect(rentArrearsMonthsByHouse([due(1, 1), paid(1, 2, 2), due(1, 3)]).get('h1')).toBe(1);
  });

  test('a debt the owner wrote off (the house was emptied) is no longer a debt', () => {
    const writtenOff = { type: 'info_rent_written_off', year: 1, month: 3, amount: 4, counterpartyBuildingId: 'h1' };
    expect(rentArrearsMonthsByHouse([due(1, 1), due(1, 2), writtenOff]).has('h1')).toBe(false);
    expect(rentDebtsOf([due(1, 1), due(1, 2), writtenOff]).get('h1')).toBe(0);
  });
});

describe('the departures for an unpaid rent', () => {
  test('a first month of arrears warns, the second makes one inhabitant leave, and paying the debt ends the crisis', async () => {
    const repository = new Repository({ id: 'h1', pop: 5, departures: undefined });
    const run = new RunMonthlyDepartures(repository);
    const judge = (monthKey, months) => run.execute({ monthKey, signals: { rentUnpaid: new Map(months ? [['h1', months]] : []) } });

    await judge(10, 1);
    expect(repository.house.pop).toBe(5);
    expect(repository.house.departures.rentUnpaid).toMatchObject({ left: 0, of: 5, months: 1 });

    await judge(11, 2);
    expect(repository.house.pop).toBe(4);
    expect(repository.house.departures.rentUnpaid).toMatchObject({ left: 1, of: 5 });

    await judge(11, 2); // a month is judged once
    expect(repository.house.pop).toBe(4);

    await judge(12, 3);
    expect(repository.house.departures.rentUnpaid).toMatchObject({ left: 2, of: 5 });

    await judge(13, 0);
    expect(repository.house.departures).toEqual({});
    // The penalty: the catalog's delay before the house may grow back.
    const delay = DEPARTURE_CAUSES.rentUnpaid.repopulationDelayMonths;
    expect(repository.house.repopulationBans).toEqual({ rentUnpaid: { until: 13 + delay, remaining: delay } });
    await judge(13 + delay - 1, 0);
    expect(repository.house.repopulationBans).toEqual({ rentUnpaid: { until: 13 + delay, remaining: 1 } });
    await judge(13 + delay, 0);
    expect(repository.house.repopulationBans).toEqual({});
  });

  test('a house that only got a warning serves no penalty once the rent is paid', async () => {
    const repository = new Repository({ id: 'h1', pop: 5 });
    const run = new RunMonthlyDepartures(repository);
    await run.execute({ monthKey: 10, signals: { rentUnpaid: new Map([['h1', 1]]) } });
    await run.execute({ monthKey: 11, signals: { rentUnpaid: new Map() } });
    expect(repository.house.repopulationBans).toEqual({});
  });

  test('a house in a crisis, or serving its penalty, does not grow back', async () => {
    const growth = (house) => new GrowHousePopulation(new Repository(house)).execute({ houseId: 'h1', monthIndex: 3 });
    const crisis = await growth({ id: 'h1', type: 'House-Red', level: 1, pop: 3, departures: { rentUnpaid: { left: 1, of: 4, months: 2, settledMonth: 11 } } });
    expect(crisis).toMatchObject({ changed: false, reason: 'departure_crisis' });
    const penalty = await growth({ id: 'h1', type: 'House-Red', level: 1, pop: 0, departures: {}, repopulationBans: { rentUnpaid: { until: 19, remaining: 4 } } });
    expect(penalty).toMatchObject({ changed: false, reason: 'departure_crisis' });
  });
});
