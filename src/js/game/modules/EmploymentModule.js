import { SimModule } from './SimModule.js';

/**
 * EmploymentModule - Manages employment state for buildings
 * Works with IndexedDB employees object as source of truth
 * 
 * Simple first version: workers only
 * Future: elites, age-based filtering, priorities
 */
export class EmploymentModule extends SimModule {
    /**
     * Current employment data from IndexedDB
     * @type {Object}
     */
    employees = {
        worker: 0,
        worker_need: 0
    };

    /**
     * Updates module state from IndexedDB employees data
     * @param {Object} employees - Employees object from housesStore
     */
    updateFromEmployees(employees) {
        this.employees = employees || { worker: 0, worker_need: 0 };
    }

    /**
     * Checks if building needs workers
     * @returns {boolean}
     */
    needsWorkers() {
        return this.getWorkerDeficit() > 0;
    }

    /**
     * Gets worker deficit (how many more workers needed)
     * @returns {number}
     */
    getWorkerDeficit() {
        const need = this.employees.worker_need || 0;
        const have = this.employees.worker || 0;
        return Math.max(0, need - have);
    }

    /**
     * Checks if building is fully staffed
     * @returns {boolean}
     */
    isFullyStaffed() {
        return this.getWorkerDeficit() === 0;
    }

    /**
     * Gets employment percentage (0-100)
     * @returns {number}
     */
    getEmploymentRate() {
        const need = this.employees.worker_need || 0;
        if (need === 0) return 100;
        const have = this.employees.worker || 0;
        return Math.min(100, Math.round((have / need) * 100));
    }

    /**
     * Checks if building has any workers assigned
     * @returns {boolean}
     */
    hasWorkers() {
        return (this.employees.worker || 0) > 0;
    }

    /**
     * Gets current worker count
     * @returns {number}
     */
    getWorkerCount() {
        return this.employees.worker || 0;
    }

    /**
     * Gets required worker count
     * @returns {number}
     */
    getWorkerNeed() {
        return this.employees.worker_need || 0;
    }

    /**
     * Returns HTML representation for info panels
     * @returns {string}
     */
    toHTML() {
        const worker = this.employees.worker || 0;
        const workerNeed = this.employees.worker_need || 0;
        const rate = this.getEmploymentRate();
        
        if (workerNeed === 0) {
            return `<span class="info-label">Employés</span><span class="info-value">N/A</span><br>`;
        }

        return `
            <span class="info-label">Ouvriers</span>
            <span class="info-value">${worker} / ${workerNeed}</span>
            <br>
            <span class="info-label">Taux d'emploi</span>
            <span class="info-value">${rate}%</span>
            <br>
        `;
    }
}

