/**
 * Dexie bootstrap — connexion + schéma IndexedDB (transverse, core).
 *
 * Adapters BC importent ce module et appellent db.* directement dans leur impl.
 * Pas de CRUD métier ici.
 */
import Dexie from 'dexie';

const db = new Dexie('anoriaDb');

const stores = {
  houses: 'instanceId, kind, type, [anchorX+anchorY], [kind+type]',
  game: 'name',
  budget: 'name',
  objectives: 'name',
  journal: '++id, turn, date, type, amount, description',
  foodTraceability:
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
  await tx.table('houses').toCollection().modify((row) => {
    if (!row.hamletId) {
      row.hamletId = 'eraanurbs';
    }
  });
});

db.version(4).stores({
  cheatCodes: 'code, activatedAt',
}).upgrade(async (tx) => {
  await tx.table('hamlets').toCollection().modify((row) => {
    if (row.unlocked === undefined) {
      row.unlocked = row.id === 'eraanurbs' || Boolean(row.natureSeeded);
    }
  });
});

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
