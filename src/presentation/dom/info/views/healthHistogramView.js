import { HEALTH_LABELS } from '../../../../shared/population/HealthFactorCatalog.js';

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
 * @returns {HTMLElement}
 */
export function renderHealthHistogram(environment, sick) {
  const segments = [{ id: 'base', label: HEALTH_LABELS.base, points: environment.base }, ...environment.parts];
  const section = document.createElement('section');
  section.className = 'health-histogram';

  const title = document.createElement('h4');
  title.className = 'health-histogram__title';
  title.textContent = `${HEALTH_LABELS.environment} : ${Math.round(environment.level)}${sick > 0 ? ` · ${HEALTH_LABELS.sickCount} : ${sick}` : ''}`;

  const bar = document.createElement('div');
  bar.className = 'health-histogram__bar';
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', segments.map((segment) => `${segment.label} ${roundPoints(segment.points)}`).join(', '));

  const rows = document.createElement('ul');
  rows.className = 'health-histogram__rows';

  segments.forEach((segment, index) => {
    const share = (segment.points / environment.level) * 100;
    if (segment.points > 0) {
      const part = document.createElement('div');
      part.className = `health-histogram__segment health-histogram__segment--${index % 5}`;
      part.style.flexBasis = `${share}%`;
      bar.append(part);
    }
    const row = document.createElement('li');
    row.className = 'health-histogram__row';
    const swatch = document.createElement('span');
    swatch.className = `health-histogram__swatch health-histogram__segment--${index % 5}`;
    const label = document.createElement('span');
    label.className = 'health-histogram__label';
    label.textContent = segment.label;
    const value = document.createElement('span');
    value.className = 'health-histogram__value';
    value.textContent = `${roundPoints(segment.points)} (${Math.round(share)} %)`;
    row.append(swatch, label, value);
    rows.append(row);
  });

  section.append(title, bar, rows);
  return section;
}
