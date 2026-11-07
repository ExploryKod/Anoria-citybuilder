/**
 * The insurance companies of the city, in the order they are founded: one company is one building (the `Insurance` entry of buildingEconomy.js). The first
 * `Insurance` built is the first company of this list, the second the next, and the construction is greyed once every company stands: the catalog's
 * `maxPerHamlet` is this list's length. A demolished company leaves its place free, and the next building founded takes it.
 * Adding a company is one entry here, which raises the limit.
 *
 * Data only; `id` is what a building row keeps (`companyId`), `name` is what the player reads. `premiumRate` is the share of a household's net wages of the month
 * its members pay as a premium (see InsuranceCatalog.js): a higher premium fills the company's reserve faster, so it can indemnify more absences.
 */
export const INSURANCE_COMPANIES = Object.freeze([
  Object.freeze({ id: 'ano', name: 'Assurance Ano', premiumRate: 0.04 }),
  Object.freeze({ id: 'aby', name: 'Assurance Aby', premiumRate: 0.06 }),
]);
