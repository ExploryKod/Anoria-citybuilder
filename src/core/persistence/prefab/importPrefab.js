import db from '../dexie/db.js';
import { canonicalizeHouseRecord } from '../../../shared/building-identity/index.js';
import { CALENDAR_SETTING_NAME } from '../../../config/events.js';
import { writeGameClock } from '../game-clock/gameClock.js';
import { DEFAULT_HAMLET_SLUG } from '../hamlet/hamletSession.js';
import { HAMLET_CATALOG } from '../../../shared/hamlet-catalog/hamletCatalog.js';

/**
 * Write a prefab's state into the (empty) game database: the calendar, the clock, the starting hamlet, its
 * buildings, the journal, the supply traceability and the trade relations. Nothing is paid: the journal already
 * holds every movement of the saved city. Every row of the prefab must belong to its hamlet, or nothing is written.
 * @param {import('../../../shared/prefabs/prefabCatalog.js').Prefab} prefab
 * @returns {Promise<void>}
 */
export async function importPrefab(prefab) {
  const { hamletId, city, journal, transactions, relations } = prefab;
  for (const building of city.buildings) {
    if (building.hamletId !== hamletId) {
      throw new Error(`[prefab] building ${building.instanceId} belongs to ${building.hamletId}, not to ${hamletId}`);
    }
  }
  for (const entry of journal) {
    if (entry.hamletId !== hamletId) {
      throw new Error(`[prefab] journal line ${entry.id} belongs to ${entry.hamletId}, not to ${hamletId}`);
    }
  }
  const startingHamlet = HAMLET_CATALOG.find((hamlet) => hamlet.slug === DEFAULT_HAMLET_SLUG);
  const buildingRows = city.buildings.map((building) => canonicalizeHouseRecord(building));

  await db.transaction(
    'rw',
    [db.gameSettings, db.hamlets, db.houses, db.journal, db.supplyTraceability, db.cityRelations],
    async () => {
      await db.gameSettings.put({ name: CALENDAR_SETTING_NAME, daysPerMonth: city.config.daysPerMonth });
      // The saved city's nature is already placed: the hamlet is not seeded again.
      await db.hamlets.put({
        id: hamletId,
        slug: startingHamlet.slug,
        name: startingHamlet.name,
        natureSeeded: true,
        unlocked: true,
      });
      await db.houses.bulkPut(buildingRows);
      await db.journal.bulkPut(journal.map((entry) => ({ ...entry })));
      await db.supplyTraceability.bulkPut(transactions.map((row) => ({ ...row })));
      await db.cityRelations.bulkPut(relations.map((relation) => ({ ...relation })));
    }
  );
  await writeGameClock(prefab.turn);
}
