import { unresolvedTerm } from '../../shell/CatalogVocabulary.js';
import { getSkillDisplay } from '../../../../shared/population/skillCatalog.js';
import { GROUP_CITIZEN_PRESENTATION } from '../../info/population/CitizenStatusPresentation.js';

/**
 * Tab-chrome labels — reuses the exact same French group labels the
 * population panel already shows (CitizenStatusPresentation.js), so this
 * isn't a second, independently-maintained copy of "what an artisan is
 * called". 'Commun' has no equivalent there since it isn't a real social
 * category (see createEmploymentContext.js's `kind: 'shared'`), so it's the
 * one label owned here.
 */
const SHARED_TAB_LABEL = 'Commun';

/**
 * @param {string} groupId
 * @returns {string}
 */
function groupTabLabel(groupId) {
    return GROUP_CITIZEN_PRESENTATION[groupId]?.label ?? unresolvedTerm('citizen group name', groupId);
}

export class WorkSectionPresenter {
    /**
     * @param {{ accounting: object, employment: object, housing: object }} deps
     */
    constructor(deps) {
        this.accounting = deps.accounting;
        this.employment = deps.employment;
        this.housing = deps.housing;
        const settings = this.accounting?.getSalarySettings?.() ?? {
          salaryPerMonth: 0,
          salaryTaxRate: 0,
          unemploymentBenefitRate: 0.7,
        };
        this.salary = settings.salaryPerMonth;
        this.salaryTaxRate = settings.salaryTaxRate;
        this.unemploymentBenefitRate = settings.unemploymentBenefitRate ?? 0.7;
        this.lastKnownPopulation = 0;
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

        // Priority inputs are handled in renderWorkTable(), tab clicks in
        // renderGroupTabs() — both attach listeners during element creation
        // (rows/tabs are rebuilt from scratch on every render).
    }

    async loadWorkData() {
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
            const summary = await this.employment.getCityEmploymentSummary();

            if (this.workData?.tabs) {
                for (const tab of this.workData.tabs) {
                    for (const skill of tab.skills) {
                        const stats = summary.bySkill[skill.skillId] || {
                            workerNeed: 0,
                            workers: 0,
                            need: 0,
                        };
                        skill.workerNeed = stats.workerNeed || 0;
                        skill.workers = stats.workers || 0;
                        skill.availableWorkers = summary.workerPool;
                        skill.initialNeed = skill.workerNeed;
                        skill.have = skill.workers;
                        skill.need = stats.need || 0;
                    }
                }
            }

            this.workData.totalEmployed = summary.totalAssigned;
            this.workData.totalUnemployed = summary.unemployed;
            this.workData.unemploymentPercentage = summary.unemploymentPercentage;
            this.workData.totalLack = summary.lack;
            this.workData.totalAvailable = summary.workerPool;
            this.workData.totalNeed = summary.totalNeed;
            this.workData.totalAvailableWorkers = summary.workerPool;
            this.workData.payrollEligiblePopulation = summary.totalPopulation;

        } catch (error) {
            console.error('[WorkSection] Error updating employee statistics:', error);
        }
    }

    /**
     * Builds one tab per social group + the shared-skill tab (see
     * createEmploymentContext.getPriorityTabs — catalog-driven, so a future
     * 4th social category shows up here with zero code change), one row per
     * skill that tab actually covers (see SkillPriorityPolicy.js).
     */
    generatePlaceholderWorkData() {
        const previousActiveTabId = this.workData?.activeTabId ?? null;

        const tabs = this.employment.getPriorityTabs().map(({ id, kind, skillIds }) => ({
            id,
            label: kind === 'shared' ? SHARED_TAB_LABEL : groupTabLabel(id),
            skills: skillIds.map((skillId) => ({
                skillId,
                label: getSkillDisplay(skillId).label,
                priority: this.employment.getSkillPriority(skillId),
                need: 0,
                initialNeed: 0,
                have: 0,
                workerNeed: 0,
                workers: 0,
                availableWorkers: 0,
            })),
        }));

        const activeTabId = tabs.some((tab) => tab.id === previousActiveTabId)
            ? previousActiveTabId
            : (tabs[0]?.id ?? null);

        return {
            tabs,
            activeTabId,
            totalEmployed: 0,
            totalUnemployed: 0,
            unemploymentPercentage: 0
        };
    }

    #activeTab() {
        return this.workData?.tabs?.find((tab) => tab.id === this.workData.activeTabId) ?? null;
    }

    adjustSalary(delta) {
        const newSalary = Math.max(10, Math.min(500, this.salary + delta));

        if (newSalary !== this.salary) {
            const settings = this.accounting.setSalarySettings({ salaryPerMonth: newSalary });
            this.salary = settings.salaryPerMonth;
            this.updateSalaryDisplay();
        }
    }

    adjustSalaryTaxRate(delta) {
        const newRate = Math.max(0, Math.min(1, this.salaryTaxRate + delta));

        if (newRate !== this.salaryTaxRate) {
            const settings = this.accounting.setSalarySettings({ salaryTaxRate: newRate });
            this.salaryTaxRate = settings.salaryTaxRate;
            this.updateSalaryTaxDisplay();
        }
    }

    adjustUnemploymentRate(delta) {
        const currentPercent = Math.round(this.unemploymentBenefitRate * 100);
        const newPercent = Math.max(0, Math.min(100, currentPercent + delta));
        const newRate = newPercent / 100;

        if (newRate !== this.unemploymentBenefitRate) {
            const settings = this.accounting.setSalarySettings({
              unemploymentBenefitRate: newRate,
            });
            this.unemploymentBenefitRate = settings.unemploymentBenefitRate;
            this.updateUnemploymentDisplay();
        }
    }

    /**
     * @param {string} skillId
     * @param {number} priority
     */
    updatePriority(skillId, priority) {
        if (!this.workData) return;

        const activeTab = this.#activeTab();
        const skillData = activeTab?.skills.find((s) => s.skillId === skillId);
        if (skillData) {
            const maxPriority = Math.max(1, activeTab.skills.length);
            const clampedPriority = Math.max(1, Math.min(maxPriority, priority));

            this.employment.updateSkillPrioritySync(skillId, clampedPriority);

            const tabPriorities = this.employment.getMergedTabPriorities(activeTab.id);

            activeTab.skills.forEach((skill) => {
                const newPriority = tabPriorities[skill.skillId];
                if (newPriority !== undefined) {
                    skill.priority = newPriority;
                }
            });

            this.renderWorkTable();
        }
    }

    #payrollEligiblePopulation() {
        return this.workData?.payrollEligiblePopulation ?? 0;
    }

    #buildPayrollPreview(unemployed) {
        return this.accounting.computeReferenceSalaryPayrollBreakdown({
            population: this.#payrollEligiblePopulation(),
            unemployed,
            referenceSalaryPerMonth: this.salary,
            unemploymentBenefitRate: this.unemploymentBenefitRate,
            salaryTaxRate: this.salaryTaxRate,
        });
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
            totalPopulation = await this.housing.getCityTotalPopulation();
        } catch (error) {
            console.warn('[WorkSection] Error getting population for salary display:', error);
        }

        if (populationDisplay) {
            populationDisplay.textContent = totalPopulation;
        }

        this.lastKnownPopulation = totalPopulation;

        if (annualBillDisplay) {
            const payroll = this.#buildPayrollPreview(this.workData?.totalUnemployed ?? 0);
            annualBillDisplay.textContent = Math.round(payroll.cityExpenseTotal * 12);
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

        const payroll = this.#buildPayrollPreview(this.workData?.totalUnemployed ?? 0);

        if (salaryTaxAmountDisplay) {
            salaryTaxAmountDisplay.textContent = payroll.payrollTax;
        }

        if (salaryTaxAnnualDisplay) {
            salaryTaxAnnualDisplay.textContent = Math.round(payroll.payrollTax * 12);
        }
    }

    updateUnemploymentDisplay() {
        const unemploymentDisplay = document.getElementById('unemployment-rate-display');
        const unemploymentCountDisplay = document.getElementById('unemployment-count-display');
        const unemploymentBenefitDisplay = document.getElementById('unemployment-benefit-display');

        if (unemploymentDisplay) {
            unemploymentDisplay.textContent = `${Math.round(this.unemploymentBenefitRate * 100)}%`;
        }

        const unemployed = this.workData?.totalUnemployed ?? 0;
        const payroll = this.#buildPayrollPreview(unemployed);

        if (unemploymentCountDisplay) {
            unemploymentCountDisplay.textContent = unemployed;
        }

        if (unemploymentBenefitDisplay) {
            unemploymentBenefitDisplay.textContent = payroll.unemploymentBenefitExpense;
        }

        const citizenPayrollDisplay = document.getElementById('citizen-payroll-display');
        if (citizenPayrollDisplay) {
            citizenPayrollDisplay.textContent = payroll.citizenPayrollMass;
        }

        const civilServantCountDisplay = document.getElementById('civil-servant-count-display');
        if (civilServantCountDisplay) {
            civilServantCountDisplay.textContent = payroll.civilServantCount;
        }

        const payrollTaxBaseDisplay = document.getElementById('payroll-tax-base-display');
        if (payrollTaxBaseDisplay) {
            payrollTaxBaseDisplay.textContent = payroll.payrollTaxBase;
        }
    }

    render() {
        if (!this.workData) return;

        this.renderGroupTabs();
        this.renderWorkTable();
        this.renderSummary();
        this.updateSalaryDisplay();
        this.updateSalaryTaxDisplay();
        this.updateUnemploymentDisplay();
    }

    /**
     * Tab strip — one button per social group + "Commun", switching
     * `activeTabId` and re-rendering the table on click. Rebuilt from
     * scratch every render, same pattern as renderWorkTable() below.
     */
    renderGroupTabs() {
        const tabsContainer = document.getElementById('work-group-tabs');
        if (!tabsContainer || !this.workData) return;

        tabsContainer.innerHTML = '';

        this.workData.tabs.forEach((tab) => {
            const isActive = tab.id === this.workData.activeTabId;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'work-tab-btn' + (isActive ? ' active' : '');
            btn.id = `work-tab-${tab.id}`;
            btn.textContent = tab.label;
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            btn.addEventListener('click', () => {
                if (this.workData.activeTabId === tab.id) return;
                this.workData.activeTabId = tab.id;
                this.render();
            });

            tabsContainer.appendChild(btn);
        });
    }

    renderWorkTable() {
        if (!this.workData) return;

        const tableBody = document.getElementById('work-table-body');
        if (!tableBody) return;

        // Clear existing rows (except header)
        tableBody.innerHTML = '';

        const activeTab = this.#activeTab();
        const maxPriority = Math.max(1, activeTab?.skills.length ?? 1);

        // Generate rows dynamically from the active tab's skills
        (activeTab?.skills ?? []).forEach(skill => {
            const row = document.createElement('tr');
            row.setAttribute('data-skill', skill.skillId);

            // Priority column
            const priorityCell = document.createElement('td');
            priorityCell.className = 'priority-col';
            const priorityInput = document.createElement('input');
            priorityInput.type = 'number';
            priorityInput.className = 'work-priority-input';
            priorityInput.id = `priority-${skill.skillId}`;
            priorityInput.min = '1';
            priorityInput.max = maxPriority.toString();
            priorityInput.step = '1'; // Only allow integers
            const priorityValue = skill.priority || 1;
            priorityInput.value = priorityValue;
            skill.priority = priorityValue;
            priorityInput.setAttribute('aria-label', `Priorité ${skill.label}`);
            priorityInput.setAttribute('title', `Priorité entre 1 et ${maxPriority}`);

            // Store max value for validation
            priorityInput.dataset.maxPriority = maxPriority.toString();

            // Prevent typing invalid values
            priorityInput.addEventListener('keydown', (e) => {
                const max = parseInt(priorityInput.dataset.maxPriority);
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
                const max = parseInt(e.target.dataset.maxPriority);

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
                const max = parseInt(e.target.dataset.maxPriority);

                // If empty or invalid, set to minimum
                if (isNaN(value) || value === '' || value < 1) {
                    e.target.value = '1';
                    value = 1;
                } else if (value > max) {
                    e.target.value = max.toString();
                    value = max;
                }

                // Update priority with clamped value (synchronous)
                this.updatePriority(skill.skillId, value);
            });

            // Handle paste events to clamp pasted values
            priorityInput.addEventListener('paste', (e) => {
                // Allow paste, then validate in next tick
                setTimeout(() => {
                    let value = parseInt(e.target.value);
                    const max = parseInt(e.target.dataset.maxPriority);

                    if (isNaN(value) || value < 1) {
                        e.target.value = '1';
                        value = 1;
                    } else if (value > max) {
                        e.target.value = max.toString();
                        value = max;
                    }

                    // Update if value changed (synchronous)
                    if (value !== skill.priority) {
                        this.updatePriority(skill.skillId, value);
                    }
                }, 0);
            });

            // Also handle change event
            priorityInput.addEventListener('change', (e) => {
                let value = parseInt(e.target.value);
                const max = parseInt(e.target.dataset.maxPriority);

                // Clamp value
                if (isNaN(value) || value < 1) {
                    value = 1;
                    e.target.value = '1';
                } else if (value > max) {
                    value = max;
                    e.target.value = max.toString();
                }

                // Update priority (synchronous)
                this.updatePriority(skill.skillId, value);
            });

            priorityCell.appendChild(priorityInput);

            // Skill (activity) name column
            const skillCell = document.createElement('td');
            skillCell.className = 'sector-col';
            skillCell.textContent = skill.label;

            // Need column - remaining workers needed (Caesar 3 style)
            // Shows: remaining need (initial need in gray if different)
            const needCell = document.createElement('td');
            needCell.className = 'need-col';
            const needContainer = document.createElement('div');
            needContainer.className = 'work-need-container';

            const remainingNeed = skill.need || 0;
            const initialNeed = skill.initialNeed || 0;

            const needSpan = document.createElement('span');
            needSpan.className = remainingNeed > 0 ? 'work-need-lack' : 'work-need-ok';
            needSpan.setAttribute('data-field', `need-${skill.skillId}`);
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
            haveSpan.setAttribute('data-field', `have-${skill.skillId}`);
            haveSpan.textContent = skill.have || 0;
            haveContainer.appendChild(haveSpan);

            // Add detail tooltip showing assigned workers and city-wide available
            const haveDetail = document.createElement('div');
            haveDetail.className = 'work-detail-tooltip';
            haveDetail.innerHTML = `
                <div class="work-detail-item">
                    <span class="work-detail-label">Ouvriers assignés:</span>
                    <span class="work-detail-value">${skill.workers || 0}</span>
                </div>
                <div class="work-detail-item" style="border-top: 1px solid rgba(255, 255, 255, 0.3); margin-top: 6px; padding-top: 6px;">
                    <span class="work-detail-label">Ouvriers disponibles (ville):</span>
                    <span class="work-detail-value">${skill.availableWorkers || 0}</span>
                </div>
            `;
            haveContainer.appendChild(haveDetail);
            haveCell.appendChild(haveContainer);

            row.appendChild(priorityCell);
            row.appendChild(skillCell);
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
                <span class="work-legend-desc">Ouvriers encore nécessaires pour cette activité</span>
            </div>
            <div class="work-legend-item">
                <span class="work-legend-label">(n) :</span>
                <span class="work-legend-desc">Besoin initial si aucun ouvrier n'était assigné</span>
            </div>
            <div class="work-legend-item">
                <span class="work-legend-label">Embauchés :</span>
                <span class="work-legend-desc">Ouvriers actuellement embauchés dans cette activité</span>
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
}
