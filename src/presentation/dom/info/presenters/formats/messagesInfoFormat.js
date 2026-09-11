/**
 * Messages tab — pure format (VM → display model).
 *
 * Citizen complaints, not status readouts — "10 d'entre nous sommes
 * affamés" instead of "10 habitants non nourris" (moved here from the old
 * Régime tab, which was otherwise redundant with the Ressources tab's
 * per-category stock cards — see houseInfoFormat.js). `vm.lastConsumption`
 * is only ever populated for a building holding a 'consumer'/'quantity'
 * role (houses, today), so non-house buildings naturally get no complaints.
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
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ complaints: ReadonlyArray<string> }}
 */
export function formatMessagesModel(vm) {
  const complaints = [];

  const complaint = unfedComplaint(vm.lastConsumption?.totalUnfed ?? 0);
  if (complaint) complaints.push(complaint);

  return { complaints };
}
