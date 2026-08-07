function resetLocalStorage() {
  Object.keys(localStorage).forEach((key) => {
    localStorage.removeItem(key);
  });
  localStorage.clear();
}

/** Full wipe: SW, caches, storage, then reload. */
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
      indexedDB.databases().then((databases) => {
        databases.forEach((db) => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
    window.location.reload(true);
  } catch (error) {
    console.error('Error during reset:', error);
    window.location.reload(true);
  }
}
