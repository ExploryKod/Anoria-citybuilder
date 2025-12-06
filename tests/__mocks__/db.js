/**
 * Mock de db.js pour les tests
 * 
 * Évite le problème où db.js essaie de supprimer la base au chargement,
 * ce qui ne fonctionne pas avec fake-indexeddb.
 */

import Dexie from 'dexie';

const db = new Dexie('anoriaDb');

// Créer le schéma sans essayer de supprimer la base
db.version(1).stores({
    houses: 'name, [name+price]',
    game: 'name',
    budget: 'name',
    objectives: 'name',
    journal: '++id, turn, date, type, amount, description',
    foodTraceability: '++id, turn, month, year, date, transactionType, fromId, fromCoords, toId, toCoords, foodType, quantity, price'
});

export default db;

