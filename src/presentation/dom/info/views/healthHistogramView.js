import { HEALTH_LABELS } from '../../../../shared/population/HealthFactorCatalog.js';
import { HEALTH_MAX } from '../../../../shared/population/CitizenCatalog.js';

/** How many colours the stylesheet has for the parts of a histogram (`health-histogram__segment--0` to `--7`): the base and the most factors an environment declares (the mind's). */
const PALETTE_SIZE = 8;

/** Points are weighed by a citizen's sensitivity or averaged over a city: shown to one decimal at most. */
const roundPoints = (points) => Math.round(points * 10) / 10;

/**
 * The histogram of a house's health environment: one stacked bar, each segment the share a part gives of the house's level (the base,
 * then each factor the catalog declares), and the same parts as rows below it (label, points, share). It draws the breakdown that
 * the monthly health evolution takes its level from (see HealthEnvironmentPolicy.js): the parts add up to the level, nothing else
 * is computed here. The bar scales to any width; the rows wrap on a phone.
 *
 * @param {{ base: number, level: number, parts: ReadonlyArray<{ id: string, label: string, points: number }> }} environment
 * @param {number} sick how many of the house's inhabitants are below the sick threshold (shown in the title when there are some)
 * @param {string} heading what the level is called: the body's environment or the mind's (HEALTH_LABELS)
 * @returns {HTMLElement}
 */
export function renderHealthHistogram(environment, sick, heading) {
  if (typeof heading !== 'string' || heading === '') throw new Error('[health] a histogram says whose environment it draws, the body\'s or the mind\'s');
  const segments = [{ id: 'base', label: HEALTH_LABELS.base, points: environment.base }, ...environment.parts];
  const section = document.createElement('section');
  section.className = 'health-histogram';

  const title = document.createElement('h4');
  title.className = 'health-histogram__title';
  title.textContent = `${heading} : ${Math.round(environment.level)}${sick > 0 ? ` · ${HEALTH_LABELS.sickCount} : ${sick}` : ''}`;

  const bar = document.createElement('div');
  bar.className = 'health-histogram__bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', segments.map((segment) => `${segment.label} ${roundPoints(segment.points)}`).join(', '));

  const rows = document.createElement('ul');
  rows.className = 'health-histogram__rows';

  // The bar is the scale of health, 0 to HEALTH_MAX, so a level reads as how far it fills: the base and each part that gives stack from the left, each as wide as its points,
  // in the colour of its factor. What the parts that take points off (the pollution, the contagion, the unemployment...) remove is drawn over the end of what was given, each in
  // the colour of its own factor and hatched, one after the other, so the plain colour that is left is the level itself and the empty track is what is missing from the top.
  // The rows say each part's points, with the same colours: the same scale, with no second one.
  const lost = segments.reduce((sum, segment) => sum + Math.max(0, -segment.points), 0);
  const given = segments.reduce((sum, segment) => sum + Math.max(0, segment.points), 0);
  const percentOfScale = (points) => `${Math.round((points / HEALTH_MAX) * 10000) / 100}%`;
  bar.setAttribute('aria-label', `${bar.getAttribute('aria-label')}${lost > 0 ? `, retiré ${roundPoints(lost)}` : ''}`);
  // The colour of a factor is its place in the list: the base and the parts always come in the order the catalog declares them.
  const colourOf = (index) => `health-histogram__segment--${index % PALETTE_SIZE}`;

  // Where the first part that takes points off begins: the level, the end of what is left of what was given.
  let takenFrom = Math.max(0, given - lost);

  segments.forEach((segment, index) => {
    // The base is the level before anything; a part that gives is shown with a plus sign, a part that takes off with a minus. The same text is the row's value and the
    // tooltip of its segment on the bar.
    const points = segment.id === 'base' || segment.points === 0 ? String(roundPoints(segment.points)) : segment.points > 0 ? `+${roundPoints(segment.points)}` : String(roundPoints(segment.points));
    const tooltip = `${segment.label} : ${points}`;
    if (segment.points > 0) {
      const part = document.createElement('div');
      part.className = `health-histogram__segment ${colourOf(index)}`;
      part.style.flexBasis = percentOfScale(segment.points);
      part.title = tooltip;
      bar.append(part);
    } else if (segment.points < 0) {
      const taken = document.createElement('div');
      taken.className = `health-histogram__segment ${colourOf(index)} health-histogram__lost`;
      taken.style.left = percentOfScale(takenFrom);
      taken.style.width = percentOfScale(-segment.points);
      taken.title = tooltip;
      takenFrom += -segment.points;
      bar.append(taken);
    }
    const row = document.createElement('li');
    row.className = 'health-histogram__row';
    const swatch = document.createElement('span');
    swatch.className = `health-histogram__swatch ${colourOf(index)}${segment.points < 0 ? ' health-histogram__swatch--taken' : ''}`;
    const label = document.createElement('span');
    label.className = 'health-histogram__label';
    label.textContent = segment.label;
    const value = document.createElement('span');
    value.className = 'health-histogram__value';
    value.textContent = points;
    row.append(swatch, label, value);
    rows.append(row);
  });

  // The track itself says the level and what is still missing from the top, where the cursor is on no part.
  bar.title = `${heading} : ${Math.round(environment.level)} sur ${HEALTH_MAX}`;

  section.append(title, bar, rows);
  return section;
}
