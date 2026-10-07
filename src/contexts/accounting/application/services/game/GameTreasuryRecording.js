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

    await this.commands.recordLoanCapitalIncome({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      loanId: loanData?.id ?? null,
      loan: loanData,
    });

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

    await this.commands.recordLoanRepaymentExpense({
      turn: budget.turn,
      amount: roundedAmount,
      description,
      loanId,
    });

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
