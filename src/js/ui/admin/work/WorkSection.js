import {
  getCityEmploymentSummary,
  getSectorPriority,
  getMergedSectorPriorities,
  updateSectorPrioritySync,
  EMPLOYMENT_SECTOR_NAMES,
  DEFAULT_SECTOR_PRIORITIES,
  EMPLOYMENT_MAX_SECTORS,
} from '../../../acl/employment.js';
import { getCityTotalPopulation } from '../../../acl/housing.js';
import { registerAppService } from '../../../acl/appRuntime.js';

class WorkSectionPresenter {
    constructor() {
        this.salary = 100; // Valeur par défaut : 100€/mois
        this.salaryTaxRate = 0.2; // Valeur par défaut : 20% (0.2)
        this.unemploymentRate = 50;
        this.workData = null;
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
        const salaryTaxDecreaseBtn = document.getElementById('salary-tax-decrease-btn');
        const salaryTaxIncreaseBtn = document.getElementById('salary-tax-increase-btn');
        const unemploymentDecreaseBtn = document.getElementById('unemployment-decrease-btn');
        const unemploymentIncreaseBtn = document.getElementById('unemployment-increase-btn');

        // Utiliser des fonctions nommées pour pouvoir les retirer si nécessaire
        const handleSalaryDecrease = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustSalary(-1);
        };

        const handleSalaryIncrease = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustSalary(1);
        };

        if (salaryDecreaseBtn) {
            // Retirer l'ancien listener s'il existe
            salaryDecreaseBtn.removeEventListener('click', this._handleSalaryDecrease);
            this._handleSalaryDecrease = handleSalaryDecrease;
            salaryDecreaseBtn.addEventListener('click', this._handleSalaryDecrease);
        }

        if (salaryIncreaseBtn) {
            salaryIncreaseBtn.removeEventListener('click', this._handleSalaryIncrease);
            this._handleSalaryIncrease = handleSalaryIncrease;
            salaryIncreaseBtn.addEventListener('click', this._handleSalaryIncrease);
        }

        const handleSalaryTaxDecrease = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustSalaryTaxRate(-0.01);
        };

        const handleSalaryTaxIncrease = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.adjustSalaryTaxRate(0.01);
        };

        if (salaryTaxDecreaseBtn) {
            salaryTaxDecreaseBtn.removeEventListener('click', this._handleSalaryTaxDecrease);
            this._handleSalaryTaxDecrease = handleSalaryTaxDecrease;
            salaryTaxDecreaseBtn.addEventListener('click', this._handleSalaryTaxDecrease);
        }

        if (salaryTaxIncreaseBtn) {
            salaryTaxIncreaseBtn.removeEventListener('click', this._handleSalaryTaxIncrease);
            this._handleSalaryTaxIncrease = handleSalaryTaxIncrease;
            salaryTaxIncreaseBtn.addEventListener('click', this._handleSalaryTaxIncrease);
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
        const allPriorities = getMergedSectorPriorities();
        if (this.workData) {
            this.workData.sectors.forEach(sector => {
                if (sector.sectorNumber !== undefined) {
                    sector.priority = allPriorities[sector.sectorNumber] || sector.priority;
                }
            });
        }
        
        // Generate or regenerate work data
        this.workData = this.generatePlaceholderWorkData();
        
        // Load employee statistics from IndexedDB (independent of service)
        await this.updateEmployeeStatistics();
        
        // Réattacher les event listeners au cas où le panneau vient d'être rendu
        this.setupEventListeners();
        
        this.render();
    }
    
    /**
     * Update employee statistics from Employment BC read model.
     */
    async updateEmployeeStatistics() {
        try {
            const summary = await getCityEmploymentSummary();

            if (this.workData && this.workData.sectors) {
                this.workData.sectors.forEach(sector => {
                    if (sector.sectorNumber === undefined) return;

                    const sectorStats = summary.bySector[sector.sectorNumber] || {
                        workerNeed: 0,
                        workers: 0,
                        need: 0,
                    };

                    sector.workerNeed = sectorStats.workerNeed || 0;
                    sector.eliteNeed = 0;
                    sector.workers = sectorStats.workers || 0;
                    sector.elites = 0;
                    sector.availableWorkers = summary.workerPool;
                    sector.availableElites = summary.elitePool;
                    sector.initialNeed = sector.workerNeed;
                    sector.have = sector.workers;
                    sector.need = sectorStats.need || 0;
                });
            }

            this.workData.totalEmployed = summary.totalAssigned;
            this.workData.totalUnemployed = summary.unemployed;
            this.workData.unemploymentPercentage = summary.unemploymentPercentage;
            this.workData.totalLack = summary.lack;
            this.workData.totalAvailable = summary.workerPool;
            this.workData.totalNeed = summary.totalNeed;
            this.workData.totalAvailableWorkers = summary.workerPool;
            this.workData.totalAvailableElites = summary.elitePool;

        } catch (error) {
            console.error('[WorkSection] Error updating employee statistics:', error);
        }
    }

    generatePlaceholderWorkData() {
        // Get sectors from config
        const sectors = EMPLOYMENT_SECTOR_NAMES;
        const defaultPriorities = DEFAULT_SECTOR_PRIORITIES;
        
        // Generate sectors from config
        const sectorList = Object.entries(sectors).map(([sectorNum, sectorName]) => {
            const secNum = parseInt(sectorNum, 10);
            // Get priority from service if available, otherwise use default
            let priority = defaultPriorities[secNum] || 1;
            priority = getSectorPriority(secNum);
            
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
        const newSalary = Math.max(10, Math.min(500, this.salary + delta));
        
        if (newSalary !== this.salary) {
            this.salary = newSalary;
            this.updateSalaryDisplay();
        }
    }

    adjustSalaryTaxRate(delta) {
        const newRate = Math.max(0, Math.min(1, this.salaryTaxRate + delta));
        
        if (newRate !== this.salaryTaxRate) {
            this.salaryTaxRate = newRate;
            this.updateSalaryTaxDisplay();
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
            const maxSectors = EMPLOYMENT_MAX_SECTORS;
            
            // Clamp priority to valid range (1 to max sectors)
            const clampedPriority = Math.max(1, Math.min(maxSectors, priority));
            
            updateSectorPrioritySync(
                sectorData.sectorNumber,
                clampedPriority
            );

            const allPriorities = getMergedSectorPriorities();

            this.workData.sectors.forEach(sec => {
                if (sec.sectorNumber !== undefined) {
                    const newPriority = allPriorities[sec.sectorNumber];
                    if (newPriority !== undefined) {
                        sec.priority = newPriority;
                    }
                }
            });

            this.renderWorkTable();
        }
    }

    async updateSalaryDisplay() {
        const salaryDisplay = document.getElementById('salary-display');
        const salaryMonthDisplay = document.getElementById('salary-month-display');
        const salaryYearDisplay = document.getElementById('salary-year-display');
        const annualBillDisplay = document.getElementById('salary-annual-bill');
        const populationDisplay = document.getElementById('salary-population-display');

        if (salaryDisplay) {
            salaryDisplay.textContent = this.salary;
        }

        if (salaryMonthDisplay) {
            salaryMonthDisplay.textContent = this.salary;
        }

        if (salaryYearDisplay) {
            const yearlyAmount = this.salary * 12;
            salaryYearDisplay.textContent = yearlyAmount;
        }

        let totalPopulation = 0;
        try {
            totalPopulation = await getCityTotalPopulation();
        } catch (error) {
            console.warn('[WorkSection] Error getting population for salary display:', error);
        }

        if (populationDisplay) {
            populationDisplay.textContent = totalPopulation;
        }

        if (annualBillDisplay) {
            const annualBill = totalPopulation * this.salary * 12;
            annualBillDisplay.textContent = Math.round(annualBill);
        }
        
        this.updateSalaryTaxDisplay();
    }

    async updateSalaryTaxDisplay() {
        const salaryTaxRateDisplay = document.getElementById('salary-tax-rate-display');
        const salaryTaxAmountDisplay = document.getElementById('salary-tax-amount-display');
        const salaryTaxAnnualDisplay = document.getElementById('salary-tax-annual-display');

        if (salaryTaxRateDisplay) {
            salaryTaxRateDisplay.textContent = Math.round(this.salaryTaxRate * 100);
        }

        let totalPopulation = 0;
        try {
            totalPopulation = await getCityTotalPopulation();
        } catch (error) {
            console.warn('[WorkSection] Error getting population for salary tax display:', error);
        }

        if (salaryTaxAmountDisplay) {
            const monthlyTaxAmount = Math.round(totalPopulation * this.salary * this.salaryTaxRate);
            salaryTaxAmountDisplay.textContent = monthlyTaxAmount;
        }

        if (salaryTaxAnnualDisplay) {
            const annualTaxAmount = Math.round(totalPopulation * this.salary * 12 * this.salaryTaxRate);
            salaryTaxAnnualDisplay.textContent = annualTaxAmount;
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
        this.updateSalaryTaxDisplay();
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
            const maxSectors = EMPLOYMENT_MAX_SECTORS;
            priorityInput.min = '1';
            priorityInput.max = maxSectors.toString();
            priorityInput.step = '1'; // Only allow integers
            // Ensure priority value is set (use sector.priority or get from service)
            let priorityValue = sector.priority;
            if (!priorityValue && sector.sectorNumber !== undefined) {
                priorityValue = getSectorPriority(sector.sectorNumber);
            }
            if (!priorityValue) {
                priorityValue = DEFAULT_SECTOR_PRIORITIES[sector.sectorNumber] || 1;
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
            
            // Need column - remaining workers needed (Caesar 3 style)
            // Shows: remaining need (initial need in gray if different)
            const needCell = document.createElement('td');
            needCell.className = 'need-col';
            const needContainer = document.createElement('div');
            needContainer.className = 'work-need-container';
            
            const remainingNeed = sector.need || 0;
            const initialNeed = sector.initialNeed || 0;
            
            const needSpan = document.createElement('span');
            needSpan.className = remainingNeed > 0 ? 'work-need-lack' : 'work-need-ok';
            needSpan.setAttribute('data-field', `need-${sector.id}`);
            needSpan.textContent = remainingNeed;
            needContainer.appendChild(needSpan);
            
            // Show initial need in gray parentheses if there are workers assigned
            if (initialNeed > 0 && remainingNeed !== initialNeed) {
                const initialSpan = document.createElement('span');
                initialSpan.className = 'work-need-initial';
                initialSpan.textContent = `(${initialNeed})`;
                initialSpan.title = 'Besoin initial si aucun ouvrier assigné';
                needContainer.appendChild(initialSpan);
            }
            
            // Add detail tooltip
            const needDetail = document.createElement('div');
            needDetail.className = 'work-detail-tooltip';
            needDetail.innerHTML = `
                <div class="work-detail-item">
                    <span class="work-detail-label">Besoin restant:</span>
                    <span class="work-detail-value">${remainingNeed}</span>
                </div>
                <div class="work-detail-item">
                    <span class="work-detail-label">Besoin initial:</span>
                    <span class="work-detail-value">${initialNeed}</span>
                </div>
            `;
            needContainer.appendChild(needDetail);
            needCell.appendChild(needContainer);
            
            // Have column - workers currently assigned
            const haveCell = document.createElement('td');
            haveCell.className = 'have-col';
            const haveContainer = document.createElement('div');
            haveContainer.className = 'work-have-container';
            
            const haveSpan = document.createElement('span');
            haveSpan.setAttribute('data-field', `have-${sector.id}`);
            haveSpan.textContent = sector.have || 0;
            haveContainer.appendChild(haveSpan);
            
            // Add detail tooltip showing assigned workers and city-wide available
            const haveDetail = document.createElement('div');
            haveDetail.className = 'work-detail-tooltip';
            haveDetail.innerHTML = `
                <div class="work-detail-item">
                    <span class="work-detail-label">Ouvriers assignés:</span>
                    <span class="work-detail-value">${sector.workers || 0}</span>
                </div>
                <div class="work-detail-item" style="border-top: 1px solid rgba(255, 255, 255, 0.3); margin-top: 6px; padding-top: 6px;">
                    <span class="work-detail-label">Ouvriers disponibles (ville):</span>
                    <span class="work-detail-value">${sector.availableWorkers || 0}</span>
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
        
        // Add legend after the table (if not already present)
        this.renderLegend();
    }
    
    /**
     * Renders the legend under the work table
     */
    renderLegend() {
        const tableBody = document.getElementById('work-table-body');
        if (!tableBody) return;
        
        const table = tableBody.closest('table');
        if (!table) return;
        
        // Check if legend already exists
        let legend = table.nextElementSibling;
        if (legend && legend.classList.contains('work-legend')) {
            // Legend already exists, no need to recreate
            return;
        }
        
        // Create legend
        legend = document.createElement('div');
        legend.className = 'work-legend';
        legend.innerHTML = `
            <div class="work-legend-item">
                <span class="work-legend-label">Besoin :</span>
                <span class="work-legend-desc">Ouvriers encore nécessaires pour ce secteur</span>
            </div>
            <div class="work-legend-item">
                <span class="work-legend-label">(n) :</span>
                <span class="work-legend-desc">Besoin initial si aucun ouvrier n'était assigné</span>
            </div>
            <div class="work-legend-item">
                <span class="work-legend-label">Embauchés :</span>
                <span class="work-legend-desc">Ouvriers actuellement embauchés dans ce secteur</span>
            </div>
        `;
        
        // Insert legend after table
        table.parentNode.insertBefore(legend, table.nextSibling);
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

    const presenter = new WorkSectionPresenter();
    registerAppService('workSectionPresenter', presenter);
    
    // Update data every time the section becomes active (like info panel)
    const observer = new MutationObserver(() => {
        if (workSection.classList.contains('active')) {
            // Reload data from IndexedDB when section opens (current state)
            presenter.loadWorkData();
        }
    });

    observer.observe(workSection, { attributes: true, attributeFilter: ['class'] });

    // Initialize if already active
    if (workSection.classList.contains('active')) {
        presenter.init();
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkSection);
} else {
    initWorkSection();
}

