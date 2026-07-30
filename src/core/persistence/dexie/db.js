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

function clearLegacyLocalStorage() {
  try {
    localStorage.removeItem('journal_year_end_balances');
    localStorage.removeItem('citizen_tax_amount');
    localStorage.removeItem('commerce_config');
    localStorage.removeItem('commerce_stats');
  } catch (error) {
    console.warn('[core/persistence/dexie/db] Error clearing localStorage:', error);
  }
}

if (isTestEnv) {
  db.version(1).stores(stores);
} else {
  db.delete({ disableAutoOpen: false })
    .then(() => {
      db.version(1).stores(stores);
      clearLegacyLocalStorage();
    })
    .catch((err) => {
      console.error('[core/persistence/dexie/db] Error clearing and recreating the database:', err);
    });
}

export default db;
