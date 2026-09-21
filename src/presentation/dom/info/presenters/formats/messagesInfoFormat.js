import { isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { getBuildingDefinition } from '../../../../../shared/building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY } from '../../../../../shared/population/socialCategoryCatalog.js';
import { getSkillDisplay } from '../../../../../shared/population/skillCatalog.js';
import { getResidentialGroupLabel } from '../../../shell/ResidentialGroupLabels.js';
/**
 * Messages tab — pure format (VM → display model).
 *
 * Every operational gripe a building has to report — fed or not, staffed
 * or not, supplied or not — lives here now, phrased as the building's own
 * voice ("10 d'entre nous sommes affamés") instead of a dry status readout
 * scattered across whichever tab happened to compute it. The other tabs
 * (État/Personnel/...) keep only static catalog/reference facts; anything
 * that changes with the building's current operational state is a
 * complaint here instead, so there's exactly one place a player checks for
 * "what's wrong with this building" instead of several. Silence (empty
 * `complaints`) means nothing's wrong — no positive/neutral messages.
 *
 * `vm.lastConsumption` is only ever populated for a building holding a
 * 'consumer'/'quantity' role (houses, today); `vm.buildingRow.employees`
 * only for a workplace; `vm.supplyView.kind === 'market'` only for a
 * market — so each complaint naturally applies to just the building kinds
 * it makes sense for.
 */

/**
 * @param {number} totalUnfed
 * @returns {string | null}
 */
function unfedComplaint(totalUnfed) {
  if (!(totalUnfed > 0)) return null;
  return totalUnfed === 1
    ? "1 d'entre nous est affamé"
    : `${totalUnfed} d'entre nous sommes affamés`;
}

/**
 * The social groups whose houses can hold a skill at a level, with the first house tier
 * that grants it — read from the catalog, never a group named here.
 * @param {string} skill
 * @param {number} level
 * @returns {Array<{ group: string, minTier: number }>}
 */
function groupsGrantingSkill(skill, level) {
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
function shortageCause(vm) {
  const summary = vm.employmentSummary;
  const employment = getBuildingDefinition(vm.buildingType)?.employment;
  const skill = employment?.requiredSkill;
  if (!summary || !skill) return null;

  const skillLabel = getSkillDisplay(skill).label;
  const causes = groupsGrantingSkill(skill, employment.requiredSkillLevel ?? 1).map(({ group, minTier }) => {
    const label = getResidentialGroupLabel(group);
    const stats = summary.byGroup?.[group];
    if (!stats || !(stats.workerPool > 0)) {
      return `aucune maison pour les ${label} : il en faut pour pourvoir ce poste`;
    }
    if (stats.unemployed > 0) {
      return `des ${label} sont sans emploi, mais leurs maisons n'ont pas encore la compétence « ${skillLabel} » (niveau ${minTier} requis)`;
    }
    return `tous les ${label} ont déjà un emploi : il faut plus de maisons pour les ${label}`;
  });
  return causes.length > 0
    ? causes.join(' ; ')
    : `aucun habitant n'a la compétence « ${skillLabel} »`;
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {string | null}
 */
function personnelComplaint(vm) {
  const employees = vm.buildingRow?.employees;
  if (!employees) return null;

  const roadCount = vm.buildingRow?.roads ?? 0;
  if (!isRoadNeedMet(vm.buildingType, roadCount)) {
    return "Aucune route ne dessert ce lieu, personne ne peut venir y travailler";
  }

  const workerNeed = employees.worker_need || 0;
  const workers = employees.worker || 0;
  if (workerNeed <= 0) return null;

  const cause = shortageCause(vm);
  const because = cause ? ` — ${cause}` : '';
  if (workers === 0) {
    return `Nous manquons de personnel, l'activité est totalement à l'arrêt${because}`;
  }
  if (workers < workerNeed) {
    return `Nous manquons de personnel pour fonctionner à plein régime${because}`;
  }
  return null;
}

/**
 * Supply-chain gripes specific to a market — "no farms feed us", "no
 * houses to sell to" — see GetBuildingSupplyView.js, only populated when
 * `kind === 'market'`. Staffing/road issues are already covered generically
 * by personnelComplaint (a market is a workplace too), not repeated here.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {ReadonlyArray<string>}
 */
function marketSupplyComplaints(vm) {
  const supplyView = vm.supplyView;
  if (supplyView?.kind !== 'market') return [];

  const complaints = [];
  if (supplyView.noFarmsNearby === true) {
    complaints.push('Aucune ferme ne nous approvisionne');
  }
  if (!supplyView.hasHousesNearby) {
    complaints.push("Aucune maison n'est à portée de nos étals");
  }
  return complaints;
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ complaints: ReadonlyArray<string> }}
 */
export function formatMessagesModel(vm) {
  const complaints = [];

  const hunger = unfedComplaint(vm.lastConsumption?.totalUnfed ?? 0);
  if (hunger) complaints.push(hunger);

  const personnel = personnelComplaint(vm);
  if (personnel) complaints.push(personnel);

  complaints.push(...marketSupplyComplaints(vm));

  return { complaints };
}
