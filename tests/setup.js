/**
 * Jest Setup File
 * 
 * Configure l'environnement de test pour simuler les variables Vite
 * et autres globales nécessaires au fonctionnement du code.
 */

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

