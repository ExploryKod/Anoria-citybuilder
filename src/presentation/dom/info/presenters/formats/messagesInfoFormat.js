import { getResourceRoles, getResourceStockShape, getSuppliedCategories } from '../../../../../shared/building-catalog/resourceRoleQueries.js';
import { buildingNameInSentence, goodAmount, goodLabel, namesOfBuildings } from '../../../shell/CatalogVocabulary.js';
import { roadCause, shortageCause } from './staffingReasonFormat.js';
import { departureCauses } from '../../../../../shared/population/DepartureCauseCatalog.js';
import { HUNGER_CAUSES } from '../../../../../shared/population/HungerCauseCatalog.js';
import { splitUnfedByCause } from '../../../../../composition/housingCatalog.js';
import { formatEuro } from '../../../../../contexts/accounting/presentation/formatMoney.js';
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
 * The hungry of the house, told apart (see HungerCauseCatalog.js): one short complaint per way to go hungry ("<icon> <n> <label>"), the sentence in
 * its tooltip.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {ReadonlyArray<{ text: string, detail: string }>}
 */
function hungerComplaints(vm) {
  const hunger = splitUnfedByCause({
    unfed: Math.max(0, vm.lastConsumption?.totalUnfed ?? 0),
    houseType: vm.buildingType,
    lastConsumption: vm.lastConsumption,
    supplyShortfall: vm.buildingRow?.supplyShortfall ?? null,
  });
  return Object.entries(HUNGER_CAUSES)
    .filter(([cause]) => hunger[cause] > 0)
    .map(([cause, { icon, label, detail }]) => ({
      text: `${icon} ${hunger[cause]} ${label.toLowerCase()}`,
      detail: `${hunger[cause]} d'entre nous ${detail}`,
    }));
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {string | null}
 */
function personnelComplaint(vm) {
  const employees = vm.buildingRow?.employees;
  if (!employees) return null;

  const road = roadCause(vm);
  if (road) return road;

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
    // What this market sells, from its own catalog entry.
    const goods = getResourceRoles(vm.buildingType).find((entry) => entry.role === 'distributor')?.categories ?? [];
    complaints.push(`Aucun approvisionnement : ${goods.map(goodLabel).join(', ')}`);
  }
  if (!supplyView.hasHousesNearby) {
    complaints.push(`Aucune maison à portée : ${buildingNameInSentence(vm.buildingType)}`);
  }
  return complaints;
}

/**
 * A farm's gripes about the year ahead of the city's farms (see FoodForecastPolicy.js), read from `vm.foodForecast` (only a farm has one): too many
 * farms for the citizens to eat, and granaries too small to keep their meals from one harvest to the next. Both are voiced by every farm, since they
 * concern the farms as a whole. The granaries are named as the catalog names them.
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {ReadonlyArray<string>}
 */
function foodForecastComplaints(vm) {
  const forecast = vm.foodForecast;
  if (!forecast?.judged) return [];
  const total = getResourceStockShape().totalKey;
  const amount = (count) => goodAmount(total, count);
  const granaries = namesOfBuildings('hub', getSuppliedCategories()).join(', ').toLowerCase();

  const complaints = [];
  if (forecast.surplus > 0) {
    const spoil = forecast.spoilRisk > 0 ? ` ${amount(forecast.spoilRisk)} risquent d'être jetés, avariés.` : '';
    complaints.push(`Trop de champs (${forecast.farms}) : ${amount(forecast.harvest)} récoltés par an pour ${amount(forecast.demand)} mangés.${spoil}`);
  }
  if (forecast.unkeepable > 0) {
    const kept = forecast.kept > 0 ? `${amount(forecast.kept)} gardés` : `aucun ${granaries} en état de marche`;
    complaints.push(`Conservation insuffisante : ${kept} sur ${amount(forecast.demand)} à tenir jusqu'à la prochaine récolte.`);
  }
  return complaints;
}

/**
 * A house's crises of departure (see RunMonthlyDepartures.js), worded by the catalog: once inhabitants have left, "<icon> x/y" with the detail in
 * its tooltip; before that, the warning of the cause ("<icon> <label>"), whose tooltip says how long is left. Once the crisis is over, the penalty
 * the house serves before it can be repopulated ("<icon> <penalty>", the months left in its tooltip).
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {ReadonlyArray<{ text: string, detail: string }>}
 */
function departureComplaints(vm) {
  const crises = vm.buildingRow?.departures ?? {};
  const bans = vm.buildingRow?.repopulationBans ?? {};
  const complaints = [];
  for (const [causeId, cause] of departureCauses()) {
    const crisis = crises[causeId];
    const ban = bans[causeId];
    if (ban && !crisis) {
      complaints.push({ text: `${cause.icon} ${cause.penalty}`, detail: cause.penaltyDetail.replace('{months}', String(ban.remaining)) });
    }
    if (!crisis) continue;
    if (crisis.left > 0) {
      complaints.push({
        text: `${cause.icon} ${crisis.left}/${crisis.of}`,
        detail: `${crisis.left} des ${crisis.of} habitants sont partis : ${cause.reason}`,
      });
    } else {
      complaints.push({ text: `${cause.icon} ${cause.label}`, detail: cause.warning.replace('{months}', String(Math.max(0, cause.thresholdMonths - crisis.months))) });
    }
  }
  return complaints;
}

/**
 * A company that owes what it cannot pay: an icon and a short word with the months, and in the tooltip what it owes (the amounts, by kind).
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {ReadonlyArray<{ text: string, detail: string }>}
 */
function insolvencyComplaints(vm) {
  const insolvency = vm.insolvency;
  if (insolvency?.liquidated) {
    return [{
      text: `${insolvency.liquidatedDisplay.icon} ${insolvency.liquidatedDisplay.label}`,
      detail: 'Elle est restée trop longtemps sans payer ses dettes : son stock a été vendu, ses salariés sont partis, ses dettes sont abandonnées (la ville garantit les salaires). Elle ne reprendra pas.',
    }];
  }
  if (!insolvency || insolvency.months <= 0) return [];
  const owed = insolvency.debts.map((debt) => `${debt.label.toLowerCase()} ${formatEuro(debt.amount)}`).join(', ');
  return [{
    text: `${insolvency.display.icon} ${insolvency.display.label} ${insolvency.months} mois`,
    detail: `Elle doit ${owed} et ne peut pas le payer : ${insolvency.months} mois d'impayés. Les salaires sont payés en premier dès que la caisse le permet.`,
  }];
}

/**
 * @param {import('../../buildingInfoTypes.js').BuildingInfoViewModel} vm
 * @returns {{ complaints: ReadonlyArray<string | { text: string, detail: string }> }}
 */
export function formatMessagesModel(vm) {
  const complaints = [];

  complaints.push(...hungerComplaints(vm));

  const personnel = personnelComplaint(vm);
  if (personnel) complaints.push(personnel);

  complaints.push(...marketSupplyComplaints(vm));
  complaints.push(...foodForecastComplaints(vm));
  complaints.push(...departureComplaints(vm));
  complaints.push(...insolvencyComplaints(vm));

  return { complaints };
}
