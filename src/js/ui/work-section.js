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

    init() {
        this.setupEventListeners();
        this.loadWorkData();
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
        this.render();
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
                need: 0,
                have: 0
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
            
            // Update priority in the service (which handles swapping)
            if (this.employmentPriorityService) {
                this.employmentPriorityService.updateSectorPriority(
                    sectorData.sectorNumber, 
                    clampedPriority
                );
                
                // Reload priorities to reflect swaps
                const allPriorities = this.employmentPriorityService.getAllPriorities();
                this.workData.sectors.forEach(sec => {
                    if (sec.sectorNumber !== undefined) {
                        sec.priority = allPriorities[sec.sectorNumber] || sec.priority;
                    }
                });
                
                // Re-render to show updated priorities
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
            priorityInput.value = sector.priority;
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
                
                // Update priority with clamped value
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
                    
                    // Update if value changed
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
                
                this.updatePriority(sector.id, value);
            });
            
            priorityCell.appendChild(priorityInput);
            
            // Sector name column
            const sectorCell = document.createElement('td');
            sectorCell.className = 'sector-col';
            sectorCell.textContent = sector.name;
            
            // Need column
            const needCell = document.createElement('td');
            needCell.className = 'need-col';
            const needSpan = document.createElement('span');
            needSpan.className = sector.need > sector.have ? 'work-need-lack' : 'work-need-ok';
            needSpan.setAttribute('data-field', `need-${sector.id}`);
            const lack = sector.need - sector.have;
            if (lack > 0) {
                needSpan.textContent = `${sector.need} (-${lack})`;
            } else {
                needSpan.textContent = sector.need;
            }
            needCell.appendChild(needSpan);
            
            // Have column
            const haveCell = document.createElement('td');
            haveCell.className = 'have-col';
            haveCell.setAttribute('data-field', `have-${sector.id}`);
            haveCell.textContent = sector.have;
            
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
            unemployedElement.textContent = `${this.workData.totalUnemployed} (${percentage}%)`;
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
    
    const observer = new MutationObserver(() => {
        if (workSection.classList.contains('active')) {
            manager.init();
            observer.disconnect();
        }
    });

    observer.observe(workSection, { attributes: true, attributeFilter: ['class'] });

    if (workSection.classList.contains('active')) {
        manager.init();
        observer.disconnect();
    }

    window.workSectionManager = manager;
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWorkSection);
} else {
    initWorkSection();
}

