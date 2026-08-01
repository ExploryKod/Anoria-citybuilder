/**
 * Legacy game-loop treasury recordings (validate → BC command → refresh snapshot).
 */
export class GameTreasuryRecording {
  /**
   * @param {object} deps
   * @param {import('../../queries/treasury/GetTreasurySnapshot.js').GetTreasurySnapshot} deps.getTreasurySnapshot
   * @param {object} deps.commands
   */
  constructor({ getTreasurySnapshot, commands }) {
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.commands = commands;
  }

  async recordSalaries(salaryPerMonth, population, description = null, turn = null) {
    const budget = await this.getTreasurySnapshot.execute();
    const effectiveTurn = turn ?? budget.turn;

    if (
      typeof salaryPerMonth !== 'number' ||
      Number.isNaN(salaryPerMonth) ||
      !Number.isFinite(salaryPerMonth) ||
      salaryPerMonth < 0
    ) {
      console.error(`Invalid salary per month: ${salaryPerMonth}`);
      return budget;
    }

    if (
      typeof population !== 'number' ||
      Number.isNaN(population) ||
      !Number.isFinite(population) ||
      population < 0
    ) {
      console.error(`Invalid population: ${population}`);
      return budget;
    }

    const totalSalary = Math.round(salaryPerMonth * population);
    if (totalSalary <= 0) {
      return budget;
    }

    await this.commands.recordSalaryExpense({
      turn: effectiveTurn,
      amount: totalSalary,
      description:
        description || `Salaires fonctionnaires (${population} hab. × ${salaryPerMonth}€)`,
    });

    return this.getTreasurySnapshot.execute();
  }

  async recordPayrollTax(salaryAmount, taxRate, description = null, turn = null) {
    const budget = await this.getTreasurySnapshot.execute();
    const effectiveTurn = turn ?? budget.turn;

    if (
      typeof salaryAmount !== 'number' ||
      Number.isNaN(salaryAmount) ||
      !Number.isFinite(salaryAmount) ||
      salaryAmount < 0
    ) {
      return budget;
    }

    if (
      typeof taxRate !== 'number' ||
      Number.isNaN(taxRate) ||
      !Number.isFinite(taxRate) ||
      taxRate < 0 ||
      taxRate > 1
    ) {
      return budget;
    }

    const taxAmount = Math.round(salaryAmount * taxRate);
    if (taxAmount <= 0) {
      return budget;
    }

    await this.commands.recordPayrollTaxIncome({
      turn: effectiveTurn,
      amount: taxAmount,
      description: description || `Impôt sur les salaires (${Math.round(taxRate * 100)}%)`,
    });

    return this.getTreasurySnapshot.execute();
  }

  async recordExceptionalRepairExpense(amount, description) {
    const budget = await this.getTreasurySnapshot.execute();
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return budget;
    }

    await this.commands.recordExceptionalExpense({
      turn: budget.turn,
      amount: roundedAmount,
      description,
    });

    return this.getTreasurySnapshot.execute();
  }

  async recordCommercialRouteFee(amount, description, partnerId) {
    const budget = await this.getTreasurySnapshot.execute();
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return {
        budget,
        recorded: false,
        skipped: true,
        treasuryApplied: false,
        reason: 'zero_amount',
      };
    }

    const result = await this.commands.recordCommercialRouteExpense({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      partnerId,
    });

    return {
      budget: result.recorded ? await this.getTreasurySnapshot.execute() : budget,
      recorded: result.recorded,
      skipped: result.skipped,
      treasuryApplied: result.treasuryApplied,
      reason: result.reason,
    };
  }

  async recordImportExpense(amount, description, productId = 'unknown', partnerId = null) {
    const budget = await this.getTreasurySnapshot.execute();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      console.error(`Invalid import expense amount: ${amount}`);
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    await this.commands.recordCommerceImportExpense({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      productId,
      partnerId,
    });

    return this.getTreasurySnapshot.execute();
  }

  async recordExportIncome(amount, description, productId = 'unknown', partnerId = null) {
    const budget = await this.getTreasurySnapshot.execute();

    if (typeof amount !== 'number' || Number.isNaN(amount) || !Number.isFinite(amount)) {
      console.error(`Invalid export income amount: ${amount}`);
      return budget;
    }

    const roundedAmount = Math.round(amount);
    if (roundedAmount <= 0) {
      return budget;
    }

    await this.commands.recordCommerceExportIncome({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      productId,
      partnerId,
    });

    return this.getTreasurySnapshot.execute();
  }

  async recordLoanCapital(amount, description = 'Loan', loanData = null) {
    const budget = await this.getTreasurySnapshot.execute();
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return budget;
    }

    const result = await this.commands.recordLoanCapitalIncome({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      loanId: loanData?.id ?? null,
    });

    if (!result.recorded) {
      return this.getTreasurySnapshot.execute();
    }

    if (loanData) {
      return this.commands.addLoanToPortfolio(loanData);
    }

    return this.getTreasurySnapshot.execute();
  }

  async recordLoanInterest(amount, description = 'Loan Interest', loanId = null) {
    const budget = await this.getTreasurySnapshot.execute();
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return budget;
    }

    await this.commands.recordLoanInterestExpense({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      loanId,
    });

    return this.getTreasurySnapshot.execute();
  }

  async recordLoanRepayment(amount, description = 'Loan Repayment', loanId = null) {
    const budget = await this.getTreasurySnapshot.execute();
    const roundedAmount = Math.round(amount);

    if (roundedAmount <= 0) {
      return budget;
    }

    const result = await this.commands.recordLoanRepaymentExpense({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      loanId,
    });

    if (!result.recorded) {
      return this.getTreasurySnapshot.execute();
    }

    if (loanId) {
      return this.commands.applyRepaymentToPortfolio(loanId, amount);
    }

    return this.getTreasurySnapshot.execute();
  }

  async recordInfoLoanInstallment({
    interestAmount = 0,
    principalAmount = 0,
    loanId,
    loanType = 'bank',
  }) {
    const budget = await this.getTreasurySnapshot.execute();

    if (!loanId) {
      return budget;
    }

    await this.commands.recordInfoLoanInstallment({
      turn: budget.turn,
      interestAmount,
      principalAmount,
      loanId,
      loanType,
    });

    return budget;
  }
}
