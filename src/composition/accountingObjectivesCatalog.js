/**
 * Static accounting objective catalog for presentation (no getOrCreate).
 * Persistence stays on sessionApi.accounting.getObjectivesStore().
 */
export {
  OBJECTIVE_CATALOG,
  isObjectiveRequirementMet,
  getObjectiveFundThreshold,
} from '../contexts/accounting/domain/catalogs/ObjectiveCatalog.js';
