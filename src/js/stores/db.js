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
            foodTraceability: '++id, turn, month, year, date, transactionType, fromId, fromCoords, toId, toCoords, foodType, quantity, price', // Traçabilité alimentaire
            productionJournal: '++id, turn, month, year, date, factoryId, eventType, resourceType, quantity, price, remainingStocks, logsConsumed, productionTurns' // Journal de production des factories
        });
        // Database cleared and recreated successfully
        
        // Clear localStorage items (same reset logic as IndexedDB)
        try {
            localStorage.removeItem('journal_year_end_balances');
            localStorage.removeItem('citizen_tax_amount');
            localStorage.removeItem('commerce_config');
            localStorage.removeItem('commerce_stats');
        } catch (error) {
            console.warn('[db.js] Error clearing localStorage:', error);
        }
    })
    .catch((err) => {
        console.error('Error clearing and recreating the database:', err);
    });

export default db;
