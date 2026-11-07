/**
 * The residents of a house are the count of its citizens (core/persistence/dexie/residentsProjection.js). The count must stay true when a transaction fails: Dexie
 * rejects the promise of a transaction before the IndexedDB `abort` event, and a nested transaction is the same IndexedDB transaction as its parent.
 */
import 'fake-indexeddb/auto';
import { describe, test, expect, beforeEach } from '@jest/globals';
import db from '../../../src/core/persistence/dexie/db.js';
import { residentsOfHouseId, refuseResidentsField } from '../../../src/core/persistence/dexie/residentsProjection.js';
import { clearBuildingsTable } from '../../helpers/buildingDb.js';

const citizen = (id) => ({ id, houseId: 'house', hamletId: 'hamlet' });
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

/** The count and the table must say the same thing, right now and once the late `abort` event has fired. */
async function expectCountToBe(expected) {
  expect(residentsOfHouseId('house')).toBe(expected);
  expect(await db.citizens.where('houseId').equals('house').count()).toBe(expected);
  await settle();
  expect(residentsOfHouseId('house')).toBe(expected);
}

beforeEach(async () => {
  await clearBuildingsTable();
});

describe('residents count — true when a transaction fails', () => {
  test('a citizen added then a failure: the count is given back before the caller sees the failure', async () => {
    await expect(db.transaction('rw', db.houses, db.citizens, async () => {
      await db.citizens.bulkAdd([citizen('a')]);
      throw new Error('boom');
    })).rejects.toThrow('boom');
    await expectCountToBe(0);
  });

  test('a nested transaction that adds, then its outer one fails', async () => {
    await expect(db.transaction('rw', db.houses, db.citizens, async () => {
      await db.transaction('rw', db.citizens, async () => {
        await db.citizens.bulkAdd([citizen('a')]);
      });
      throw new Error('outer');
    })).rejects.toThrow('outer');
    await expectCountToBe(0);
  });

  test('a write that fails on its own without aborting the transaction does not count', async () => {
    await db.citizens.add(citizen('a'));
    await db.transaction('rw', db.citizens, async () => {
      await db.citizens.bulkAdd([citizen('a')]).catch(() => {});
    }).catch(() => {});
    await expectCountToBe(1);
  });

  test('a transaction that commits keeps its count, and removing citizens lowers it', async () => {
    await db.transaction('rw', db.citizens, async () => {
      await db.citizens.bulkAdd([citizen('a'), citizen('b'), citizen('c')]);
    });
    await expectCountToBe(3);
    await db.citizens.bulkDelete(['a']);
    await expectCountToBe(2);
  });

  test('a table emptied inside a transaction that aborts gets its citizens back in the count', async () => {
    await db.citizens.bulkAdd([citizen('a'), citizen('b')]);
    await expect(db.transaction('rw', db.citizens, async () => {
      await db.citizens.clear();
      throw new Error('boom');
    })).rejects.toThrow('boom');
    await settle();
    await expectCountToBe(2);
  });
});

describe('residents are not a field of a row', () => {
  test('a writer of named fields that names `pop` is refused, naming the building', () => {
    expect(() => refuseResidentsField('house-1', { pop: 3 })).toThrow(/house-1.*citizens/);
    expect(() => refuseResidentsField('house-1', { price: 3 })).not.toThrow();
  });
});
