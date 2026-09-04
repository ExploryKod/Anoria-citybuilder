/**
 * Presentation — joins domain requirement descriptions (see
 * HouseLevelPolicy.describeNextTierRequirements) against
 * REQUIREMENT_KIND_PRESENTATION by `kind`. One card shape regardless of
 * requirement kind — add a new kind to both catalogs and a card appears
 * here with no code change.
 */

import { REQUIREMENT_KIND_PRESENTATION } from './CitizenStatusPresentation.js';

/**
 * @param {ReadonlyArray<{ kind: string, current: number, target: number, met: boolean }>} items
 * @returns {ReadonlyArray<{
 *   kind: string,
 *   icon: string,
 *   label: string,
 *   met: boolean,
 *   valueText: string,
 *   ariaLabel: string,
 * }>}
 */
export function formatTierRequirementCards(items) {
  return (items ?? []).map((item) => {
    const meta = REQUIREMENT_KIND_PRESENTATION[item.kind] ?? {
      icon: '❔',
      label: item.kind,
      format: 'threshold',
    };

    const valueText =
      meta.format === 'boolean'
        ? (item.met ? 'Oui' : 'Non')
        : `${item.current}/${item.target}${meta.unit ? ` ${meta.unit}` : ''}`;

    return {
      kind: item.kind,
      icon: meta.icon,
      label: meta.label,
      met: item.met,
      valueText,
      ariaLabel: `${meta.label} : ${valueText}${item.met ? ', requis atteint' : ', requis non atteint'}`,
    };
  });
}
