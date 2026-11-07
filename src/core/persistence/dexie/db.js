/**
 * Dexie bootstrap — connexion + schéma IndexedDB (transverse, core).
 *
 * Adapters BC importent ce module et appellent db.* directement dans leur impl.
 * Pas de CRUD métier ici.
 */
import Dexie from 'dexie';
import { reconcileHamletUnlockFlags } from '../hamlet/hamletUnlockMigration.js';
import { applyResidentDeltas, buildResidents, emptyResidents, residentsOfHouseId } from './residentsProjection.js';

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

// v18: the traceability rows are dated by their turn (no wall-clock date), and indexed on the fields they are written with
// (fromId, toId: the buildings; fromInstanceId, toInstanceId and the date were never written).
db.version(18).stores({
  supplyTraceability: '++id, hamletId, turn, month, year, transactionType, fromId, toId, foodType',
});

// v19: journal lines are dated by their turn too: the wall-clock date is no longer written, so it is no longer indexed.
db.version(19).stores({
  journal: '++id, hamletId, turn, type, amount, description',
});

// v20: customs policy events — every change of a duty, dated by its turn and appended, never edited: who set which duty on
// which good, from what to what, and why (cause). The trace a trade war is told with.
db.version(20).stores({
  tradePolicyEvents: '++id, turn, authority, flow, good',
});

// v21: the wage the labour market gives each (skill, level) — appended on each move, never edited, so the history of a wage reads back
// with the shortage or the slack that moved it.
db.version(21).stores({
  wageRates: '++id, hamletId, turn, skill, level',
});

// v22: the traceability is read by month (a month's settlement reads that month's flows) and written once per business key (an economy movement is never written twice).
// Both went through `transactionType` and a filter over every row of that type, so they slowed down with the age of the game: `businessKey` is indexed for the second,
// `[hamletId+year+month]` for the first.
db.version(22).stores({
  supplyTraceability: '++id, hamletId, turn, month, year, transactionType, fromId, toId, foodType, businessKey, [hamletId+year+month]',
});

// v23: the inhabitants, one row each (see shared/citizens/Citizen.js). Read by hamlet (one query for the whole hamlet), written by house.
db.version(23).stores({
  citizens: 'id, houseId, hamletId',
});

// The residents of a house are its citizens (residentsProjection.js): `pop` is not stored on the house row, it is served on every read of the table from the count the
// citizens make. The citizens' hooks keep that count: a change moves it at once (what the code reads right after writing is true), and a transaction that fails gives
// back what it moved.
//
// Two facts of Dexie shape this. The promise of a transaction settles BEFORE its `complete` event (so waiting for the commit would leave a stale count), and it rejects
// BEFORE the `abort` event (so waiting for the abort would leave the count wrong for the caller that catches the failure). The count is therefore given back by
// `db.transaction` itself, as it rejects, and the `abort` event is only the net for an abort that comes from elsewhere. A nested transaction is the same IndexedDB
// transaction as its parent, so everything is kept against the outermost one.
const movedByTransaction = new WeakMap();

function outermost(transaction) {
  let root = transaction;
  while (root.parent) root = root.parent;
  return root;
}

/** Give back what a transaction moved. Idempotent: what it moved is forgotten as it is given back. */
function giveBackResidents(root) {
  const moved = movedByTransaction.get(root);
  if (!moved) return;
  movedByTransaction.delete(root);
  applyResidentDeltas(new Map([...moved].map(([houseId, total]) => [houseId, -total])));
}

function recordResidentChange(innerTransaction, houseId, delta) {
  const root = outermost(innerTransaction);
  let moved = movedByTransaction.get(root);
  if (!moved) {
    moved = new Map();
    movedByTransaction.set(root, moved);
    root.on('abort', () => giveBackResidents(root));
    root.on('complete', () => movedByTransaction.delete(root));
  }
  moved.set(houseId, (moved.get(houseId) ?? 0) + delta);
  applyResidentDeltas(new Map([[houseId, delta]]));
  // The way back for a write that fails on its own (a duplicate id, say) without aborting the transaction.
  return () => {
    if (movedByTransaction.get(root) !== moved) return; // already given back with its transaction
    moved.set(houseId, moved.get(houseId) - delta);
    applyResidentDeltas(new Map([[houseId, -delta]]));
  };
}

const runTransaction = db.transaction.bind(db);
db.transaction = (...args) => {
  const scope = args.pop();
  let started = null;
  // Dexie must see an async function here (it wraps those so a native `await` keeps the transaction alive), whatever kind of function the caller gave.
  return runTransaction(...args, async function scopeOfTransaction(...scopeArgs) {
    started = Dexie.currentTransaction;
    return scope.apply(this, scopeArgs);
  }).catch((error) => {
    if (started) giveBackResidents(outermost(started));
    throw error;
  });
};

db.citizens.hook('creating', function countArrival(primKey, citizen, transaction) {
  const undo = recordResidentChange(transaction, citizen.houseId, 1);
  this.onerror = undo;
});
db.citizens.hook('deleting', function countDeparture(primKey, citizen, transaction) {
  const undo = recordResidentChange(transaction, citizen.houseId, -1);
  this.onerror = undo;
});
db.citizens.hook('updating', (modifications, primKey, citizen, transaction) => {
  if (!('houseId' in modifications) || modifications.houseId === citizen.houseId) return;
  recordResidentChange(transaction, citizen.houseId, -1);
  recordResidentChange(transaction, modifications.houseId, 1);
});

async function countResidentsFromTable() {
  const houseIds = [];
  await db.citizens.each((citizen) => houseIds.push(citizen.houseId));
  buildResidents(houseIds);
}
db.houses.hook('reading', (row) => {
  // A read that finds nothing hands the hook nothing: there is no house to count the residents of.
  if (!row) return row;
  row.pop = residentsOfHouseId(row.instanceId);
  return row;
});
// `clear()` fires no hook: a table emptied (a new game, a test) leaves nobody anywhere.
const clearCitizens = db.citizens.clear.bind(db.citizens);
db.citizens.clear = async () => {
  const transaction = Dexie.currentTransaction;
  await clearCitizens();
  emptyResidents();
  // If the transaction that emptied the table aborts, the citizens are back: count them again.
  if (transaction) transaction.on('abort', () => countResidentsFromTable());
};
// The first time the database opens, the residents are counted from the table before anything reads a house. (`ready` does not fire again when the same connection is closed and
// reopened, so a deletion, which leaves nobody anywhere, empties the count itself.)
db.on('ready', countResidentsFromTable);
const deleteDatabase = db.delete.bind(db);
db.delete = async (...args) => {
  await deleteDatabase(...args);
  emptyResidents();
};

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

/** Tables that outlive a game: the cheat codes the player has activated, not the game's data. */
const TABLES_KEPT_ACROSS_GAMES = Object.freeze(['cheatCodes']);

/**
 * A new game starts from nothing: the whole database is deleted (schema and every table: buildings, citizens, hamlets, journal, traceability, news, trade relations,
 * objectives, clock, calendar) and created again, so the next boot builds them afresh. Only the tables that outlive a game (the cheat codes) are read before and written
 * back after. Called only for a boot that follows a menu choice of a new game — never on a plain reload.
 *
 * Other tabs holding the database open are closed by Dexie on the version change; a connection of this tab that stays open would block the deletion, which then does not
 * finish: nothing of this tab uses the database while this runs (it is awaited before the game boots).
 * @returns {Promise<void>}
 */
export async function deleteGameDatabaseForNewGame() {
  await waitForDatabaseReady();
  const kept = new Map();
  for (const name of TABLES_KEPT_ACROSS_GAMES) kept.set(name, await db.table(name).toArray());
  // The next `waitForDatabaseReady` must open the new database, not hand back the promise of the old one.
  dbReadyPromise = null;
  db.close();
  await db.delete();
  await waitForDatabaseReady();
  // The deletion is checked, not trusted: a table that still holds a row means the old game is still there.
  for (const table of db.tables) {
    if (TABLES_KEPT_ACROSS_GAMES.includes(table.name)) continue;
    const left = await table.count();
    if (left > 0) throw new Error(`[db] the game database was not deleted: ${table.name} still holds ${left} row(s)`);
  }
  // The residents are counted again on opening (`ready`): the new database has none.
  for (const [name, rows] of kept) {
    if (rows.length > 0) await db.table(name).bulkAdd(rows);
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
