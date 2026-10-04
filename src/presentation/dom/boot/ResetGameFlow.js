import db from '../../../core/persistence/dexie/db.js';

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

/** Full wipe: SW, caches, storage, then back to /game so the hamlets are created again. */
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

    if ('indexedDB' in window) {
      db.close();
      const databases = await indexedDB.databases();
      for (const database of databases) {
        if (database.name) {
          await deleteIndexedDb(database.name);
        }
      }
    }

    window.location.replace('/game');
  } catch (error) {
    throw new Error(`[reset] the game was not reset: ${error.message}`, { cause: error });
  }
}
