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
 * Same road-exemption rule `formatWorkplaceEmployeesPanel` used to apply:
 * farms don't need road access to be staffed.
 * @param {string} buildingType
 * @returns {boolean}
 */
function isFarmExemptFromRoad(buildingType) {
  const type = buildingType || '';
  return type.includes('Farm') || type.includes('farm');
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {string | null}
 */
function personnelComplaint(vm) {
  const employees = vm.buildingRow?.employees;
  if (!employees) return null;

  const roadCount = vm.buildingRow?.roads ?? 0;
  if (roadCount <= 0 && !isFarmExemptFromRoad(vm.buildingType)) {
    return "Aucune route ne dessert ce lieu, personne ne peut venir y travailler";
  }

  const workerNeed = employees.worker_need || 0;
  const workers = employees.worker || 0;
  if (workerNeed <= 0) return null;

  if (workers === 0) {
    return "Nous manquons de personnel, l'activité est totalement à l'arrêt";
  }
  if (workers < workerNeed) {
    return "Nous manquons de personnel pour fonctionner à plein régime";
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
