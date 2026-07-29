// db.js
import Dexie from 'dexie';

const db = new Dexie('anoriaDb');

// Delete the database upon initialization (fresh start each time)
db.delete({ disableAutoOpen: false })
    .then(() => {
        db.version(1).stores({
            houses: 'instanceId, kind, type, [anchorX+anchorY], [kind+type]',
            game: 'name',
            budget: 'name',
            objectives: 'name',
            journal: '++id, turn, date, type, amount, description',
            foodTraceability: '++id, turn, month, year, date, transactionType, fromInstanceId, fromCoords, toInstanceId, toCoords, foodType, quantity, price',
            productionJournal: '++id, turn, month, year, date, factoryId, eventType, resourceType, quantity, price, remainingStocks, logsConsumed, productionTurns',
        });

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
