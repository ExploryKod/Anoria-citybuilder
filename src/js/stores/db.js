// db.js
import Dexie from 'dexie';

const db = new Dexie('anoriaDb');

// Delete the database upon initialization
db.delete({ disableAutoOpen: false })
    .then(() => {
        // Recreate the database with the desired schema
        db.version(1).stores({
            houses: 'name, [name+price]',
            game: 'name',
        });
        console.log('Database cleared and recreated successfully.');
    })
    .catch((err) => {
        console.error('Error clearing and recreating the database:', err);
    });

export default db;
