import {
  financialStatementsBundleFromJournal,
  discoverFinancialStatementTurns,
} from '../../../domain/policies/JournalFinancialStatementsPolicy.js';
import { incomeStatementFromJournalPartition } from '../../../domain/policies/IncomeStatementMappingPolicy.js';

/**
 * Linked CR + bilan at a specific turn (journal-primary).
 */
export class GetFinancialStatementsAtTurn {
  /**
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../../ports/GameTimePort.js').GameTimePort} gameTimePort
   * @param {import('../../ports/CityAssetsValuationPort.js').CityAssetsValuationPort} cityAssetsValuationPort
   * @param {import('../../../infrastructure/adapters/persistence/dexie/BudgetTurnEnrichmentRepository.js').BudgetTurnEnrichmentRepository} budgetTurnEnrichmentRepository
   * @param {{ getActiveLoans: () => Promise<Array> }} treasuryLoanPortfolio
   * @param {import('../treasury/GetTreasurySnapshot.js').GetTreasurySnapshot} getTreasurySnapshot
   */
  constructor(
    journalRepository,
    gameTimePort,
    cityAssetsValuationPort,
    budgetTurnEnrichmentRepository,
    treasuryLoanPortfolio,
    getTreasurySnapshot
  ) {
    this.journalRepository = journalRepository;
    this.gameTimePort = gameTimePort;
    this.cityAssetsValuationPort = cityAssetsValuationPort;
    this.budgetTurnEnrichmentRepository = budgetTurnEnrichmentRepository;
    this.treasuryLoanPortfolio = treasuryLoanPortfolio;
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /**
   * @param {number} atTurn
   * @returns {Promise<import('../../../domain/read-models/FinancialStatementsBundle.js').FinancialStatementsBundle>}
   */
  async execute(atTurn) {
    const [allEntries, buildingValuation, enrichment, currentSnapshot, activeLoans] =
      await Promise.all([
        this.journalRepository.getJournalEntries(),
        this.cityAssetsValuationPort.getCityBuildingValuation(),
        this.budgetTurnEnrichmentRepository.getEnrichmentAtTurn(atTurn),
        this.getTreasurySnapshot.execute(),
        this.treasuryLoanPortfolio.getActiveLoans(),
      ]);

    const currentTurn = currentSnapshot.turn ?? 0;

    return financialStatementsBundleFromJournal({
      atTurn,
      allEntries,
      getTimeInfo: (turn) => this.gameTimePort.getTimeInfo(turn),
      buildingValuation,
      enrichment: enrichment
        ? { ...enrichment, currentTurn }
        : { currentTurn, funds: null },
      currentActiveLoans: atTurn >= currentTurn ? activeLoans : [],
    });
  }
}

/**
 * History of linked financial statements (checkpoints every N turns).
 */
export class GetFinancialStatementsHistory {
  /**
   * @param {GetFinancialStatementsAtTurn} getFinancialStatementsAtTurn
   * @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository
   * @param {import('../treasury/GetTreasurySnapshot.js').GetTreasurySnapshot} getTreasurySnapshot
   */
  constructor(getFinancialStatementsAtTurn, journalRepository, getTreasurySnapshot) {
    this.getFinancialStatementsAtTurn = getFinancialStatementsAtTurn;
    this.journalRepository = journalRepository;
    this.getTreasurySnapshot = getTreasurySnapshot;
  }

  /**
   * @param {{ everyNTurns?: number, turns?: number[]|null, filterTurn?: number|null }} [options]
   * @returns {Promise<import('../../../domain/read-models/FinancialStatementsBundle.js').FinancialStatementsBundle[]>}
   */
  async execute(options = {}) {
    const everyNTurns = options.everyNTurns ?? 3;
    const [allEntries, currentSnapshot] = await Promise.all([
      this.journalRepository.getJournalEntries(),
      this.getTreasurySnapshot.execute(),
    ]);

    const currentTurn = currentSnapshot.turn ?? 0;

    let turns;
    if (options.filterTurn != null) {
      turns = [options.filterTurn];
    } else if (options.turns?.length) {
      turns = options.turns;
    } else if (options.everyNTurns === null) {
      turns = discoverFinancialStatementTurns(allEntries, currentTurn, 1);
    } else {
      turns = discoverFinancialStatementTurns(allEntries, currentTurn, everyNTurns);
    }

    const bundles = [];
    for (const turn of turns) {
      if (turn <= currentTurn) {
        bundles.push(await this.getFinancialStatementsAtTurn.execute(turn));
      }
    }

    return bundles;
  }
}

/**
 * Fiscal-year CR (not cumulative) — still journal-derived, grouped by civil year.
 */
export class GetIncomeStatementForFiscalYear {
  /** @param {import('../../ports/JournalRepository.js').JournalRepository} journalRepository */
  constructor(journalRepository) {
    this.journalRepository = journalRepository;
  }

  /** @param {{ fiscalYear?: number|null }} [options] */
  async execute(options = {}) {
    const yearlyData = await this.journalRepository.getYearlyFinancialSummary();
    const fiscalYear =
      options.fiscalYear ??
      (yearlyData.length > 0 ? yearlyData[0].year : 0);

    const yearSummary = yearlyData.find((y) => y.year === fiscalYear) ?? {
      income: { total: 0, entries: [] },
      expenses: { total: 0, entries: [] },
    };

    return incomeStatementFromJournalPartition(fiscalYear, yearSummary);
  }
}
