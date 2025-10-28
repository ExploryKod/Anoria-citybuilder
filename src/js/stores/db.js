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
        });
        // Database cleared and recreated successfully
    })
    .catch((err) => {
        console.error('Error clearing and recreating the database:', err);
    });

export default db;
