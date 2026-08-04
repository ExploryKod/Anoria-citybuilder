/**
 * Workplace employees — pure format (no DOM, no I/O).
 */

/**
 * @param {object | null | undefined} buildingData
 * @param {{ fullyStaffed: string, noWorkers: string, partialWorkers: string }} messages
 * @param {object} employment
 * @returns {import('../../buildingInfoTypes.js').InfoKvPanelModel | null}
 */
export function formatWorkplaceEmployeesPanel(buildingData, messages, employment) {
  if (!buildingData?.employees) return null;

  const roadCount = buildingData.roads ?? 0;
  const buildingType = buildingData.type || '';
  const farmExemptFromRoad = buildingType.includes('Farm') || buildingType.includes('farm');
  const employees = buildingData.employees;
  const workerNeed = employees.worker_need || 0;
  const eliteNeed = employees.elite_need || 0;
  const workers = employees.worker || 0;
  const elites = employees.elite || 0;
  const sector = employees.sector || 0;
  const priority = employment.getSectorPriority(sector);

  if (roadCount <= 0 && !farmExemptFromRoad) {
    return {
      sections: [{
        title: 'Employés',
        rows: [],
        banners: [{ text: '🚧 Route nécessaire pour embaucher', variant: 'warning' }],
      }],
    };
  }

  const hasEnoughWorkers = workers >= workerNeed;
  const hasNoWorkers = workers === 0 && workerNeed > 0;
  const hasPartialWorkers = workers > 0 && workers < workerNeed;

  /** @type {import('../../buildingInfoTypes.js').InfoBannerMessage[]} */
  const banners = [];
  if (hasEnoughWorkers) {
    banners.push({ text: messages.fullyStaffed, variant: 'success' });
  } else if (hasNoWorkers) {
    banners.push({ text: messages.noWorkers, variant: 'error' });
  } else if (hasPartialWorkers) {
    banners.push({ text: messages.partialWorkers, variant: 'warning' });
  }

  return {
    sections: [{
      title: 'Employés',
      rows: [
        { label: 'Secteur', value: `${sector} : ${employment.getSectorName(sector)}` },
        { label: 'Priorité', value: `${priority}` },
        { label: 'Ouvriers', value: `${workers}/${workerNeed}` },
        { label: 'Élites', value: `${elites}/${eliteNeed}` },
      ],
      banners,
    }],
  };
}
