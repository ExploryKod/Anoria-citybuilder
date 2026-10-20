import { clearGameTablesForNewGame, waitForDatabaseReady } from '../../../core/persistence/dexie/db.js';

/** The game's own database: emptied table by table (cheat codes kept), never deleted. */
const GAME_DATABASE = 'anoriaDb';

/** Resolves once the database is gone; another open connection makes the deletion wait, it is not skipped. */
function deleteIndexedDb(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => console.warn(`[reset] ${name} is still open elsewhere; waiting`);
  });
}

function resetLocalStorage() {
  Object.keys(localStorage).forEach((key) => {
    localStorage.removeItem(key);
  });
  localStorage.clear();
}

/**
 * New game from scratch: service worker, caches and every browser storage are cleared, the game's tables are
 * emptied (the cheat codes the player activated are the one thing kept), then back to the menu.
 */
export async function performReset() {
  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }

    if ('caches' in window) {
      const cacheNames = await caches.keys();
      for (const cacheName of cacheNames) {
        await caches.delete(cacheName);
      }
    }

    resetLocalStorage();
    sessionStorage.clear();

    await waitForDatabaseReady();
    await clearGameTablesForNewGame();
    if ('indexedDB' in window) {
      const databases = await indexedDB.databases();
      for (const database of databases) {
        if (database.name && database.name !== GAME_DATABASE) {
          await deleteIndexedDb(database.name);
        }
      }
    }

    window.location.replace('/');
  } catch (error) {
    throw new Error(`[reset] the game was not reset: ${error.message}`, { cause: error });
  }
}
