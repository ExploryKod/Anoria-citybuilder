/**
 * Jest Setup File
 * 
 * Configure l'environnement de test pour simuler les variables Vite
 * et autres globales nécessaires au fonctionnement du code.
 */

// IMPORTANT: Initialiser fake-indexeddb AVANT tout autre import
// Cela permet de mocker IndexedDB avant que db.js ne soit chargé
import 'fake-indexeddb/auto';

// Mock import.meta.env (spécifique à Vite, n'existe pas dans Node.js)
globalThis.import = {
    meta: {
        env: {
            VITE_INITIAL_FUNDS: undefined,
            VITE_DAYS_PER_MONTH: undefined,
            MODE: 'test',
            DEV: false,
            PROD: false,
        }
    }
};

// Mock process.env pour les fonctions qui l'utilisent
process.env.NODE_ENV = 'test';

// Mock localStorage pour les tests
if (typeof globalThis.localStorage === 'undefined') {
    const localStorageMock = (() => {
        let store = {};
        return {
            getItem: (key) => store[key] || null,
            setItem: (key, value) => {
                store[key] = String(value);
            },
            removeItem: (key) => {
                delete store[key];
            },
            clear: () => {
                store = {};
            },
            get length() {
                return Object.keys(store).length;
            },
            key: (index) => {
                const keys = Object.keys(store);
                return keys[index] || null;
            }
        };
    })();
    globalThis.localStorage = localStorageMock;
}

