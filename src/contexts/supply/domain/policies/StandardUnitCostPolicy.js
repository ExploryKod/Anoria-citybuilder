import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * The units a producer makes in a month at full staffing, from what its catalog entry declares: a harvest spread over the year, a quantity made
 * every month, or a cycle (the first step's amount multiplied by the factors of the following ones, once an interval of months).
 * @param {object} entry the producer role
 * @returns {number}
 */
export function monthlyUnitsOf(entry) {
  if (entry.cycle) {
    const [first, ...rest] = entry.cycle;
    const interval = first.when?.interval ?? 1;
    const perCycle = rest.reduce((value, step) => value * (step.factor ?? 1), first.amount ?? 0);
    return perCycle / interval;
  }
  if (!Number.isFinite(entry.amount)) throw new Error('[cost] a producer role with neither an amount nor a cycle has no output to price');
  // A harvest comes once a year (a season, a month of the year): its year is spread over the twelve months.
  return entry.schedule?.unit === 'season' || entry.schedule?.unit === 'month' ? entry.amount / 12 : entry.amount;
}

/**
 * The inputs a producer uses in a month at full staffing: what each cycle takes (spread over its interval) and what the role takes every month.
 * @param {object} entry the producer role
 * @returns {Array<{ category: string, amount: number }>}
 */
export function monthlyInputsOf(entry) {
  const inputs = [];
  if (entry.cycle) {
    for (const step of entry.cycle) {
      for (const input of step.inputs ?? []) inputs.push({ category: input.category, amount: input.amount / (entry.cycle[0].when?.interval ?? 1) });
    }
  }
  for (const input of entry.inputs ?? []) inputs.push({ category: input.category, amount: input.amount });
  return inputs;
}

/**
 * The standard cost of one unit a producer makes: its month at full staffing (its workers at the labour market's wage for the skill and
 * level its workplace requires, its upkeep, the inputs it draws at their price) over the units it makes that month. It is the cost the sale price
 * is built on (cost plus the producer's margin): a standard cost, so it does not move with how busy the building is, only with the wage, the upkeep
 * and the price of its inputs.
 *
 * @param {object} params
 * @param {string} params.buildingType
 * @param {string} params.category the good it makes
 * @param {(skill: string, level: number) => number} params.wageRateOf
 * @param {(buildingType: string) => number} params.maintenanceCostOf
 * @param {number} params.employerContributionRate the employer's social contribution, a fraction of the gross wage: part of what a worker costs
 * @param {(category: string) => number} params.inputPriceOf the unit price of an input, where the producer buys it
 * @returns {number | null} null for a building with no workforce declared (a house's own business pays no wage yet): it keeps the reference price
 */
export function standardUnitCostOf({ buildingType, category, wageRateOf, maintenanceCostOf, employerContributionRate, inputPriceOf }) {
  if (!Number.isFinite(employerContributionRate)) throw new Error(`[cost] the employer contribution rate must be a number to cost "${buildingType}", got ${employerContributionRate}`);
  const employment = getBuildingDefinition(buildingType)?.employment;
  if (!employment?.workerNeed || !employment.requiredSkill) return null;
  const entry = getResourceRoles(buildingType).find((candidate) => candidate.role === 'producer' && candidate.categories.includes(category));
  if (!entry) throw new Error(`[cost] "${buildingType}" has no producer role for "${category}"`);
  const units = monthlyUnitsOf(entry);
  if (!(units > 0)) throw new Error(`[cost] "${buildingType}" makes no unit of "${category}" a month: its cost per unit is undefined`);
  // A worker costs the gross wage and the employer's contribution on it.
  const labour = employment.workerNeed * wageRateOf(employment.requiredSkill, employment.requiredSkillLevel ?? 1) * (1 + employerContributionRate);
  const inputs = monthlyInputsOf(entry).reduce((sum, input) => sum + input.amount * inputPriceOf(input.category), 0);
  return (labour + maintenanceCostOf(buildingType) + inputs) / units;
}
