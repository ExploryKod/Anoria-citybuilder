/**
 * ACL — financial objectives (catalog + persisted history).
 */
export {
  OBJECTIVE_CATALOG,
  isObjectiveRequirementMet,
  getObjectiveFundThreshold,
} from '../../contexts/accounting/domain/catalogs/ObjectiveCatalog.js';

import { getOrCreateAccountingContext } from '../createAccountingContext.js';

export async function recordObjectiveFailure(failureData) {
  return getOrCreateAccountingContext().recordObjectiveFailure(failureData);
}

export async function recordObjectiveSuccess(successData) {
  return getOrCreateAccountingContext().recordObjectiveSuccess(successData);
}

export async function getAllObjectiveFailures() {
  return getOrCreateAccountingContext().getAllObjectiveFailures();
}

export async function getObjectiveFailuresForObjective(objectiveId) {
  return getOrCreateAccountingContext().getObjectiveFailuresForObjective(objectiveId);
}

/** @deprecated Use getAllObjectiveFailures — legacy ObjectivesStore shape. */
export function getObjectivesStore() {
  const accounting = getOrCreateAccountingContext();
  return {
    recordObjectiveFailure: (data) => accounting.recordObjectiveFailure(data),
    recordObjectiveSuccess: (data) => accounting.recordObjectiveSuccess(data),
    getAllFailures: () => accounting.getAllObjectiveFailures(),
    getFailuresForObjective: (id) => accounting.getObjectiveFailuresForObjective(id),
  };
}
