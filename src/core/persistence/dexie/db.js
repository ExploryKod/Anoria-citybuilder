/**
 * Dexie bootstrap — connexion + schéma IndexedDB (transverse, core).
 *
 * Adapters BC importent ce module et appellent db.* directement dans leur impl.
 * Pas de CRUD métier ici.
 */
import Dexie from 'dexie';
import { reconcileHamletUnlockFlags } from '../hamlet/hamletUnlockMigration.js';

const db = new Dexie('anoriaDb');

const stores = {
  houses: 'instanceId, kind, type, [anchorX+anchorY], [kind+type]',
  game: 'name',
  budget: 'name',
  objectives: 'name',
  journal: '++id, turn, date, type, amount, description',
  supplyTraceability:
    '++id, turn, month, year, date, transactionType, fromInstanceId, fromCoords, toInstanceId, toCoords, foodType, quantity, price',
  productionJournal:
    '++id, turn, month, year, date, factoryId, eventType, resourceType, quantity, price, remainingStocks, logsConsumed, productionTurns',
};

const isTestEnv = typeof process !== 'undefined' && process.env.NODE_ENV === 'test';

db.version(1).stores(stores);
db.version(2).stores({
  newsItems: 'id, turn, lifecycle, sourceId, revelation, [turn+sourceId]',
});
db.version(3).stores({
  houses: 'instanceId, kind, type, hamletId, [anchorX+anchorY], [kind+type]',
  hamlets: 'id',
}).upgrade(async (tx) => {
  // Houses without a hamletId cannot be attributed to a hamlet: dropped (development data only).
  await tx.table('houses').clear();
});

db.version(4).stores({
  cheatCodes: 'code, activatedAt',
}).upgrade(async (tx) => {
  await tx.table('hamlets').toCollection().modify((row) => {
    if (row.unlocked === undefined) {
      throw new Error(`[db v4] hamlet row ${row.id} has no unlocked flag`);
    }
  });
});

// v5: unlock is explicit (cheat / future rules) — not inferred from natureSeeded visits.
db.version(5).stores({}).upgrade(reconcileHamletUnlockFlags);

// v6: the legacy procedural 'roads' tile/mesh is retired — StonePath-001 is
// the only road tool now (see buildingEconomy.js). Any house row still
// carrying the old type would throw on scene render (no catalog entry).
db.version(6).stores({}).upgrade(async (tx) => {
  await tx.table('houses').where('type').equals('roads').modify((row) => {
    row.type = 'StonePath-001';
  });
});

// v7: Supply's stored fields are renamed off resource-specific words
// (windmill/market/farm) to their generic hub/distributor/producer-source
// role names — the Supply mechanism itself no longer names any resource in
// code, only in declarative catalog data (see ResourceRolePolicy.js).
const SUPPLY_FIELD_RENAMES = {
  supplyWindmillId: 'supplyHubId',
  linkedMarkets: 'linkedDistributors',
  soldToWindmill: 'collectedByHub',
  marketTooFar: 'distributorTooFar',
  noFarmsNearby: 'noSourcesNearby',
  salesToMarket: 'salesToDistributor',
  salesToWindmill: 'salesToHub',
};
db.version(7).stores({}).upgrade(async (tx) => {
  await tx.table('houses').toCollection().modify((row) => {
    for (const [oldField, newField] of Object.entries(SUPPLY_FIELD_RENAMES)) {
      if (oldField in row) {
        row[newField] = row[oldField];
        delete row[oldField];
      }
    }
    if (Array.isArray(row.linkedDistributors)) {
      row.linkedDistributors = row.linkedDistributors.map((entry) =>
        entry && 'marketId' in entry
          ? { ...entry, distributorId: entry.marketId, marketId: undefined }
          : entry
      );
    }
    if (Array.isArray(row.salesToHub)) {
      row.salesToHub = row.salesToHub.map((sale) =>
        sale && 'windmillId' in sale ? { ...sale, hubId: sale.windmillId, windmillId: undefined } : sale
      );
    }
    if (Array.isArray(row.salesToDistributor)) {
      row.salesToDistributor = row.salesToDistributor.map((sale) =>
        sale && 'marketId' in sale ? { ...sale, distributorId: sale.marketId, marketId: undefined } : sale
      );
    }
  });
});

// v8: the decoration / cemetery / infrastructure-prop catalog is retired
// (benches, fountains, tombs, primitives…): those ids no longer exist in the
// asset catalogs, so any placed row would throw on scene render. They are
// removed from saves.
const RETIRED_PROP_TYPES = ['Bench', 'Picnic-Table', 'Potted-Bush', 'Daisy', 'Shroom', 'Arch', 'Obelisk', 'Pillar', 'Garland', 'Barrell', 'Fountain-001', 'Well-001', 'Streetlight-001', 'Fence-001', 'Pond-001', 'Plane-001', 'Plane-004', 'Plane-007', 'Cube', 'Sphere-001', 'Sphere-002', 'Grave-1', 'Grave-2', 'Tombstone-1', 'Tombstone-2', 'Tombstone-3', 'Tomb', 'Coffin'];
db.version(8).stores({}).upgrade(async (tx) => {
  await tx.table('houses').where('type').anyOf(RETIRED_PROP_TYPES).delete();
});

// v9: the village-era crate and wheat silo are retired: a saved row of either would throw on scene render.
const RETIRED_BUILDING_TYPES = ['Crate-001', 'Cylinder'];
db.version(9).stores({}).upgrade(async (tx) => {
  await tx.table('houses').where('type').anyOf(RETIRED_BUILDING_TYPES).delete();
});

// v10: the hay bale, cart and pile are retired as well (village-era props, nothing to do in this game).
const RETIRED_HAY_TYPES = ['Hay-Bale', 'Hay-Cart', 'Hay-Pile'];
db.version(10).stores({}).upgrade(async (tx) => {
  await tx.table('houses').where('type').anyOf(RETIRED_HAY_TYPES).delete();
});

// v11: the bookshop is retired (the library does its job).
db.version(11).stores({}).upgrade(async (tx) => {
  await tx.table('houses').where('type').equals('BookShop-001').delete();
});

// v12: the palace (House-2Story, the last of the elite mechanism) is retired.
db.version(12).stores({}).upgrade(async (tx) => {
  await tx.table('houses').where('type').equals('House-2Story').delete();
});

// v13: rename foodTraceability → supplyTraceability (table covers all resource categories, not food only).
db.version(13).stores({ supplyTraceability: '++id, turn, month, year, date, transactionType, fromInstanceId, fromCoords, toInstanceId, toCoords, foodType, quantity, price', foodTraceability: null });

// v14: city trade relations — one row per partner city, keyed by cityId.
db.version(14).stores({ cityRelations: 'cityId, status, contractEndMonth, lastOrderMonth' });

// v15: hamlets are identified by a UUID allocated at creation (the slug is only the definition).
// Development data only: the houses, hamlets and active-hamlet row from earlier versions are dropped.
db.version(15).stores({ hamlets: 'id, slug' }).upgrade(async (tx) => {
  await tx.table('houses').clear();
  await tx.table('hamlets').clear();
  await tx.table('game').where('name').equals('hamlet-session').delete();
});

// v16: economy and news rows carry the UUID of the hamlet they belong to, so every reading screen can
// filter by hamlet. Development data only: these tables are emptied, as in v15.
db.version(16).stores({
  journal: '++id, hamletId, turn, date, type, amount, description',
  productionJournal:
    '++id, hamletId, turn, month, year, date, factoryId, eventType, resourceType, quantity, price, remainingStocks, logsConsumed, productionTurns',
  supplyTraceability:
    '++id, hamletId, turn, month, year, date, transactionType, fromInstanceId, fromCoords, toInstanceId, toCoords, foodType, quantity, price',
  newsItems: 'id, hamletId, turn, lifecycle, sourceId, revelation, [turn+sourceId]',
}).upgrade(async (tx) => {
  for (const name of ['journal', 'productionJournal', 'supplyTraceability', 'newsItems']) {
    await tx.table(name).clear();
  }
});

// v17: settings frozen when a game is created (the calendar's days per month: it must never change in a game).
db.version(17).stores({ gameSettings: 'name' });

/** @type {Promise<void> | null} */
let dbReadyPromise = null;

function clearLegacyLocalStorage() {
  try {
    localStorage.removeItem('journal_year_end_balances');
    localStorage.removeItem('citizen_tax_amount');
    localStorage.removeItem('work_salary_per_month');
    localStorage.removeItem('work_salary_tax_rate');
    localStorage.removeItem('commerce_config');
    localStorage.removeItem('commerce_stats');
  } catch (error) {
    console.warn('[core/persistence/dexie/db] Error clearing localStorage:', error);
  }
}

/**
 * Open IndexedDB once before any gameplay persistence (avoids races with async db.delete).
 * @returns {Promise<void>}
 */
export function waitForDatabaseReady() {
  if (!dbReadyPromise) {
    dbReadyPromise = db
      .open()
      .then(() => {
        if (!isTestEnv) {
          clearLegacyLocalStorage();
        }
      })
      .catch((err) => {
        dbReadyPromise = null;
        throw err;
      });
  }
  return dbReadyPromise;
}

if (!isTestEnv) {
  waitForDatabaseReady();
}

export default db;
