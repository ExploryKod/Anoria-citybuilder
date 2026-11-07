/**
 * Who pays a worker who is sick (the absent are the sick among the workers assigned, counted by the worker distribution: `employees.absentSources`). In every mode the employer pays nobody
 * for a day not worked: the absent share of a workplace's workers is out of its payroll. The modes differ in what the household receives instead.
 *
 * - `none` (the default): nothing. The household loses that share of the wage; the company loses the production. No law is passed.
 * - `secu`: the social security (the city's social body, account 431: the contributions in, the benefit out, as the unemployment benefit)
 *   pays the household a daily allowance — `SICKNESS_INDEMNITY_RATE` of the wage the absent worker would have earned — after a waiting
 *   period at the start of the illness, `SICKNESS_WAITING_SHARE` of the month, which nobody pays. Taxed as a benefit (income tax, no employee contribution).
 *
 * Insurance companies (mutuelles) are a later mode, a service with its own rules and competition.
 */
export const SICKNESS_COVERS = Object.freeze(['none', 'secu']);
export const DEFAULT_SICKNESS_COVER = 'none';

/** The words the player reads about the cover: declared here so that the panel writes none by hand. */
export const SICKNESS_COVER_LABELS = Object.freeze({
  title: 'Arrêts maladie',
  // Short, they are the entries of a dropdown: what each one does is `sicknessCoverExplanation`, written under it.
  none: 'Aucune couverture',
  secu: 'Sécurité sociale',
});

/** What the cover does, in words, from the figures above (so that changing them changes the wording). */
export function sicknessCoverExplanation(cover) {
  assertSicknessCover(cover);
  if (cover === 'none') return 'Le ménage perd le salaire de l\'absent.';
  return `Le ménage touche ${Math.round(SICKNESS_INDEMNITY_RATE * 100)} % du salaire, après ${Math.round(SICKNESS_WAITING_SHARE * 100)} % du mois de carence.`;
}

/** The share of the wage the allowance pays (France: half of the gross wage). A first balance, tuned here. */
export const SICKNESS_INDEMNITY_RATE = 0.5;

/**
 * The share of the wage an invalid worker would have earned that the social security pays him as a pension (France: 30 to 50 %), from the first day: no waiting period, for as
 * long as he is invalid (HealthFactorCatalog.js). It comes out of the same health fund as the sickness allowance (431: the branch of sickness, invalidity and death),
 * and is taxed the same. A first balance, tuned here.
 */
export const INVALIDITY_PENSION_RATE = 0.5;

/** The share of the month at the start of an illness that is paid by nobody (France: 3 days of 30). A share, never a number of days: a month is `daysPerMonth` long. */
export const SICKNESS_WAITING_SHARE = 0.1;

/** @param {string} cover */
export function assertSicknessCover(cover) {
  if (!SICKNESS_COVERS.includes(cover)) throw new Error(`[sickness] unknown cover "${cover}": expected one of ${SICKNESS_COVERS.join(', ')}`);
  return cover;
}
