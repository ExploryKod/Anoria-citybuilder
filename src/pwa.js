import { registerSW } from 'virtual:pwa-register'
import { showInfoToast, showSuccessToast } from './presentation/dom/shell/ToastNotifier.js'

const UPDATE_TOAST_TIMEOUT = 3500

/** Évite un double enregistrement si initPWA est appelé plusieurs fois. */
let pwaInitialized = false

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
    registerSW({
      immediate: true,
      onOfflineReady() {
        showInfoToast("📱 L'app est disponible hors ligne.", {
          timeout: UPDATE_TOAST_TIMEOUT,
        })
      },
      onRegisteredSW(swUrl, registration) {
        if (!registration) return

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
