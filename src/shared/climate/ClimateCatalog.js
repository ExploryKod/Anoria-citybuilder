/**
 * The climate of a year (docs/gameplay/PLAN_CRISES.md): each year is in a phase, and the phase says how much the fields yield that year (`center` ± `spread`, a
 * factor on the catalog's yield). Phases come in runs, as the cold years of the little ice age did: the chances of the next year's phase depend on this year's (`next`,
 * each row sums to 1). A crop feels the year as much as its `climateSensitivity` says (ResourceCategoryCatalog.js: 1 = the whole swing, 0.5 = half of it); a good that is not a crop has none.
 * `ANNOUNCED_PHASES` are the ones the player is told of. First values, to tune by playing.
 */
export const CLIMATE_PHASES = Object.freeze({
  plentiful: Object.freeze({ label: 'Année généreuse', center: 1.12, spread: 0.05, next: Object.freeze({ normal: 0.6, plentiful: 0.25, poor: 0.12, disastrous: 0.03 }) }),
  normal: Object.freeze({ label: 'Année ordinaire', center: 1, spread: 0.05, next: Object.freeze({ normal: 0.72, plentiful: 0.12, poor: 0.13, disastrous: 0.03 }) }),
  poor: Object.freeze({ label: 'Mauvaise année', center: 0.8, spread: 0.07, next: Object.freeze({ normal: 0.35, plentiful: 0.05, poor: 0.42, disastrous: 0.18 }) }),
  disastrous: Object.freeze({ label: 'Année désastreuse', center: 0.55, spread: 0.08, next: Object.freeze({ normal: 0.3, plentiful: 0, poor: 0.5, disastrous: 0.2 }) }),
});

/** The phase the game starts in: an ordinary year. */
export const FIRST_CLIMATE_PHASE = 'normal';

export const ANNOUNCED_PHASES = Object.freeze(['plentiful', 'poor', 'disastrous']);
