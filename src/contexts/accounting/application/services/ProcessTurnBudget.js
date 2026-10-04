import { buildTurnBudgetMaintenanceSnapshot } from '../../domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import {
  computeReferenceSalaryPayrollBreakdown,
  formatCivilServantSalaryJournalDescription,
  formatPayrollTaxJournalDescription,
  formatUnemploymentBenefitJournalDescription,
} from '../../domain/policies/ReferenceSalaryPayrollPolicy.js';

/** Full fiscal years kept in the journal before the current one; older years are purged whole. */
export const JOURNAL_KEPT_FULL_YEARS = 5;

/**
 * The unit rate a maintenance category was priced at, as the breakdown carries it. Throws when absent: the monthly
 * line must show the rate actually charged, never a guessed one.
 * @param {{ unitCost?: number | null }} category
 * @param {string} label
 * @returns {number}
 */
function unitCostOf(category, label) {
  if (!Number.isFinite(category?.unitCost)) {
    throw new Error(`[ProcessTurnBudget] maintenance breakdown "${label}" has no unitCost`);
  }
  return category.unitCost;
}

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
   * @param {({ time: number, deliveredTime: number }) => Promise<void>} deps.settleServiceSubsidies
   * @param {({ time: number, deliveredTime: number }) => Promise<void>} deps.settleVat
   * @param {() => Promise<void>|void} [deps.processLoanPayments]
   * @param {(keepYears: number) => Promise<unknown>} deps.cleanupOldJournalYears
   * @param {() => Promise<unknown>} deps.flushJournalSessionToDexie
   * @param {() => string[]} [deps.listBuildingTypesForMaintenance]
   */
  constructor(deps) {
    this.deps = deps;
  }

  #processBudgetInFlight = false;

  reset() {
    this.#processBudgetInFlight = false;
  }

  /** @param {{ year: number, monthIndex: number }} timeInfo */

  /**
   * @param {object | undefined} buildingCounts
   * @param {object | undefined} maintenanceBreakdown
   */
  #resolveMaintenanceInput(buildingCounts, maintenanceBreakdown) {
    if (buildingCounts != null || maintenanceBreakdown != null) {
      if (buildingCounts == null || maintenanceBreakdown == null) {
        throw new Error('[ProcessTurnBudget] buildingCounts and maintenanceBreakdown must be passed together');
      }
      return { buildingCounts, maintenanceBreakdown };
    }

    if (typeof this.deps.listBuildingTypesForMaintenance === 'function') {
      return buildTurnBudgetMaintenanceSnapshot(this.deps.listBuildingTypesForMaintenance());
    }

    throw new Error(
      '[ProcessTurnBudget] no maintenance input: pass buildingCounts and maintenanceBreakdown, or the listBuildingTypesForMaintenance dependency'
    );
  }

  /**
   * @param {object} params
   * @param {number} params.time
   * @param {number} params.totalPop
   * @param {object} [params.buildingCounts]
   * @param {object} [params.maintenanceBreakdown]
   * @returns {Promise<object>}
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
    const result = {};

    try {
      await this.deps.collectCitizenTaxes(time);

      const timeInfo = this.deps.getTimeInfo(time);
      if (!timeInfo.month) throw new Error(`[ProcessTurnBudget] the calendar gave no month name for turn ${time}`);
      const isFirstTurnOfMonth = timeInfo.dayInMonth === 1;

      // A month's salaries are booked once per hamlet: the journal's business key refuses a second charge.
      if (isFirstTurnOfMonth) {

        const { salaryPerMonth, salaryTaxRate, unemploymentBenefitRate } =
          await this.deps.getSalarySettings();
        const employmentSummary = await this.deps.getCityEmploymentSummary();
        if (!employmentSummary) throw new Error('[payroll] the employment summary was not read: no salary can be computed');
        const payrollPopulation = employmentSummary.totalPopulation;
        const unemployed = employmentSummary.unemployed;

        // Payroll uses Employment's labor-pool population (level-2+ workers),
        // not raw housing headcount — level-1 hunter-gatherers have no salary assiette.
        if (payrollPopulation > 0 && salaryPerMonth > 0) {
          const yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
          const monthName = timeInfo.month;
          const payroll = computeReferenceSalaryPayrollBreakdown({
            population: payrollPopulation,
            unemployed,
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

      // The month that just ended is settled now: its services are all in the log. Turn 0 has no month before it.
      if (isFirstTurnOfMonth && time > 0) {
        await this.deps.settleServiceSubsidies({ time, deliveredTime: time - 1 });
        await this.deps.settleVat({ time, deliveredTime: time - 1 });
      }

      // A month's maintenance is booked once per hamlet: the journal's business key refuses a second charge.
      const buildingAmount =
        maintenanceBreakdown.roads.cost +
        maintenanceBreakdown.houses.cost +
        maintenanceBreakdown.farms.cost +
        maintenanceBreakdown.markets.cost;

      if (buildingAmount > 0) {
        const year = timeInfo.year;
        const monthName = timeInfo.month;

        const breakdownItems = [];
        if (maintenanceBreakdown.roads.count > 0) {
          breakdownItems.push({
            label: 'Routes',
            count: maintenanceBreakdown.roads.count,
            unitCost: unitCostOf(maintenanceBreakdown.roads, 'roads'),
            total: maintenanceBreakdown.roads.cost,
          });
        }
        if (maintenanceBreakdown.houses.count > 0) {
          breakdownItems.push({
            label: 'Maisons',
            count: maintenanceBreakdown.houses.count,
            unitCost: unitCostOf(maintenanceBreakdown.houses, 'houses'),
            total: maintenanceBreakdown.houses.cost,
          });
        }
        if (maintenanceBreakdown.farms.count > 0) {
          breakdownItems.push({
            label: 'Fermes',
            count: maintenanceBreakdown.farms.count,
            unitCost: unitCostOf(maintenanceBreakdown.farms, 'farms'),
            total: maintenanceBreakdown.farms.cost,
          });
        }
        if (maintenanceBreakdown.markets.count > 0) {
          breakdownItems.push({
            label: 'Marchés',
            count: maintenanceBreakdown.markets.count,
            unitCost: unitCostOf(maintenanceBreakdown.markets, 'markets'),
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
      }
      if (this.deps.processLoanPayments) {
        await this.deps.processLoanPayments();
      }

      if (time % 3 === 0 && time > 0) {
        try {
          await this.deps.cleanupOldJournalYears(JOURNAL_KEPT_FULL_YEARS);
        } catch (error) {
          throw new Error(`[ProcessTurnBudget] failed to save the turn ${time} budget state: ${error.message}`, { cause: error });
        }
      }

      await this.deps.flushJournalSessionToDexie();
    } catch (error) {
      throw new Error(`[ProcessTurnBudget] budget operations failed at turn ${time}: ${error.message}`, { cause: error });
    } finally {
      this.#processBudgetInFlight = false;
    }

    return result;
  }
}
