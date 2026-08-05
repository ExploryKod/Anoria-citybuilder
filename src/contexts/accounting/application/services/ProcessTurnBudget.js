import { buildTurnBudgetMaintenanceSnapshot } from '../../domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import {
  computeReferenceSalaryPayrollBreakdown,
  formatCivilServantSalaryJournalDescription,
  formatPayrollTaxJournalDescription,
  formatUnemploymentBenefitJournalDescription,
} from '../../domain/policies/ReferenceSalaryPayrollPolicy.js';

/**
 * Per-turn budget orchestration (taxes, salaries, maintenance, enrichments).
 */
export class ProcessTurnBudget {
  /**
   * @param {object} deps
   * @param {(time: number) => Promise<object>} deps.collectCitizenTaxes
   * @param {Function} deps.recordSalaries
   * @param {Function} deps.recordPayrollTax
   * @param {Function} deps.recordUnemploymentBenefits
   * @param {Function} deps.recordBuildingMaintenance
   * @param {(time: number) => object} deps.getTimeInfo
   * @param {() => Promise<number>} deps.getCityTotalPopulation
   * @param {() => Promise<{ unemployed: number }>} deps.getCityEmploymentSummary
   * @param {() => { salaryPerMonth: number, salaryTaxRate: number, unemploymentBenefitRate: number }} deps.getSalarySettings
   * @param {() => Promise<object>} deps.clearPopulationWithoutRoadAccess
   * @param {() => Promise<void>|void} [deps.processLoanPayments]
   * @param {() => Promise<object>} deps.recalculateLoanTotals
   * @param {Function} deps.saveBudgetTurnEnrichment
   * @param {() => Promise<object>} deps.cleanupOldBudgetTurnSnapshotsByAge
   * @param {(maxAge?: number) => Promise<unknown>} deps.cleanupOldJournalEntries
   * @param {() => Promise<unknown>} deps.flushJournalSessionToDexie
   * @param {() => string[]} [deps.listBuildingTypesForMaintenance]
   */
  constructor(deps) {
    this.deps = deps;
    this.lastMaintenanceCivilKey = null;
    this.lastSalaryCivilKey = null;
  }

  #processBudgetInFlight = false;

  reset() {
    this.lastMaintenanceCivilKey = null;
    this.lastSalaryCivilKey = null;
    this.#processBudgetInFlight = false;
  }

  /** @param {{ year: number, monthIndex: number }} timeInfo */
  #civilMonthKey(timeInfo) {
    return `${timeInfo.year}:${timeInfo.monthIndex}`;
  }

  /**
   * @param {object | undefined} buildingCounts
   * @param {object | undefined} maintenanceBreakdown
   */
  #resolveMaintenanceInput(buildingCounts, maintenanceBreakdown) {
    if (buildingCounts != null && maintenanceBreakdown != null) {
      return { buildingCounts, maintenanceBreakdown };
    }

    if (typeof this.deps.listBuildingTypesForMaintenance === 'function') {
      return buildTurnBudgetMaintenanceSnapshot(this.deps.listBuildingTypesForMaintenance());
    }

    return {
      buildingCounts: buildingCounts ?? {
        houses: 0,
        farms: 0,
        markets: 0,
        roads: 0,
        total: 0,
      },
      maintenanceBreakdown: maintenanceBreakdown ?? {
        roads: { count: 0, cost: 0 },
        houses: { count: 0, cost: 0 },
        farms: { count: 0, cost: 0 },
        markets: { count: 0, cost: 0 },
      },
    };
  }

  /**
   * @param {object} params
   * @param {number} params.time
   * @param {number} params.totalPop
   * @param {object} [params.buildingCounts]
   * @param {object} [params.maintenanceBreakdown]
   * @returns {Promise<{ cleanupResult?: object }>}
   */
  async execute({ time, totalPop, buildingCounts, maintenanceBreakdown }) {
    if (this.#processBudgetInFlight) {
      return {};
    }

    ({ buildingCounts, maintenanceBreakdown } = this.#resolveMaintenanceInput(
      buildingCounts,
      maintenanceBreakdown
    ));

    this.#processBudgetInFlight = true;
    /** @type {{ cleanupResult?: object }} */
    const result = {};

    try {
      await this.deps.collectCitizenTaxes(time);

      const timeInfo = this.deps.getTimeInfo(time);
      const civilMonthKey = this.#civilMonthKey(timeInfo);
      const isFirstTurnOfMonth = timeInfo.dayInMonth === 1;

      if (isFirstTurnOfMonth && civilMonthKey !== this.lastSalaryCivilKey) {
        this.lastSalaryCivilKey = civilMonthKey;

        const { salaryPerMonth, salaryTaxRate, unemploymentBenefitRate } =
          this.deps.getSalarySettings();
        const employmentSummary = await this.deps.getCityEmploymentSummary();
        const payrollPopulation = employmentSummary?.totalPopulation ?? 0;
        const unemployed = employmentSummary?.unemployed ?? 0;
        const eliteCount = employmentSummary?.elitePool ?? 0;

        // Payroll uses Employment's labor-pool population (level-2+ workers + élites),
        // not raw housing headcount — level-1 hunter-gatherers have no salary assiette.
        if (payrollPopulation > 0 && salaryPerMonth > 0) {
          const yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
          const monthName = timeInfo.month || 'Mois';
          const payroll = computeReferenceSalaryPayrollBreakdown({
            population: payrollPopulation,
            unemployed,
            eliteCount,
            referenceSalaryPerMonth: salaryPerMonth,
            unemploymentBenefitRate,
            salaryTaxRate,
          });

          if (payroll.civilServantExpense > 0) {
            await this.deps.recordSalaries(
              payroll.civilServantExpense,
              formatCivilServantSalaryJournalDescription({
                monthName,
                yearDisplay,
                civilServantCount: payroll.civilServantCount,
                referenceSalaryPerMonth: salaryPerMonth,
              }),
              time
            );
          }

          if (payroll.unemploymentBenefitExpense > 0) {
            await this.deps.recordUnemploymentBenefits(
              payroll.unemploymentBenefitExpense,
              formatUnemploymentBenefitJournalDescription({
                monthName,
                yearDisplay,
                unemployedCount: payroll.unemployedCount,
                referenceSalaryPerMonth: salaryPerMonth,
                unemploymentBenefitRate,
              }),
              time
            );
          }

          if (salaryTaxRate > 0 && payroll.payrollTaxBase > 0) {
            await this.deps.recordPayrollTax(
              payroll.payrollTaxBase,
              salaryTaxRate,
              formatPayrollTaxJournalDescription({
                monthName,
                yearDisplay,
                salaryTaxRate,
                breakdown: payroll,
              }),
              time
            );
          }
        }
      }

      if (civilMonthKey !== this.lastMaintenanceCivilKey) {
        const buildingAmount =
          maintenanceBreakdown.roads.cost +
          maintenanceBreakdown.houses.cost +
          maintenanceBreakdown.farms.cost +
          maintenanceBreakdown.markets.cost;

        if (buildingAmount > 0) {
          const year = timeInfo.year + 1;
          const monthName = timeInfo.month || 'Mois';

          const breakdownItems = [];
          if (maintenanceBreakdown.roads.count > 0) {
            breakdownItems.push({
              label: 'Routes',
              count: maintenanceBreakdown.roads.count,
              unitCost: 2,
              total: maintenanceBreakdown.roads.cost,
            });
          }
          if (maintenanceBreakdown.houses.count > 0) {
            breakdownItems.push({
              label: 'Maisons',
              count: maintenanceBreakdown.houses.count,
              unitCost: 3,
              total: maintenanceBreakdown.houses.cost,
            });
          }
          if (maintenanceBreakdown.farms.count > 0) {
            breakdownItems.push({
              label: 'Fermes',
              count: maintenanceBreakdown.farms.count,
              unitCost: 1,
              total: maintenanceBreakdown.farms.cost,
            });
          }
          if (maintenanceBreakdown.markets.count > 0) {
            breakdownItems.push({
              label: 'Marchés',
              count: maintenanceBreakdown.markets.count,
              unitCost: 1,
              total: maintenanceBreakdown.markets.cost,
            });
          }

          const breakdownData = JSON.stringify(breakdownItems);
          const maintenanceDescription = `Maintenance mensuelle - ${monthName} ${year} |BREAKDOWN|${breakdownData}|BREAKDOWN|`;

          await this.deps.recordBuildingMaintenance(
            buildingAmount,
            maintenanceDescription,
            time
          );
          this.lastMaintenanceCivilKey = civilMonthKey;
        }
      }

      const populationResult = await this.deps.clearPopulationWithoutRoadAccess();
      if (populationResult.totalPopulationLost > 0) {
        console.warn(`⚠️ ${populationResult.message}`);
      }

      if (this.deps.processLoanPayments) {
        await this.deps.processLoanPayments();
        await this.deps.recalculateLoanTotals();
      }

      if (time % 3 === 0 && time > 0) {
        try {
          await this.deps.saveBudgetTurnEnrichment(time, {
            population: totalPop,
            buildingCounts,
          });

          const cleanupResult = await this.deps.cleanupOldBudgetTurnSnapshotsByAge();
          if (cleanupResult.deleted > 0) {
            result.cleanupResult = cleanupResult;
          }

          await this.deps.cleanupOldJournalEntries(60);
        } catch (error) {
          console.warn('Failed to save budget state:', error);
        }
      }

      await this.deps.flushJournalSessionToDexie();
    } catch (error) {
      console.warn('Budget operations failed:', error);
    } finally {
      this.#processBudgetInFlight = false;
    }

    return result;
  }
}
