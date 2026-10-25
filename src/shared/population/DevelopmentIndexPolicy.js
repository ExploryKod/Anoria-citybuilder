/**
 * The human development index, as pure rules over what the game reads (see DevelopmentCatalog.js). Shares are between 0 and 1.
 */

import { DEVELOPMENT_DIMENSIONS, INCOME_GOALPOSTS } from './DevelopmentCatalog.js';
import { SERVICE_COVERAGE_PERIODS } from './socialCategoryCatalog.js';
import { MONTHS_PER_YEAR } from '../time/TimeCalendar.js';

/**
 * Whether a service reaches a house now: its flag holds the month it last served the house, and counts for `SERVICE_COVERAGE_PERIODS` months (the year turning included).
 * @param {number | undefined} servedAt the month index the service last served the house
 * @param {number} periodKey the month index now
 * @returns {boolean}
 */
export function isServedNow(servedAt, periodKey) {
  if (!Number.isFinite(periodKey)) throw new Error(`[development] the month now is needed to tell whether a service is served, got ${periodKey}`);
  if (!Number.isFinite(servedAt)) return false;
  return (periodKey - servedAt + MONTHS_PER_YEAR) % MONTHS_PER_YEAR < SERVICE_COVERAGE_PERIODS;
}

/** @param {number} value @returns {number} the value kept between 0 and 1 */
const unit = (value) => Math.min(1, Math.max(0, value));

/**
 * @param {number} perInhabitant the product in purchasing power parity per inhabitant, in euros a year
 * @returns {number} 0 at the lower goalpost, 1 at the upper, on a logarithmic scale
 */
export function incomeIndexOf(perInhabitant) {
  const { min, max } = INCOME_GOALPOSTS;
  if (!(perInhabitant > 0)) return 0;
  return unit((Math.log(perInhabitant) - Math.log(min)) / (Math.log(max) - Math.log(min)));
}

/**
 * @param {object} params
 * @param {number | null} params.fedShare the share of the inhabitants fed
 * @param {(group: ReadonlyArray<string>) => number | null} params.coverageOf the share of the inhabitants a service of the group reaches (any of them)
 * @param {number | null} params.incomePerInhabitant the product in PPA per inhabitant, null when the prices cannot be compared yet
 * @returns {{ dimensions: Array<{ id: string, label: string, index: number | null, parts: Array<{ kind: 'fed' | 'services', services?: ReadonlyArray<string>, share: number | null }> }>, income: number | null, hdi: number | null,
 *   blockers: Array<{ kind: 'dimension' | 'income', label: string, serviceGroups?: ReadonlyArray<ReadonlyArray<string>>, goalpost?: number }> }}
 *   an index is null while one of what it is made of cannot be read: it is never replaced by a guess. The index itself is not valid while a dimension is at 0 (a geometric mean
 *   would be 0 whatever the others are, and that is what a hamlet that has not built the service yet shows): it is null, and `blockers` says which dimension to bring above 0.
 */
export function developmentIndexOf({ fedShare, coverageOf, incomePerInhabitant }) {
  const dimensions = Object.entries(DEVELOPMENT_DIMENSIONS).map(([id, dimension]) => {
    const parts = [];
    if (dimension.fed) parts.push({ kind: 'fed', share: fedShare });
    for (const group of dimension.serviceGroups) parts.push({ kind: 'services', services: group, share: coverageOf(group) });
    const readable = parts.every((part) => part.share !== null);
    return { id, label: dimension.label, index: readable ? unit(parts.reduce((sum, part) => sum + part.share, 0) / parts.length) : null, parts };
  });
  const income = incomePerInhabitant === null ? null : incomeIndexOf(incomePerInhabitant);
  const indexes = [...dimensions.map((dimension) => dimension.index), income];
  const blockers = [
    ...dimensions
      .filter((dimension) => dimension.index === 0)
      .map((dimension) => ({ kind: 'dimension', label: dimension.label, serviceGroups: dimension.parts.filter((part) => part.kind === 'services').map((part) => part.services) })),
    ...(income === 0 ? [{ kind: 'income', label: 'Revenu', goalpost: INCOME_GOALPOSTS.min }] : []),
  ];
  const hdi = blockers.length === 0 && indexes.every((index) => index !== null) ? Math.cbrt(indexes.reduce((product, index) => product * index, 1)) : null;
  return { dimensions, income, hdi, blockers };
}
