/**
 * The rules every insurance company of the city shares (the companies themselves, each with its premium rate, are in asset-economy/insuranceCompanies.js).
 * See docs/plan/assurances.plan.md.
 *
 * - A household pays its premium after the fact, once its month's wages are in: `premiumRate` of its net wages of the month. It is a purchase of a service
 *   named `INSURANCE_SERVICE` (the household's `service_purchase`, the company's `service_sales`), so the affiliation is read from the journal and nothing is stored.
 * - A household is covered by the company it paid last month, once it has paid it `INSURANCE_WAITING_MONTHS` months in a row. A month without a premium
 *   paid (the household could not) loses the cover, and the waiting period starts again from the next premium.
 * - A covered household whose workers are sick is paid `INSURANCE_INDEMNITY_RATE` of the wage they would have earned, by its company, never more than the
 *   company holds in cash: the reserve is the only ceiling. The social security (`sicknessCover: 'secu'`) and the insurance never pay the same absence.
 */
export const INSURANCE_SERVICE = 'insurance';

/** The premiums in a row a household must have paid a company before it is covered. The same for every company. */
export const INSURANCE_WAITING_MONTHS = 2;

/** The share of the wage an absent worker would have earned that his insurer pays. A first balance, tuned here. */
export const INSURANCE_INDEMNITY_RATE = 0.6;

/**
 * Insurance is the household's choice unless the law makes it compulsory: it takes it only if, once the premium is paid, it still holds `INSURANCE_VOLUNTARY_BUFFER_MONTHS`
 * of its net wages in cash. A poorer household goes without (and is not covered), as with a private insurance that is not compulsory. With the law in force, a household pays
 * its premium as soon as it can. A first balance, tuned here.
 */
export const INSURANCE_VOLUNTARY_BUFFER_MONTHS = 1;

/**
 * The law of compulsory insurance (the Health panel's setting `insuranceMandatory`). It can only be in force while the insurance works: a company stands, is staffed and is not in
 * default. A law passed and then left without a working insurer is suspended, not deleted, and the panel says why. Its words are here, for the screens to read.
 */
export const INSURANCE_LAW_LABELS = Object.freeze({
  title: 'Assurance obligatoire',
  off: 'Non : chaque ménage choisit de s\'assurer',
  on: 'Oui : tout ménage salarié doit s\'assurer',
  inForce: 'En vigueur : tout ménage salarié paie sa prime dès qu\'il le peut.',
  suspended: 'Suspendue : l\'assurance ne fonctionne plus.',
  reasons: Object.freeze({
    noCompany: 'Aucune compagnie d\'assurance n\'est construite.',
    notStaffed: 'Aucune compagnie d\'assurance n\'a de personnel en poste.',
    allInDefault: 'Toutes les compagnies d\'assurance sont en faillite (leurs dettes sont impayées depuis trop longtemps).',
  }),
});
