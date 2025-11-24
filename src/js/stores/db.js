// db.js
import Dexie from 'dexie';

const db = new Dexie('anoriaDb');

// Delete the database upon initialization (fresh start each time)
db.delete({ disableAutoOpen: false })
    .then(() => {
        // Recreate the database with the desired schema
        db.version(1).stores({
            houses: 'name, [name+price]',
            game: 'name',
            budget: 'name',
            objectives: 'name', // Store pour les échecs et succès d'objectifs
            journal: '++id, turn, date, type, amount, description', // Journal des écritures comptables
            foodTraceability: '++id, turn, month, year, date, transactionType, fromId, fromCoords, toId, toCoords, foodType, quantity, price' // Traçabilité alimentaire
        });
        // Database cleared and recreated successfully
    })
    .catch((err) => {
        console.error('Error clearing and recreating the database:', err);
    });

export default db;
