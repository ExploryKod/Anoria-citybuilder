import {
  DEFAULT_HAMLET_FISCAL_RATES,
  DEFAULT_SERVICE_SUBSIDY_PERCENT,
  DEFAULT_VAT_GENERAL_RATE_PERCENT,
  DEFAULT_VAT_RATE_PERCENT,
  DEFAULT_VAT_UNIFORM,
} from '../../src/contexts/accounting/domain/catalogs/FiscalRateCatalog.js';
import { getVatCategories, getVatItems } from '../../src/shared/resource-catalog/VatCategoryCatalog.js';
import { getServiceCategories } from '../../src/shared/resource-catalog/ResourceCategoryCatalog.js';

/** The hamlet every test runs on (made active by tests/setupActiveHamlet.js). */
export const TEST_HAMLET_ID = '5f0c8a1e-2b3d-4c5e-8f6a-7b8c9d0e1f2a';

/** @param {object} row @returns {object} the same row, filed under the test hamlet */
export function inTestHamlet(row) {
  return { hamletId: TEST_HAMLET_ID, ...row };
}

/**
 * The test hamlet's row, with the default fiscal rates, in a test database that has a `hamlets` table.
 * @param {import('dexie').Dexie} database
 */
export async function seedTestHamlet(database) {
  await database.hamlets.put({
    id: TEST_HAMLET_ID,
    slug: 'eraanurbs',
    name: 'Anoria',
    natureSeeded: true,
    unlocked: true,
    ...DEFAULT_HAMLET_FISCAL_RATES,
    serviceSubsidy: Object.fromEntries(getServiceCategories().map((service) => [service, DEFAULT_SERVICE_SUBSIDY_PERCENT])),
    vatRatePercent: Object.fromEntries(getVatCategories().map((category) => [category, DEFAULT_VAT_RATE_PERCENT])),
    vatUniform: DEFAULT_VAT_UNIFORM,
    vatGeneralRatePercent: DEFAULT_VAT_GENERAL_RATE_PERCENT,
    vatExempt: Object.fromEntries(getVatItems().map((item) => [item, false])),
  });
}
