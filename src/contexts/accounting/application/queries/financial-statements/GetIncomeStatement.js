import { GetIncomeStatementForFiscalYear } from './GetFinancialStatementsAtTurn.js';

/**
 * Query: compte de résultat (produits / charges) from journal for a fiscal year.
 */
export class GetIncomeStatement {
  /** @param {GetIncomeStatementForFiscalYear} getIncomeStatementForFiscalYear */
  constructor(getIncomeStatementForFiscalYear) {
    this.getIncomeStatementForFiscalYear = getIncomeStatementForFiscalYear;
  }

  /** @param {{ fiscalYear?: number|null }} [options] */
  async execute(options = {}) {
    return this.getIncomeStatementForFiscalYear.execute(options);
  }
}
