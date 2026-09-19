/**
 * Workplace employees — pure format (no DOM, no I/O).
 */

import { getBuildingDefinition } from '../../../../../shared/building-catalog/index.js';
import { getSkillDisplay } from '../../../../../shared/population/skillCatalog.js';

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
  const eliteNeed = employees.elite_need || 0;
  const workers = employees.worker || 0;
  const elites = employees.elite || 0;
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
        { label: 'Ouvriers', value: `${workers}/${workerNeed}` },
        { label: 'Élites', value: `${elites}/${eliteNeed}` },
      ],
    }],
  };
}
