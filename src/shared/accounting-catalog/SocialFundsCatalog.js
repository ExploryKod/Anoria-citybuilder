/**
 * The city's social security holds two funds, as the URSSAF collects for several branches and passes each its share:
 *
 * - the health fund, account 431 "Sécurité sociale": every contribution the city receives is credited to it (the employers', the employees', what a company
 *   owes and has not yet paid), and the sickness allowance is paid out of it;
 * - the unemployment fund, account 4378 "Autres organismes sociaux – Divers" (437 has no account of its own for the unemployment insurance in the chart): the
 *   unemployment benefit is paid out of it. It is fed by the monthly allocation (`od_social_allocation`, see CloseMonthAccounts): a share of what the city
 *   received on 431 that month moves to it.
 *
 * Each fund's balance is what the city holds for its branch; a fund that goes below nothing is a deficit, visible in the grand livre.
 */
export const HEALTH_FUND_ACCOUNT = '431';
export const UNEMPLOYMENT_FUND_ACCOUNT = '4378';

/** The share of the contributions received in a month that goes to the unemployment fund (France: about a third of the whole). A first balance, tuned here. */
export const UNEMPLOYMENT_CONTRIBUTION_SHARE = 1 / 3;

/** The words the player reads about the funds: declared here so that the screens write none by hand. */
export const SOCIAL_FUND_LABELS = Object.freeze({
  title: 'Caisses sociales',
  health: 'Caisse maladie',
  unemployment: 'Caisse chômage',
  deficit: 'Déficit',
  note: 'Ce que la ville détient pour chaque branche : les cotisations y entrent, les prestations en sortent. Sous zéro, la caisse est en déficit.',
});
