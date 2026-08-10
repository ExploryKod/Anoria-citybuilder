import { registerSW } from 'virtual:pwa-register'
import { showInfoToast, showSuccessToast, showWarningToast, showErrorToast } from './presentation/dom/shell/ToastNotifier.js'

const UPDATE_TOAST_TIMEOUT = 3500
const LAST_UPDATE_KEY = 'anoria.pwaLastUpdateAt'

/** Évite un double enregistrement si initPWA est appelé plusieurs fois. */
let pwaInitialized = false

/** @type {ServiceWorkerRegistration | null} */
let swRegistration = null

/** @type {((reloadPage?: boolean) => Promise<void>) | null} */
let updateSW = null

/** @type {string | null} */
let registeredSwUrl = null

/**
 * Enregistre le service worker (mode autoUpdate) et affiche un toast informatif
 * limité dans le temps — sans demander de confirmation à l'utilisateur.
 *
 * Note : avec `registerType: 'autoUpdate'`, le callback `onNeedRefresh` n'est
 * jamais appelé par vite-plugin-pwa. On écoute donc `updatefound` sur la
 * registration pour prévenir avant le reload automatique.
 */
export function initPWA() {
  if (pwaInitialized) return
  pwaInitialized = true

  // Vérifie les mises à jour toutes les heures
  const period = 60 * 60 * 1000

  const start = () => {
    updateSW = registerSW({
      immediate: true,
      onOfflineReady() {
        showInfoToast("📱 L'app est disponible hors ligne.", {
          timeout: UPDATE_TOAST_TIMEOUT,
        })
      },
      onRegisteredSW(swUrl, registration) {
        registeredSwUrl = swUrl || null
        if (!registration) return
        swRegistration = registration

        // Prévenir (toast auto-dismiss) quand une nouvelle version est détectée.
        // Le reload est ensuite déclenché automatiquement par vite-plugin-pwa
        // (événement `activated` + isUpdate) — pas de bouton « Recharger ».
        registration.addEventListener('updatefound', () => {
          const installing = registration.installing
          if (!installing) return

          installing.addEventListener('statechange', () => {
            // Une mise à jour (pas la 1ʳᵉ install) : un controller existe déjà.
            if (
              installing.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              showSuccessToast(
                '🆕 Nouvelle version installée, mise à jour en cours…',
                { timeout: UPDATE_TOAST_TIMEOUT }
              )
              markPwaUpdatedNow()
            }
          })
        })

        if (period <= 0) return
        if (registration.active?.state === 'activated') {
          registerPeriodicSync(period, swUrl, registration)
        } else if (registration.installing) {
          registration.installing.addEventListener('statechange', (e) => {
            /** @type {ServiceWorker} */
            const sw = e.target
            if (sw.state === 'activated') {
              registerPeriodicSync(period, swUrl, registration)
            }
          })
        }
      },
    })
  }

  if (document.readyState === 'complete') {
    start()
  } else {
    window.addEventListener('load', start, { once: true })
  }
}

/**
 * @returns {string | null} ISO date of last applied PWA update, if any
 */
export function getLastPwaUpdateAt() {
  try {
    return localStorage.getItem(LAST_UPDATE_KEY)
  } catch {
    return null
  }
}

function markPwaUpdatedNow() {
  try {
    localStorage.setItem(LAST_UPDATE_KEY, new Date().toISOString())
  } catch {
    /* ignore */
  }
}

/**
 * @param {ServiceWorker} worker
 * @param {string} state
 * @param {number} [timeoutMs]
 */
function waitForWorkerState(worker, state, timeoutMs = 15000) {
  if (worker.state === state) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      worker.removeEventListener('statechange', onChange)
      reject(new Error(`Timeout waiting for SW state: ${state}`))
    }, timeoutMs)

    function onChange() {
      if (worker.state === state) {
        clearTimeout(timer)
        worker.removeEventListener('statechange', onChange)
        resolve()
      }
    }

    worker.addEventListener('statechange', onChange)
  })
}

function waitForControllerChange(timeoutMs = 8000) {
  return new Promise((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
      clearTimeout(timer)
      resolve()
    }
    const onChange = () => done()
    const timer = setTimeout(done, timeoutMs)
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
  })
}

/**
 * Ask a waiting worker to take over (vite-plugin-pwa / Workbox listen for this).
 * @param {ServiceWorker | null | undefined} worker
 */
function requestSkipWaiting(worker) {
  if (!worker) return
  try {
    worker.postMessage({ type: 'SKIP_WAITING' })
  } catch {
    /* ignore */
  }
}

/**
 * Clear Cache Storage so the next load can re-fetch precached assets.
 * Does not wipe IndexedDB / localStorage (saves stay intact).
 */
async function clearAppCaches() {
  if (!('caches' in window)) return
  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
}

/**
 * Manual “Installer” action from Paramètres: check for a new SW, apply it, reload.
 * If the SW reports no update, still clear caches and reload so mobile PWA picks
 * up a fresh deploy that the hourly poll has not seen yet.
 *
 * @returns {Promise<'updated' | 'refreshed' | 'unsupported' | 'error'>}
 */
export async function installLatestPwaUpdate() {
  if (!('serviceWorker' in navigator)) {
    showWarningToast('Mise à jour PWA indisponible sur ce navigateur.', {
      timeout: UPDATE_TOAST_TIMEOUT,
    })
    return 'unsupported'
  }

  showInfoToast('Recherche d’une mise à jour…', { timeout: 2500 })

  try {
    const registration =
      swRegistration ||
      (await navigator.serviceWorker.getRegistration()) ||
      null

    if (registration) {
      swRegistration = registration

      if (registeredSwUrl) {
        try {
          await fetch(registeredSwUrl, {
            cache: 'no-store',
            headers: {
              cache: 'no-store',
              'cache-control': 'no-cache',
            },
          })
        } catch {
          /* still try registration.update() */
        }
      }

      await registration.update()

      if (registration.installing) {
        await waitForWorkerState(registration.installing, 'installed').catch(() => {})
      }

      if (registration.waiting) {
        requestSkipWaiting(registration.waiting)
        if (typeof updateSW === 'function') {
          try {
            await updateSW(true)
          } catch {
            /* fall through to reload */
          }
        }
        markPwaUpdatedNow()
        showSuccessToast('🆕 Mise à jour installée, rechargement…', {
          timeout: UPDATE_TOAST_TIMEOUT,
        })
        await waitForControllerChange()
        window.location.reload()
        return 'updated'
      }
    }

    // No waiting worker: force a clean reload so assets re-fetch from the network.
    await clearAppCaches()
    if (typeof updateSW === 'function') {
      try {
        await updateSW(true)
      } catch {
        /* ignore */
      }
    }
    markPwaUpdatedNow()
    showSuccessToast('Rechargement de la dernière version…', {
      timeout: UPDATE_TOAST_TIMEOUT,
    })
    window.location.reload()
    return 'refreshed'
  } catch (error) {
    console.error('[PWA] installLatestPwaUpdate failed:', error)
    showErrorToast('Impossible d’installer la mise à jour.', {
      timeout: UPDATE_TOAST_TIMEOUT,
    })
    return 'error'
  }
}

/**
 * @param {number} period
 * @param {string} swUrl
 * @param {ServiceWorkerRegistration} registration
 */
function registerPeriodicSync(period, swUrl, registration) {
  if (period <= 0) return

  setInterval(async () => {
    if ('onLine' in navigator && !navigator.onLine) return

    const resp = await fetch(swUrl, {
      cache: 'no-store',
      headers: {
        cache: 'no-store',
        'cache-control': 'no-cache',
      },
    })

    if (resp?.status === 200) {
      await registration.update()
    }
  }, period)
}
