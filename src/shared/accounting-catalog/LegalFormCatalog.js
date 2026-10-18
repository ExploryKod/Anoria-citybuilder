/**
 * The legal form of a house's enterprise: how it shares its result, and the words the player reads about it. Keyed by the enterprise's id
 * (the `enterprises` of socialCategoryCatalog.js: a form and its id are the same thing), so a new form (an SAS) is one entry here and one line
 * there. Data only.
 *
 * - `regime.shares`: how a result is shared (fractions that add up to one). `workers`: the residents' participation, a charge before the tax;
 *   `associates`: paid to the residents as dividends once the tax is set aside; `enterprise`: stays in the business as reserves.
 * - `regime.taxed`: whether the enterprise pays the corporate tax on what is left after the participation. A transparent form (a property company
 *   on the income tax) does not: its associates are taxed on their share instead.
 * - `regime.minimumShares`: the least the rules of the form ask of a part, when they ask anything (a cooperative's).
 * - `regime.rentMargin`: for a form that lets houses (`rental`), the margin it adds to the upkeep it bears when it fixes its rent.
 * - `terms`: its jargon. `allocation`: the heading of the sharing in the statement; `retained`: what stays in the business; `participation`:
 *   the residents' part before the tax, or null for a form that has none; `dividend`: what the associates are paid (`name` in the household's
 *   account, `paid` and `received` on the lines of the journal, `toAssociates` in the statement).
 */

export const LEGAL_FORMS = Object.freeze({
  // A SCOP (French worker cooperative): its residents are its workers and its associates. Each result is shared in three parts, as the rules of the
  // SCOP ask (entreprendre.service-public.gouv.fr/vosdroits/F31328): the participation at least 25 %, a charge before the tax on profits (PCG 691); the
  // interest on the parts sociales, paid after the tax, lower than both other parts (PCG 457); the rest in reserves (the legal reserve at least 15 %
  // and the development fund at least 1 %), never shared out. The usual shares are 40 / 15 / 45.
  cooperative: Object.freeze({
    regime: Object.freeze({
      taxed: true,
      shares: Object.freeze({ workers: 0.4, associates: 0.15, enterprise: 0.45 }),
      minimumShares: Object.freeze({ workers: 0.25, enterprise: 0.16 }),
    }),
    terms: Object.freeze({
      allocation: 'Affectation du résultat',
      retained: 'Résultat conservé (réserves)',
      participation: Object.freeze({ name: 'Participation aux résultats', paid: 'Participation aux résultats versée', received: 'Participation aux résultats perçue' }),
      dividend: Object.freeze({ name: 'Dividendes', paid: 'Dividendes versés', received: 'Dividendes perçus', toAssociates: 'Dividendes versés aux associés' }),
    }),
  }),
  // A SCI (property company) on the income tax: transparent, no corporate tax and no participation of workers; the result, as far as the cash goes,
  // is distributed to its associates, who are the residents, and taxed with their other income at the year's close (see SettleProducerCharges.js).
  sci: Object.freeze({
    regime: Object.freeze({
      taxed: false,
      shares: Object.freeze({ workers: 0, associates: 1, enterprise: 0 }),
      // The margin the owner adds to the upkeep it has to cover when it fixes its rent (a fraction): it aims at breaking even, nothing more.
      rentMargin: 0,
    }),
    terms: Object.freeze({
      allocation: 'Résultat distribué',
      retained: 'Résultat non distribué',
      participation: null,
      dividend: Object.freeze({ name: 'Distributions', paid: 'Distribution versée', received: 'Distribution perçue', toAssociates: 'Distribution aux associés' }),
    }),
  }),
});

/**
 * @param {string} enterpriseId the id of an enterprise of socialCategoryCatalog.js
 * @returns {typeof LEGAL_FORMS[keyof typeof LEGAL_FORMS]}
 */
export function legalFormOf(enterpriseId) {
  const form = LEGAL_FORMS[enterpriseId];
  if (!form) throw new Error(`[legal-form] enterprise "${enterpriseId}" declares no legal form in LegalFormCatalog.js: its result cannot be shared`);
  return form;
}
