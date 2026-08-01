function resetLocalStorage() {
  Object.keys(localStorage).forEach((key) => {
    localStorage.removeItem(key);
  });
  localStorage.clear();
}

async function performReset() {
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

export function initResetGameFlow() {
  const modal = document.getElementById('reset-confirm-panel');
  if (!modal) {
    console.error('Reset confirm panel not found');
    return;
  }

  if (modal.classList.contains('listeners-attached')) {
    modal.classList.add('visible');
    return;
  }

  modal.classList.add('visible');
  modal.classList.add('listeners-attached');

  const cancelBtn = modal.querySelector('.reset-confirm-cancel-btn');
  const resetBtn = modal.querySelector('.reset-confirm-reset-btn');

  cancelBtn.addEventListener('click', () => {
    modal.classList.remove('visible');
  });

  resetBtn.addEventListener('click', async () => {
    modal.classList.remove('visible');
    await performReset();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('visible')) {
      modal.classList.remove('visible');
    }
  });
}
