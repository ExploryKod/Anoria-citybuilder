/**
 * Command — mutate co-maintained treasury for a categorized expense/income movement.
 */
export class ApplyTreasuryMovement {
  /**
   * @param {import('../../ports/TreasuryWritePort.js').TreasuryWritePort} treasuryWritePort
   */
  constructor(treasuryWritePort) {
    this.treasuryWritePort = treasuryWritePort;
  }

  /**
   * @param {object} params
   * @param {'maintenance' | 'construction' | 'construction_refund' | 'salary' | 'unemployment_benefit' | 'payroll_tax' | 'citizen_tax' | 'loan_capital' | 'loan_interest' | 'loan_repayment' | 'commerce_import' | 'commerce_export' | 'exceptional_expense' | 'commercial_route' | 'capital_funds'} params.category
   * @param {number} params.amount
   * @param {object|null} [params.maintenanceBreakdown]
   * @param {string} [params.description]
   * @param {object|null} [params.taxBreakdown]
   * @param {number} [params.taxYear]
   * @param {string} [params.productId]
   * @returns {Promise<object>} Updated budget row
   */
  async execute({ category, amount, maintenanceBreakdown = null, description = '', taxBreakdown = null, taxYear = null, productId = null }) {
    if (category === 'maintenance') {
      return this.treasuryWritePort.applyMaintenanceDebit(
        amount,
        maintenanceBreakdown
      );
    }

    if (category === 'construction') {
      return this.treasuryWritePort.applyConstructionDebit(amount, description);
    }

    if (category === 'salary') {
      return this.treasuryWritePort.applySalaryDebit(amount);
    }

    if (category === 'unemployment_benefit') {
      return this.treasuryWritePort.applyUnemploymentBenefitDebit(amount);
    }

    if (category === 'payroll_tax') {
      return this.treasuryWritePort.applyPayrollTaxCredit(amount);
    }

    if (category === 'citizen_tax') {
      return this.treasuryWritePort.applyCitizenTaxCredit(amount, {
        taxBreakdown,
        taxYear,
      });
    }

    if (category === 'loan_capital') {
      return this.treasuryWritePort.applyLoanCapitalCredit(amount);
    }

    if (category === 'loan_interest') {
      return this.treasuryWritePort.applyLoanInterestDebit(amount);
    }

    if (category === 'loan_repayment') {
      return this.treasuryWritePort.applyLoanRepaymentDebit(amount);
    }

    if (category === 'commerce_import') {
      return this.treasuryWritePort.applyCommerceImportDebit(amount, productId);
    }

    if (category === 'commerce_export') {
      return this.treasuryWritePort.applyCommerceExportCredit(amount, productId);
    }

    if (category === 'exceptional_expense') {
      return this.treasuryWritePort.applyExceptionalExpenseDebit(amount);
    }

    if (category === 'commercial_route') {
      return this.treasuryWritePort.applyCommercialRouteDebit(amount);
    }

    if (category === 'capital_funds') {
      return this.treasuryWritePort.applyCapitalFundsIncomeCredit(amount);
    }

    if (category === 'construction_refund') {
      return this.treasuryWritePort.applyConstructionRefundCredit(amount, description);
    }

    throw new Error(`ApplyTreasuryMovement: unsupported category "${category}"`);
  }
}
