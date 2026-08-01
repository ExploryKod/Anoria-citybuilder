/**
 * ACL — legacy JournalManager store → Accounting BC infrastructure.
 */
export {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
  computeJournalCurrentBalance,
  filterAndSortJournalEntries,
} from '../../contexts/accounting/infrastructure/adapters/persistence/dexie/journalAggregations.js';

export {
  buildJournalExportPayload,
  serializeJournalExportPayload,
} from '../../contexts/accounting/presentation/JournalExportViewModel.js';

export { BrowserJournalPdfExporter } from '../../contexts/accounting/infrastructure/adapters/browser/BrowserJournalPdfExporter.js';

export { DexieJournalSessionPersistenceAdapter } from '../../contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalSessionPersistenceAdapter.js';
