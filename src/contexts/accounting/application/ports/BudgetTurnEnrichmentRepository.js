/**
 * Port — read/write access to `budget_turn_*` enrichment rows (UI cache, not CR source).
 *
 * @typedef {import('../../domain/read-models/BudgetTurnEnrichmentSnapshot.js').BudgetTurnEnrichmentSnapshot} BudgetTurnEnrichmentSnapshot
 *
 * @typedef {object} BudgetTurnEnrichmentRepositoryPort
 * @property {(turn: number) => Promise<BudgetTurnEnrichmentSnapshot|null>} getEnrichmentAtTurn
 * @property {() => Promise<Array<object>>} listSnapshotRows
 * @property {(snapshot: BudgetTurnEnrichmentSnapshot) => Promise<object>} saveEnrichment
 */

export {};
