class WorkSectionManager {
    constructor() {
        this.salary = 30;
        this.unemploymentRate = 50;
        this.workData = null;
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
        const priorityInputs = document.querySelectorAll('.work-priority-input');

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

        priorityInputs.forEach(input => {
            input.addEventListener('change', (e) => {
                const sector = e.target.closest('tr').dataset.sector;
                const priority = parseInt(e.target.value) || 0;
                this.updatePriority(sector, priority);
            });
        });
    }

    async loadWorkData() {
        this.workData = this.generatePlaceholderWorkData();
        this.render();
    }

    generatePlaceholderWorkData() {
        return {
            sectors: [
                { id: 'industry-commerce', name: 'Industrie et Commerce', priority: 0, need: 0, have: 0 },
                { id: 'food-production', name: 'Production Alimentaire', priority: 0, need: 0, have: 0 },
                { id: 'engineering', name: 'Ingénierie', priority: 0, need: 0, have: 0 },
                { id: 'water-services', name: 'Services d\'Eau', priority: 0, need: 0, have: 0 },
                { id: 'prefectures', name: 'Préfectures', priority: 0, need: 0, have: 0 },
                { id: 'military', name: 'Militaire', priority: 0, need: 0, have: 0 },
                { id: 'entertainment', name: 'Divertissement', priority: 0, need: 0, have: 0 },
                { id: 'health-education', name: 'Santé et Éducation', priority: 0, need: 0, have: 0 },
                { id: 'governance-religion', name: 'Gouvernance et Religion', priority: 0, need: 0, have: 0 }
            ],
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
        if (sectorData) {
            sectorData.priority = Math.max(0, Math.min(10, priority));
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

        this.workData.sectors.forEach(sector => {
            const priorityInput = document.getElementById(`priority-${sector.id}`);
            const needElement = document.querySelector(`[data-field="need-${sector.id}"]`);
            const haveElement = document.querySelector(`[data-field="have-${sector.id}"]`);
            const row = document.querySelector(`[data-sector="${sector.id}"]`);

            if (priorityInput) {
                priorityInput.value = sector.priority;
            }

            if (needElement) {
                needElement.textContent = sector.need;
                const lack = sector.need - sector.have;
                if (lack > 0) {
                    needElement.className = 'work-need-lack';
                    needElement.textContent = `${sector.need} (-${lack})`;
                } else {
                    needElement.className = 'work-need-ok';
                    needElement.textContent = sector.need;
                }
            }

            if (haveElement) {
                haveElement.textContent = sector.have;
            }
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

