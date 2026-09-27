/**
 * Workplace employees — pure format (no DOM, no I/O).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { getSkillDisplay } from '../../../../../shared/population/skillCatalog.js';
import { getResidentialGroupLabel } from '../../../shell/ResidentialGroupLabels.js';

/**
 * The label of the staff row, as the catalog says who fills this workplace: the social categories whose houses
 * provide its required skill, named as their houses are (one edit in the catalog renames it everywhere), with the
 * house level they start providing it at when it is not the first. When every category can fill it, nobody in
 * particular is expected: just "Employés". A workplace that needs no skill keeps the plain "Ouvriers".
 * @param {string} buildingType
 * @param {object} employment
 * @returns {string}
 */
function staffLabel(buildingType, employment) {
  const { groups, openToAll } = employment.getStaffingGroups(buildingType);
  if (openToAll) return 'Employés';
  if (groups.length === 0) return 'Ouvriers';
  const categories = groups.map(({ group, tier }) => `${getResidentialGroupLabel(group)}${tier > 1 ? ` (niv. ${tier})` : ''}`);
  return `Ouvriers · ${categories.join(', ')}`;
}

/**
 * Factual staffing numbers only — no "lack of personnel"-style complaint
 * text here anymore, that's a Messages-tab concern now (see
 * messagesInfoFormat.js's personnelComplaint, which reads this same
 * buildingData/employees shape).
 *
 * @param {object | null | undefined} buildingData
 * @param {object} employment
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatWorkplaceEmployeesPanel(buildingData, employment) {
  if (!buildingData?.employees) return null;

  const buildingType = buildingData.type || '';
  const employees = buildingData.employees;
  const workerNeed = employees.worker_need || 0;
  const workers = employees.worker || 0;
  const sector = employees.sector || 0;
  // Priority is set per skill now, not per sector (see SkillPriorityPolicy.js
  // — a sector like "Services Publics" spans several unrelated skills, each
  // ranked independently in its own social-group's work-panel tab).
  const requiredSkill = getBuildingDefinition(buildingType)?.employment?.requiredSkill ?? null;
  const priority = requiredSkill ? employment.getSkillPriority(requiredSkill) : null;

  return {
    sections: [{
      title: 'Employés',
      rows: [
        { label: 'Secteur', value: `${sector} : ${employment.getSectorName(sector)}` },
        ...(requiredSkill
          ? [
              { label: 'Compétence requise', value: getSkillDisplay(requiredSkill).label },
              { label: 'Priorité', value: `${priority}` },
            ]
          : []),
        { label: staffLabel(buildingType, employment), value: `${workers}/${workerNeed}` },
      ],
    }],
  };
}
