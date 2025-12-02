import config from '../game/config.js';

class WorkSectionManager {
    constructor() {
        this.salary = 30;
        this.unemploymentRate = 50;
        this.workData = null;
        this.employmentPriorityService = null;
    }
    
    /**
     * Set the employment priority service instance
     * @param {EmploymentPriorityService} service - Service instance
     */
    setPriorityService(service) {
        this.employmentPriorityService = service;
    }

    async init() {
        this.setupEventListeners();
        await this.loadWorkData();
        // No automatic refresh - data is read directly from IndexedDB when panel opens
        // Just like info panel, it shows current state at that moment
    }

    setupEventListeners() {
        const salaryDecreaseBtn = document.getElementById('salary-decrease-btn');
        const salaryIncreaseBtn = document.getElementById('salary-increase-btn');
        const unemploymentDecreaseBtn = document.getElementById('unemployment-decrease-btn');
        const unemploymentIncreaseBtn = document.getElementById('unemployment-increase-btn');

        if (salaryDecreaseBtn) {
            salaryDecreaseBtn.addEventListener('click', () => this.adjustSalary(-1));
        }

        if (salaryIncreaseBtn) {
            salaryIncreaseBtn.addEventListener('click', () => this.adjustSalary(1));
        }

        if (unemploymentDecreaseBtn) {
            unemploymentDecreaseBtn.addEventListener('click', () => this.adjustUnemploymentRate(-5));
        }

        if (unemploymentIncreaseBtn) {
            unemploymentIncreaseBtn.addEventListener('click', () => this.adjustUnemploymentRate(5));
        }

        // Priority inputs are now handled in renderWorkTable() with event listeners attached during creation
        // This avoids issues with dynamically generated elements
    }

    async loadWorkData() {
        // If service is available, load priorities from it
        if (this.employmentPriorityService) {
            const allPriorities = this.employmentPriorityService.getAllPriorities();
            // Update priorities in work data
            if (this.workData) {
                this.workData.sectors.forEach(sector => {
                    if (sector.sectorNumber !== undefined) {
                        sector.priority = allPriorities[sector.sectorNumber] || sector.priority;
                    }
                });
            }
        }
        
        // Generate or regenerate work data
        this.workData = this.generatePlaceholderWorkData();
        
        // Load employee statistics from IndexedDB (independent of service)
        await this.updateEmployeeStatistics();
        
        this.render();
    }
    
    /**
     * Calculate available workers and elites from houses (same logic as service but direct from IndexedDB)
     * - Elites: 1/6 of House-2Story (Palace) population (or 0 if no 2Story)
     * - Workers: All population from House-Blue, House-Red, House-Purple + remaining 5/6 of House-2Story
     * @param {Array} allHouses - All houses from IndexedDB
     * @returns {{workers: number, elites: number}}
     */
    calculateAvailableEmployees(allHouses) {
        let workerPopulation = 0;
        let elitePopulation = 0;
        
        for (const house of allHouses) {
            const type = house.type || '';
            const pop = house.pop || 0;
            
            if (type.includes('House')) {
                // House-2Story (Palace): 1/6 becomes elite, 5/6 remain workers
                if (type.includes('2Story') || type.includes('2-Story')) {
                    const elitesFromThisHouse = Math.floor(pop / 6);
                    const workersFromThisHouse = pop - elitesFromThisHouse;
                    elitePopulation += elitesFromThisHouse;
                    workerPopulation += workersFromThisHouse;
                }
                // Other houses (Blue, Red, Purple): all population are workers
                else if (type.includes('Blue') || type.includes('Red') || type.includes('Purple')) {
                    workerPopulation += pop;
                }
            }
        }
        
        return { workers: workerPopulation, elites: elitePopulation };
    }
    
    /**
     * Update employee statistics directly from IndexedDB (like info panel does)
     */
    async updateEmployeeStatistics() {
        // Get housesStore (same way info panel does)
        let housesStore = null;
        if (window.app && window.app.housesStore) {
            housesStore = window.app.housesStore;
        } else if (window.housesStore) {
            housesStore = window.housesStore;
        } else if (window.game && window.game.housesStore) {
            housesStore = window.game.housesStore;
        }
        
        if (!housesStore) {
            console.warn('[WorkSection] housesStore not available');
            return;
        }
        
        try {
            // Read all buildings from IndexedDB (source of truth)
            const allBuildings = await housesStore.listAllHouses();
            
            // Calculate available employees from houses
            const available = this.calculateAvailableEmployees(allBuildings);
            
            // Calculate statistics by sector
            let totalWorkerNeed = 0;
            let totalEliteNeed = 0;
            let totalWorkers = 0;
            let totalElites = 0;
            const bySector = {};
            
            for (const building of allBuildings) {
                if (!building.employees) continue;
                
                const employees = building.employees;
                const sector = employees.sector || 0;
                
                // Skip residential (sector 0)
                if (sector === 0) continue;
                
                // Initialize sector if not exists
                if (!bySector[sector]) {
                    bySector[sector] = {
                        workerNeed: 0,
                        eliteNeed: 0,
                        workers: 0,
                        elites: 0
                    };
                }
                
                const workerNeed = employees.worker_need || 0;
                const eliteNeed = employees.elite_need || 0;
                const workers = employees.worker || 0;
                const elites = employees.elite || 0;
                
                totalWorkerNeed += workerNeed;
                totalEliteNeed += eliteNeed;
                totalWorkers += workers;
                totalElites += elites;
                
                bySector[sector].workerNeed += workerNeed;
                bySector[sector].eliteNeed += eliteNeed;
                bySector[sector].workers += workers;
                bySector[sector].elites += elites;
            }
            
            // Update sector data with real statistics
            if (this.workData && this.workData.sectors) {
                this.workData.sectors.forEach(sector => {
                    if (sector.sectorNumber !== undefined) {
                        const sectorStats = bySector[sector.sectorNumber] || {
                            workerNeed: 0,
                            eliteNeed: 0,
                            workers: 0,
                            elites: 0
                        };
                        
                        // Store detailed breakdown
                        sector.workerNeed = sectorStats.workerNeed || 0;
                        sector.eliteNeed = sectorStats.eliteNeed || 0;
                        sector.workers = sectorStats.workers || 0;
                        sector.elites = sectorStats.elites || 0;
                        // City-wide available (same for all sectors)
                        sector.availableWorkers = available.workers;
                        sector.availableElites = available.elites;
                        
                        // Total need = workers + elites
                        sector.need = sector.workerNeed + sector.eliteNeed;
                        // Total have = workers + elites
                        sector.have = sector.workers + sector.elites;
                    }
                });
            }
            
            // Update total employed (total workers + elites assigned)
            this.workData.totalEmployed = totalWorkers + totalElites;
            
            // Calculate unemployment/lack
            const totalNeed = totalWorkerNeed + totalEliteNeed;
            const totalAvailable = available.workers + available.elites;
            const totalAssigned = totalWorkers + totalElites;
            
            // Unemployed = available but not assigned
            this.workData.totalUnemployed = Math.max(0, totalAvailable - totalAssigned);
            
            // Lack = need but not available/assigned
            const totalLack = Math.max(0, totalNeed - totalAssigned);
            
            // Calculate unemployment percentage
            if (totalAvailable > 0) {
                this.workData.unemploymentPercentage = Math.round(
                    (this.workData.totalUnemployed / totalAvailable) * 100
                );
            } else {
                this.workData.unemploymentPercentage = 0;
            }
            
            // Store lack for display
            this.workData.totalLack = totalLack;
            this.workData.totalAvailable = totalAvailable;
            this.workData.totalNeed = totalNeed;
            
            // Store city-wide available workers/elites for all sectors
            this.workData.totalAvailableWorkers = available.workers;
            this.workData.totalAvailableElites = available.elites;
            
        } catch (error) {
            console.error('[WorkSection] Error updating employee statistics:', error);
        }
    }

    generatePlaceholderWorkData() {
        // Get sectors from config
        const sectors = config.employment?.sectors || {};
        const defaultPriorities = config.employment?.defaultPriorities || {};
        
        // Generate sectors from config
        const sectorList = Object.entries(sectors).map(([sectorNum, sectorName]) => {
            const secNum = parseInt(sectorNum, 10);
            // Get priority from service if available, otherwise use default
            let priority = defaultPriorities[secNum] || 1;
            if (this.employmentPriorityService) {
                priority = this.employmentPriorityService.getSectorPriority(secNum);
            }
            
            return {
                id: `sector-${secNum}`, // Use sector number as ID
                sectorNumber: secNum, // Store sector number for priority updates
                name: sectorName,
                priority: priority,
                need: 0, // Combined worker + elite need
                have: 0, // Combined worker + elite assigned
                workerNeed: 0,
                eliteNeed: 0,
                workers: 0,
                elites: 0,
                availableWorkers: 0,
                availableElites: 0
            };
        });
        
        return {
            sectors: sectorList,
            totalEmployed: 0,
            totalUnemployed: 0,
            unemploymentPercentage: 0
        };
    }

    adjustSalary(delta) {
        const newSalary = Math.max(10, Math.min(100, this.salary + delta));
        
        if (newSalary !== this.salary) {
            this.salary = newSalary;
            this.updateSalaryDisplay();
        }
    }

    adjustUnemploymentRate(delta) {
        const newRate = Math.max(0, Math.min(100, this.unemploymentRate + delta));
        
        if (newRate !== this.unemploymentRate) {
            this.unemploymentRate = newRate;
            this.updateUnemploymentDisplay();
        }
    }

    updatePriority(sector, priority) {
        if (!this.workData) return;

        const sectorData = this.workData.sectors.find(s => s.id === sector);
        if (sectorData && sectorData.sectorNumber !== undefined) {
            // Get max sectors directly from config (source of truth)
            const maxSectors = config.employment?.maxSectors || 6;
            
            // Clamp priority to valid range (1 to max sectors)
            const clampedPriority = Math.max(1, Math.min(maxSectors, priority));
            
            // Update priority in the service (which handles swapping synchronously)
            if (this.employmentPriorityService) {
                // Perform swap synchronously (just localStorage, no IndexedDB update needed immediately)
                this.employmentPriorityService.updateSectorPrioritySync(
                    sectorData.sectorNumber, 
                    clampedPriority
                );
                
                // Reload priorities to reflect swaps (synchronous)
                const allPriorities = this.employmentPriorityService.getAllPriorities();
                
                console.log('[WorkSection] Priorities after swap:', allPriorities);
                
                // Update workData with new priorities BEFORE re-render
                this.workData.sectors.forEach(sec => {
                    if (sec.sectorNumber !== undefined) {
                        const newPriority = allPriorities[sec.sectorNumber];
                        if (newPriority !== undefined) {
                            const oldPriority = sec.priority;
                            sec.priority = newPriority;
                            console.log(`[WorkSection] Sector ${sec.sectorNumber} (${sec.name}): ${oldPriority} → ${newPriority}`);
                        }
                    }
                });
                
                // Re-render immediately to show updated priorities (including swapped values)
                this.renderWorkTable();
            } else {
                // Fallback if service not available
                sectorData.priority = clampedPriority;
            }
        }
    }

    updateSalaryDisplay() {
        const salaryDisplay = document.getElementById('salary-display');
        const salaryYearDisplay = document.getElementById('salary-year-display');
        const annualBillDisplay = document.getElementById('salary-annual-bill');

        if (salaryDisplay) {
            salaryDisplay.textContent = this.salary;
        }

        if (salaryYearDisplay) {
            const yearlyAmount = this.salary * 12;
            salaryYearDisplay.textContent = yearlyAmount;
        }

        if (annualBillDisplay && this.workData) {
            const totalWorkers = this.workData.totalEmployed;
            const annualBill = totalWorkers * this.salary * 12;
            annualBillDisplay.textContent = Math.round(annualBill);
        }
    }

    updateUnemploymentDisplay() {
        const unemploymentDisplay = document.getElementById('unemployment-rate-display');
        if (unemploymentDisplay) {
            unemploymentDisplay.textContent = `${this.unemploymentRate}%`;
        }
    }

    render() {
        if (!this.workData) return;

        this.renderWorkTable();
        this.renderSummary();
        this.updateSalaryDisplay();
        this.updateUnemploymentDisplay();
    }

    renderWorkTable() {
        if (!this.workData) return;

        const tableBody = document.getElementById('work-table-body');
        if (!tableBody) return;

        // Clear existing rows (except header)
        tableBody.innerHTML = '';

        // Generate rows dynamically from config
        this.workData.sectors.forEach(sector => {
            const row = document.createElement('tr');
            row.setAttribute('data-sector', sector.id);
            row.setAttribute('data-sector-number', sector.sectorNumber); // Store sector number as data attribute
            
            // Priority column
            const priorityCell = document.createElement('td');
            priorityCell.className = 'priority-col';
            const priorityInput = document.createElement('input');
            priorityInput.type = 'number';
            priorityInput.className = 'work-priority-input';
            priorityInput.id = `priority-${sector.id}`;
            // Get max sectors directly from config (source of truth)
            const maxSectors = config.employment?.maxSectors || 6;
            priorityInput.min = '1';
            priorityInput.max = maxSectors.toString();
            priorityInput.step = '1'; // Only allow integers
            // Ensure priority value is set (use sector.priority or get from service)
            let priorityValue = sector.priority;
            if (!priorityValue && this.employmentPriorityService) {
                priorityValue = this.employmentPriorityService.getSectorPriority(sector.sectorNumber);
            }
            if (!priorityValue) {
                priorityValue = config.employment?.defaultPriorities?.[sector.sectorNumber] || 1;
            }
            priorityInput.value = priorityValue;
            // Also update sector.priority to ensure consistency
            sector.priority = priorityValue;
            priorityInput.setAttribute('aria-label', `Priorité ${sector.name}`);
            priorityInput.setAttribute('title', `Priorité entre 1 et ${maxSectors}`);
            
            // Store max value for validation (from config source of truth)
            priorityInput.dataset.maxSectors = maxSectors.toString();
            
            // Prevent typing invalid values
            priorityInput.addEventListener('keydown', (e) => {
                const max = parseInt(priorityInput.dataset.maxSectors);
                const currentValue = priorityInput.value;
                const selectionStart = priorityInput.selectionStart;
                const selectionEnd = priorityInput.selectionEnd;
                
                // Allow: backspace, delete, tab, escape, enter, and arrow keys
                if ([8, 9, 27, 13, 46, 37, 38, 39, 40].indexOf(e.keyCode) !== -1 ||
                    // Allow Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
                    (e.keyCode === 65 && e.ctrlKey === true) ||
                    (e.keyCode === 67 && e.ctrlKey === true) ||
                    (e.keyCode === 86 && e.ctrlKey === true) ||
                    (e.keyCode === 88 && e.ctrlKey === true)) {
                    return;
                }
                
                // Allow numbers only
                const isNumber = (e.keyCode >= 48 && e.keyCode <= 57) || (e.keyCode >= 96 && e.keyCode <= 105);
                if (!isNumber) {
                    e.preventDefault();
                    return;
                }
                
                // Get the digit being typed
                const digit = String.fromCharCode(e.keyCode >= 96 ? e.keyCode - 48 : e.keyCode);
                
                // Calculate what the new value would be
                const beforeSelection = currentValue.substring(0, selectionStart);
                const afterSelection = currentValue.substring(selectionEnd);
                const newValueStr = beforeSelection + digit + afterSelection;
                const newValue = parseInt(newValueStr);
                
                // Prevent if the new value would exceed max
                if (!isNaN(newValue) && newValue > max) {
                    e.preventDefault();
                    // Set to max value instead
                    priorityInput.value = max.toString();
                    priorityInput.setSelectionRange(max.toString().length, max.toString().length);
                    return;
                }
            });
            
            // Validate and clamp on input
            priorityInput.addEventListener('input', (e) => {
                let value = parseInt(e.target.value);
                const max = parseInt(e.target.dataset.maxSectors);
                
                // If empty or invalid, allow it temporarily (user might be typing)
                if (isNaN(value) || value === '') {
                    return;
                }
                
                // Clamp to valid range immediately
                if (value < 1) {
                    e.target.value = '1';
                } else if (value > max) {
                    e.target.value = max.toString();
                }
            });
            
            // Clamp on blur (when user leaves the field)
            priorityInput.addEventListener('blur', (e) => {
                let value = parseInt(e.target.value);
                const max = parseInt(e.target.dataset.maxSectors);
                
                // If empty or invalid, set to minimum
                if (isNaN(value) || value === '' || value < 1) {
                    e.target.value = '1';
                    value = 1;
                } else if (value > max) {
                    e.target.value = max.toString();
                    value = max;
                }
                
                // Update priority with clamped value (synchronous)
                this.updatePriority(sector.id, value);
            });
            
            // Handle paste events to clamp pasted values
            priorityInput.addEventListener('paste', (e) => {
                // Allow paste, then validate in next tick
                setTimeout(() => {
                    let value = parseInt(e.target.value);
                    const max = parseInt(e.target.dataset.maxSectors);
                    
                    if (isNaN(value) || value < 1) {
                        e.target.value = '1';
                        value = 1;
                    } else if (value > max) {
                        e.target.value = max.toString();
                        value = max;
                    }
                    
                    // Update if value changed (synchronous)
                    if (value !== sector.priority) {
                        this.updatePriority(sector.id, value);
                    }
                }, 0);
            });
            
            // Also handle change event
            priorityInput.addEventListener('change', (e) => {
                let value = parseInt(e.target.value);
                const max = parseInt(e.target.dataset.maxSectors);
                
                // Clamp value
                if (isNaN(value) || value < 1) {
                    value = 1;
                    e.target.value = '1';
                } else if (value > max) {
                    value = max;
                    e.target.value = max.toString();
                }
                
                // Update priority (synchronous)
                this.updatePriority(sector.id, value);
            });
            
            priorityCell.appendChild(priorityInput);
            
            // Sector name column
            const sectorCell = document.createElement('td');
            sectorCell.className = 'sector-col';
            sectorCell.textContent = sector.name;
            
            // Need column - show combined total with details on hover
            const needCell = document.createElement('td');
            needCell.className = 'need-col';
            const needContainer = document.createElement('div');
            needContainer.className = 'work-need-container';
            
            const needSpan = document.createElement('span');
            needSpan.className = sector.need > sector.have ? 'work-need-lack' : 'work-need-ok';
            needSpan.setAttribute('data-field', `need-${sector.id}`);
            const lack = sector.need - sector.have;
            if (lack > 0) {
                needSpan.textContent = `${sector.need} (-${lack})`;
            } else {
                needSpan.textContent = sector.need;
            }
            needContainer.appendChild(needSpan);
            
            // Add detail tooltip
            const needDetail = document.createElement('div');
            needDetail.className = 'work-detail-tooltip';
            needDetail.innerHTML = `
                <div class="work-detail-item">
                    <span class="work-detail-label">Ouvriers:</span>
                    <span class="work-detail-value">${sector.workerNeed || 0}</span>
                </div>
                <div class="work-detail-item">
                    <span class="work-detail-label">Élites:</span>
                    <span class="work-detail-value">${sector.eliteNeed || 0}</span>
                </div>
            `;
            needContainer.appendChild(needDetail);
            needCell.appendChild(needContainer);
            
            // Disponible column - show assigned employees with city-wide available on hover
            const haveCell = document.createElement('td');
            haveCell.className = 'have-col';
            const haveContainer = document.createElement('div');
            haveContainer.className = 'work-have-container';
            
            const haveSpan = document.createElement('span');
            haveSpan.setAttribute('data-field', `have-${sector.id}`);
            haveSpan.textContent = sector.have;
            haveContainer.appendChild(haveSpan);
            
            // Add detail tooltip showing assigned and city-wide available
            const haveDetail = document.createElement('div');
            haveDetail.className = 'work-detail-tooltip';
            haveDetail.innerHTML = `
                <div class="work-detail-item">
                    <span class="work-detail-label">Ouvriers assignés:</span>
                    <span class="work-detail-value">${sector.workers || 0}</span>
                </div>
                <div class="work-detail-item">
                    <span class="work-detail-label">Élites assignées:</span>
                    <span class="work-detail-value">${sector.elites || 0}</span>
                </div>
                <div class="work-detail-item" style="border-top: 1px solid rgba(255, 255, 255, 0.3); margin-top: 6px; padding-top: 6px;">
                    <span class="work-detail-label">Ouvriers disponibles (ville):</span>
                    <span class="work-detail-value">${sector.availableWorkers || 0}</span>
                </div>
                <div class="work-detail-item">
                    <span class="work-detail-label">Élites disponibles (ville):</span>
                    <span class="work-detail-value">${sector.availableElites || 0}</span>
                </div>
            `;
            haveContainer.appendChild(haveDetail);
            haveCell.appendChild(haveContainer);
            
            row.appendChild(priorityCell);
            row.appendChild(sectorCell);
            row.appendChild(needCell);
            row.appendChild(haveCell);
            
            tableBody.appendChild(row);
        });
    }

    renderSummary() {
        if (!this.workData) return;

        const employedElement = document.getElementById('work-employed');
        const unemployedElement = document.getElementById('work-unemployed');

        if (employedElement) {
            employedElement.textContent = this.workData.totalEmployed;
        }

        if (unemployedElement) {
            const percentage = this.workData.unemploymentPercentage;
            const lack = this.workData.totalLack || 0;
            
            if (lack > 0) {
                // Show lack if there's a shortage
                unemployedElement.textContent = `Manque: ${lack} employés`;
                unemployedElement.style.color = '#b8860b';
            } else if (this.workData.totalUnemployed > 0) {
                // Show unemployment if there are available but unassigned workers
                unemployedElement.textContent = `${this.workData.totalUnemployed} (${percentage}%)`;
                unemployedElement.style.color = '#666';
            } else {
                // All employed
                unemployedElement.textContent = '0 (0%)';
                unemployedElement.style.color = '#2d7a2d';
            }
        }
    }

    updateWorkData(sectors, totalEmployed, totalUnemployed) {
        if (!this.workData) return;

        this.workData.sectors = sectors;
        this.workData.totalEmployed = totalEmployed;
        this.workData.totalUnemployed = totalUnemployed;
        this.workData.unemploymentPercentage = totalEmployed > 0 
            ? Math.round((totalUnemployed / (totalEmployed + totalUnemployed)) * 100)
            : 0;

        this.render();
    }
}

function initWorkSection() {
    const workSection = document.getElementById('admin-section-work');
    if (!workSection) return;

    const manager = new WorkSectionManager();
    window.workSectionManager = manager;
    
    // Update data every time the section becomes active (like info panel)
    const observer = new MutationObserver(() => {
        if (workSection.classList.contains('active')) {
            // Reload data from IndexedDB when section opens (current state)
            manager.loadWorkData();
        }
    });

    observer.observe(workSection, { attributes: true, attributeFilter: ['class'] });

    // Initialize if already active
    if (workSection.classList.contains('active')) {
        manager.init();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkSection);
} else {
    initWorkSection();
}

