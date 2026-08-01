import { TreasuryWritePort } from '../../../../application/ports/TreasuryWritePort.js';
import {
  applyMaintenanceDebitMutation,
  applyConstructionDebitMutation,
  applySalaryDebitMutation,
  applyPayrollTaxCreditMutation,
  applyCitizenTaxCreditMutation,
  applyLoanCapitalCreditMutation,
  applyLoanInterestDebitMutation,
  applyLoanRepaymentDebitMutation,
  applyCommerceImportDebitMutation,
  applyCommerceExportCreditMutation,
  applyExceptionalExpenseDebitMutation,
  applyCommercialRouteDebitMutation,
  applyCapitalFundsIncomeCreditMutation,
  applyConstructionRefundCreditMutation,
  applyUnemploymentBenefitDebitMutation,
} from './treasuryBudgetRowMutations.js';

/**
 * Phase 4 adapter — treasury debits/credits via Dexie budget row (no BudgetManager).
 */
export class DexieTreasuryWriteAdapter extends TreasuryWritePort {
  /** @param {import('./DexieTreasuryRepository.js').DexieTreasuryRepository} treasuryRepository */
  constructor(treasuryRepository) {
    super();
    this.treasuryRepository = treasuryRepository;
  }

  /** @returns {Promise<object>} */
  async #loadAndSave(mutator) {
    const budget = await this.treasuryRepository.getNormalizedBudgetRow();
    if (!budget) {
      throw new Error('DexieTreasuryWriteAdapter: budget row missing — call InitializeTreasury first');
    }
    mutator(budget);
    await this.treasuryRepository.saveBudgetRow(budget);
    return budget;
  }

  /** @inheritdoc */
  async applyMaintenanceDebit(amount, maintenanceBreakdown = null) {
    return this.#loadAndSave((budget) =>
      applyMaintenanceDebitMutation(budget, amount, maintenanceBreakdown)
    );
  }

  /** @inheritdoc */
  async applyConstructionDebit(amount, description) {
    return this.#loadAndSave((budget) =>
      applyConstructionDebitMutation(budget, amount, description)
    );
  }

  /** @inheritdoc */
  async applySalaryDebit(amount) {
    return this.#loadAndSave((budget) => applySalaryDebitMutation(budget, amount));
  }

  /** @inheritdoc */
  async applyUnemploymentBenefitDebit(amount) {
    return this.#loadAndSave((budget) =>
      applyUnemploymentBenefitDebitMutation(budget, amount)
    );
  }

  /** @inheritdoc */
  async applyPayrollTaxCredit(amount) {
    return this.#loadAndSave((budget) => applyPayrollTaxCreditMutation(budget, amount));
  }

  /** @inheritdoc */
  async applyCitizenTaxCredit(amount, options = {}) {
    return this.#loadAndSave((budget) =>
      applyCitizenTaxCreditMutation(budget, amount, options)
    );
  }

  /** @inheritdoc */
  async applyLoanCapitalCredit(amount) {
    return this.#loadAndSave((budget) => applyLoanCapitalCreditMutation(budget, amount));
  }

  /** @inheritdoc */
  async applyLoanInterestDebit(amount) {
    return this.#loadAndSave((budget) => applyLoanInterestDebitMutation(budget, amount));
  }

  /** @inheritdoc */
  async applyLoanRepaymentDebit(amount) {
    return this.#loadAndSave((budget) => applyLoanRepaymentDebitMutation(budget, amount));
  }

  /** @inheritdoc */
  async applyCommerceImportDebit(amount, productId) {
    return this.#loadAndSave((budget) =>
      applyCommerceImportDebitMutation(budget, amount, productId)
    );
  }

  /** @inheritdoc */
  async applyCommerceExportCredit(amount, productId) {
    return this.#loadAndSave((budget) =>
      applyCommerceExportCreditMutation(budget, amount, productId)
    );
  }

  /** @inheritdoc */
  async applyExceptionalExpenseDebit(amount) {
    return this.#loadAndSave((budget) =>
      applyExceptionalExpenseDebitMutation(budget, amount)
    );
  }

  /** @inheritdoc */
  async applyCommercialRouteDebit(amount) {
    return this.#loadAndSave((budget) =>
      applyCommercialRouteDebitMutation(budget, amount)
    );
  }

  /** @inheritdoc */
  async applyCapitalFundsIncomeCredit(amount) {
    return this.#loadAndSave((budget) =>
      applyCapitalFundsIncomeCreditMutation(budget, amount)
    );
  }

  /** @inheritdoc */
  async applyConstructionRefundCredit(amount, description) {
    return this.#loadAndSave((budget) =>
      applyConstructionRefundCreditMutation(budget, amount, description)
    );
  }
}
