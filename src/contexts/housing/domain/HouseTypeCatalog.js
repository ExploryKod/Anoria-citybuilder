import { normalizeResidentialTypeLabel } from '../../../shared/building-identity/index.js';

/**
 * The house type a label stands for — read from the catalog (every type that declares a `residentialGroup`), so no
 * house id is named here.
 * @param {string} type
 * @returns {string}
 */
export function normalizeResidentialType(type) {
  return normalizeResidentialTypeLabel(type);
}
