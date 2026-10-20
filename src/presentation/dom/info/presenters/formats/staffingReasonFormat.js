/**
 * Why a workplace's staff post is filled or empty — pure format (VM → text). Read by the Personnel tab (one
 * status row) and by the Messages tab (the complaint), so both say the same thing about the same post.
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/buildingCatalog.js';
import { isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { SOCIAL_CATEGORY } from '../../../../../shared/population/socialCategoryCatalog.js';
import { getSkillDisplay } from '../../../../../shared/population/skillCatalog.js';
import { getResidentialGroupLabel } from '../../../shell/ResidentialGroupLabels.js';

/**
 * The social groups whose houses can hold a skill at a level, with the first house tier
 * that grants it — read from the catalog, never a group named here.
 * @param {string} skill
 * @param {number} level
 * @returns {Array<{ group: string, minTier: number }>}
 */
export function groupsGrantingSkill(skill, level) {
  return Object.entries(SOCIAL_CATEGORY).flatMap(([group, definition]) => {
    const tier = Object.entries(definition.tiers)
      .map(([number, details]) => [Number(number), details])
      .sort(([a], [b]) => a - b)
      .find(([, details]) => (details.skills?.[skill] ?? 0) >= level);
    return tier ? [{ group, minTier: tier[0] }] : [];
  });
}

/**
 * Why a workplace stays unstaffed: who holds the skill it asks for, and what that group
 * has to offer right now. Null when the city's employment was not read.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {string | null}
 */
export function shortageCause(vm) {
  const summary = vm.employmentSummary;
  const employment = getBuildingDefinition(vm.buildingType)?.employment;
  const skill = employment?.requiredSkill;
  if (!summary || !skill) return null;

  const skillLabel = getSkillDisplay(skill).label;
  const clauses = groupsGrantingSkill(skill, employment.requiredSkillLevel ?? 1).flatMap(({ group, minTier }) => {
    const label = getResidentialGroupLabel(group);
    const stats = summary.byGroup?.[group];
    if (!stats || !(stats.workerPool > 0)) {
      return [`aucune maison pour les ${label} : il en faut pour pourvoir ce poste`];
    }
    if (!stats.poolByLevel) throw new Error(`[staffing] the employment summary of "${group}" has no poolByLevel`);
    // A house grants the skill from its tier on: the pool splits into houses that have it and houses still below it.
    const skilled = Object.entries(stats.poolByLevel)
      .filter(([level]) => Number(level) >= minTier)
      .reduce((sum, [, workers]) => sum + workers, 0);
    if (skilled === 0) {
      return [`les maisons des ${label} n'ont pas encore le niveau ${minTier} : aucune n'a la compétence « ${skillLabel} »`];
    }
    // The summary does not say who holds a job, so the skilled idle are at least skilled − assigned.
    const skilledIdle = Math.max(0, skilled - stats.assigned);
    const belowTier = stats.workerPool - skilled;
    const found = [];
    if (belowTier > 0) {
      found.push(`une partie des maisons des ${label} n'a pas encore le niveau ${minTier}`);
    }
    if (skilledIdle > 0) {
      found.push(`malgré tout, ${skilledIdle} ${label} ayant la compétence « ${skillLabel} » sont sans emploi`);
    } else if (belowTier === 0) {
      found.push(`tous les ${label} qualifiés ont déjà un emploi : il faut plus de maisons pour les ${label}`);
    }
    return found;
  });
  return clauses.length > 0
    ? clauses.join(' ; ')
    : `aucun habitant n'a la compétence « ${skillLabel} »`;
}

/**
 * The road that brings workers to the place is missing: nobody can come to work, whatever the people.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {string | null}
 */
export function roadCause(vm) {
  const roadCount = vm.buildingRow?.roads ?? 0;
  if (isRoadNeedMet(vm.buildingType, roadCount)) return null;
  return "Aucune route ne dessert ce lieu, personne ne peut venir y travailler";
}

/**
 * The status row of the Personnel tab: the post is filled, or the reasons it is not — the road, and who
 * could fill it. Null when the building asks for nobody.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {string | null}
 */
export function staffingStatusLine(vm) {
  const employees = vm.buildingRow?.employees;
  if (!employees) return null;
  const workerNeed = employees.worker_need || 0;
  if (workerNeed <= 0) return null;
  if ((employees.worker || 0) >= workerNeed) return 'Emploi complètement pourvu';

  const reasons = [roadCause(vm), shortageCause(vm)].filter(Boolean);
  // A post with no road and no reading of the city's employment has no known cause: say so, never guess one.
  if (reasons.length === 0) return "Poste non pourvu, cause inconnue : l'emploi de la ville n'a pas été lu";
  return `Poste non pourvu : ${reasons.join(' ; ')}`;
}
