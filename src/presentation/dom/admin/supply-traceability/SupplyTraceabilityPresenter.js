/**
 * SupplyTraceabilityPresenter — HTML sections / stats (données déjà calculées).
 */

import { tryResolveBuildingInstanceIdFromRef } from '../../../../shared/building-identity/index.js';
import {
  getSuppliedCategories,
  getAnnualHarvestSchedule,
  getAnnualSupplyEntry,
  getAnnualYieldPerProducer,
  getMaxStockForBuilding,
  getPerCapitaDemand,
  getResourceRoles,
  getResourceStockShape,
} from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { buildingNameInSentence, goodAmount, goodLabel, typesHoldingRole } from '../../shell/CatalogVocabulary.js';
import { getTimeInfo, MONTHS, SEASON_EMOJI } from '../../../../shared/time/TimeCalendar.js';
import { toSupplySeason } from '../../../../composition/supplyTimeLabels.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { BUILDING_ASSETS } from '../../../three/assets/buildingAssets.js';

const NO_WORK_ICON = '/resources/textures/status/no-work.png';

/** French label per crop stage — the stages themselves come from the crop catalog. */
const CROP_STAGE_LABELS = Object.freeze({ fallow: 'Jachère', growing: 'Semailles', ripe: 'Maturité' });

/** Season → crop stage, read from the first field that declares one. */
const cropStageBySeason =
  Object.values(BUILDING_ASSETS).find((asset) => asset.crop?.stageBySeason)?.crop.stageBySeason ?? {};

const harvestSchedule = getAnnualHarvestSchedule();

/**
 * Season icon and what the fields are doing, for the corner of a month card.
 * @param {number} monthIndex
 * @returns {{ emoji: string, label: string }}
 */
function seasonBadge(monthIndex) {
  const { season } = getTimeInfo(monthIndex, 1);
  const isHarvest =
    harvestSchedule?.unit === 'season' && harvestSchedule.values?.includes(toSupplySeason(season));
  const label = isHarvest ? 'Récolte' : (CROP_STAGE_LABELS[cropStageBySeason[season]] ?? '');
  return { emoji: SEASON_EMOJI[season] ?? '', label };
}

const isHubType = (type) => getResourceRoles(type).some((entry) => entry.role === 'hub');

/** @param {Map<string, boolean>} states building → can work @returns {{ present: number, idle: number }} */
const tally = (states) => ({
  present: states.size,
  idle: [...states.values()].filter((working) => !working).length,
});

/**
 * The harvest chain of one year from the log, farms and hubs side by side.
 * Per month: how many existed and how many were idle (last state of the
 * month). For the year: `total` is the most standing at the same time (never
 * a sum — a building replaced by another is still one). A farm only counts
 * as `sold` if a hub bought its harvest — no workers, a wiped-out crop or a
 * closed hub all mean no sale — and a hub only counts as `sold` if it bought
 * something. `unsold` is what is left, the slot where further causes
 * (closure, disease, weather…) can later be split out.
 * @param {Array<object>} transactions
 * @param {number} year
 */
export function summarizeChain(transactions, year) {
  const stateByMonth = {};
  const soldFarms = new Set();
  const activeHubs = new Set();
  const missedCause = new Map();
  const farmIds = new Set();
  const demolishedIds = new Set();
  let hubType = null;

  // Oldest turn first, so the last row of a month is really the last tick of it.
  const chronological = [...transactions].sort(
    (a, b) => a.turn - b.turn || a.id - b.id
  );
  for (const t of chronological) {
    // A demolition counts whenever it happened before the farm's year ended
    if (t.transactionType === 'game_event' && t.event === 'building_demolished' && t.year <= year) {
      demolishedIds.add(t.fromId || t.fromCoords);
    }
    if (t.year !== year) continue;
    if (t.transactionType === 'chain_state') {
      const kind = isHubType(t.fromType) ? 'hubs' : 'farms';
      if (kind === 'farms') farmIds.add(t.fromId || t.fromCoords);
      if (kind === 'hubs') hubType = t.fromType;
      const month = (stateByMonth[t.month] ??= { farms: new Map(), hubs: new Map() });
      month[kind].set(t.fromId || t.fromCoords, t.quantity > 0);
    } else if (t.transactionType === 'source_to_hub' && t.quantity > 0) {
      soldFarms.add(t.fromId || t.fromCoords);
      activeHubs.add(t.toId || t.toCoords);
    } else if (t.transactionType === 'sale_missed') {
      missedCause.set(t.fromId || t.fromCoords, t.cause);
    }
  }

  const byMonth = Object.fromEntries(
    Object.entries(stateByMonth).map(([month, kinds]) => [
      month,
      { farms: tally(kinds.farms), hubs: tally(kinds.hubs) },
    ])
  );
  const yearFigure = (kind, soldCount) => {
    const peak = Math.max(0, ...Object.values(byMonth).map((month) => month[kind].present));
    // Without monthly states (older saves) the sales are the only ones known.
    const total = peak > 0 ? peak : soldCount;
    const sold = Math.min(soldCount, total);
    return { total, sold, unsold: total - sold };
  };
  const farms = yearFigure('farms', soldFarms.size);
  const hubs = yearFigure('hubs', activeHubs.size);

  // A collection turn (a sale or a missed sale) is what makes the year's
  // farm balance computable; until one happens the year is still running.
  const collectionDone = soldFarms.size > 0 || missedCause.size > 0;

  // Why the farms that did not sell did not: the causes logged on collection
  // turns, then, for the rest, what the year's data says (no hub at all).
  const counts = new Map();
  for (const [farm, cause] of missedCause) {
    if (!soldFarms.has(farm)) counts.set(cause, (counts.get(cause) ?? 0) + 1);
  }
  let explained = 0;
  const causes = [];
  for (const [id, count] of counts) {
    const kept = Math.min(count, farms.unsold - explained);
    if (kept > 0) causes.push({ id, count: kept });
    explained += kept;
  }
  // A farm the player demolished before the harvest was sold has no missed sale to explain it
  const demolishedUnsold = [...farmIds].filter(
    (id) => demolishedIds.has(id) && !soldFarms.has(id) && !missedCause.has(id)
  ).length;
  const keptDemolished = Math.min(demolishedUnsold, farms.unsold - explained);
  if (keptDemolished > 0) {
    causes.push({ id: 'demolished', count: keptDemolished });
    explained += keptDemolished;
  }
  if (farms.unsold > explained) {
    causes.push({ id: hubs.total === 0 ? 'no_hub' : 'unknown', count: farms.unsold - explained });
  }

  return {
    byMonth,
    collectionDone,
    farms: { ...farms, causes },
    hubs,
    // No hub seen that year: the one the catalog gives the diet's goods.
    hubLabel: buildingNameInSentence(hubType ?? typesHoldingRole('hub', getSuppliedCategories())[0]),
    hubCapacity: getMaxStockForBuilding(hubType),
  };
}

const noWorkIconHTML = `<img class="supply-stat-no-work-icon" src="${NO_WORK_ICON}" alt="Fermes inactives" title="Fermes inactives">`;

/** " et 1 moulin (icon : 0)" — the hubs next to the farms, empty when the game has none. */
function hubsClauseHTML(count, idle, label) {
  if (count <= 0) return '';
  return ` et ${count} ${label}${count > 1 ? 's' : ''} (${noWorkIconHTML} : ${idle})`;
}

/** What a player can act on when a farm did not sell, by cause id. */
const NON_SALE_CAUSES = {
  no_workers: () => `${noWorkIconHTML} sans travailleurs à la récolte`,
  no_road: () => '🛣️ sans route',
  hub_full: (capacity, hub) => `📦 ${hub} plein${capacity ? ` (plafond ${goodAmount(chainTotalKey, capacity)})` : ''}`,
  good_ceiling: (_capacity, hub) => `📦 ${hub} : plafond de ce bien atteint`,
  hub_no_money: (_capacity, hub) => `💸 ${hub} sans de quoi payer`,
  hub_idle: (_capacity, hub) => `🏚️ ${hub} sans travailleurs`,
  no_hub: (_capacity, hub) => `❌ pas de ${hub}`,
  demolished: () => '🚧 démolie avant la vente',
  unknown: () => '❔ cause non enregistrée',
};

/** Year row: farms that sold their harvest, out of the most farms standing at once that year. */
function farmsSoldHTML({ farms, hubs, hubLabel }) {
  return `${farms.sold}/${farms.total}${hubsClauseHTML(hubs.total, hubs.unsold, hubLabel)}`;
}

/** "Sans vente : <cause> N · <cause> N" — empty when every farm sold. */
function nonSaleCausesHTML({ farms, hubCapacity, hubLabel }) {
  if (farms.causes.length === 0) return '';
  const items = farms.causes.map(
    ({ id, count }) => `${(NON_SALE_CAUSES[id] ?? NON_SALE_CAUSES.unknown)(hubCapacity, hubLabel)} : ${count}`
  );
  return `<span class="supply-stat-farms causes">Sans vente : ${items.join(' · ')}</span>`;
}


export const chainTotalKey = getResourceStockShape().totalKey;







/**
 * @param {object|null|undefined} building
 * @returns {string|null}
 */
export function buildingStockKey(building) {
  return tryResolveBuildingInstanceIdFromRef(building) ?? building?.id ?? null;
}



/**
 * Farms a year would have needed for full coverage, with its detailed calculation:
 * the year's peak population × 12 months × per-capita demand ÷ annual yield per farm
 * (all from the catalog) — a full year of the largest population the city reached.
 * @param {Array<object>} months
 * @returns {{ farmsNeeded: number, population: string, detail: string }|null} Null when the catalog has no yield to divide by.
 */
export function fullCoverageSummary(months) {
  const yieldPerFarm = getAnnualYieldPerProducer();
  if (yieldPerFarm <= 0 || months.length === 0) return null;
  const perCapita = getPerCapitaDemand();
  const peakPopulation = Math.max(
    ...months.map((month) => (month.fedPopulation || 0) + (month.unfedPopulation || 0))
  );
  const demand = peakPopulation * MONTHS.length * perCapita;
  const farmsNeeded = Math.ceil(demand / yieldPerFarm);
  const exact = (demand / yieldPerFarm).toFixed(1).replace('.', ',');
  return {
    farmsNeeded,
    population: `${peakPopulation}`,
    detail: `${peakPopulation} habitants (le plus haut de l'année) × ${MONTHS.length} mois × ${goodAmount(chainTotalKey, perCapita)} par mois = ${goodAmount(chainTotalKey, demand)} à couvrir ÷ ${goodAmount(chainTotalKey, yieldPerFarm)} par ferme et par an = ${exact}, arrondi à ${farmsNeeded}`,
  };
}

/** The row every month card ends with: the farms that stood in the city that month. */
function monthFarmRowHTML(monthData, chain, coverage) {
  const month = chain?.byMonth[monthData.month];
  const figure = month
    ? `${month.farms.present}/${coverage ? coverage.farmsNeeded : '?'} ${noWorkIconHTML} : (${month.farms.idle})${hubsClauseHTML(month.hubs.present, month.hubs.idle, chain.hubLabel)}`
    : '—';
  return `<div class="supply-stat-month-item farms">
                                        <span class="supply-stat-month-icon">🌾</span>
                                        <span class="supply-stat-month-label">Fermes:</span>
                                        <span class="supply-stat-month-value">${figure}</span>
                                    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {Record<string, { months: Array<object>, chain?: object }>} dataByYear
 */
export function renderDietStats(container, dataByYear) {
  const monthNames = MONTHS;

  const years = Object.keys(dataByYear).sort((a, b) => parseInt(b) - parseInt(a));

  let html = '';

  years.forEach((year) => {
    const yearData = dataByYear[year];
    const monthsWithoutFamine = yearData.months.filter(
      (month) => (month.unfedPopulation || 0) === 0
    ).length;
    const coverage = fullCoverageSummary(yearData.months);
    // The newest year, with a hub but no sale yet: the balance cannot be computed
    const inProgress =
      year === years[0] && yearData.chain && yearData.chain.hubs.total > 0 && !yearData.chain.collectionDone;

    html += `
            <div class="supply-stats-year-section">
                <div class="supply-stats-year-header">
                    <h4 class="supply-stats-year-title">Année ${year}</h4>
                    <div class="supply-stats-year-summary">
                        <span class="supply-stat-badge ${monthsWithoutFamine === yearData.months.length ? 'fed' : 'unfed'}">✅ ${monthsWithoutFamine}/${yearData.months.length} mois sans famine</span>
                        ${inProgress ? `<span class="supply-stat-farms in-progress">⏳ Année en cours — le bilan des fermes sera calculé une fois la récolte vendue</span>` : `${yearData.chain && yearData.chain.farms.total > 0 ? `<span class="supply-stat-farms sold">🌾 Fermes ayant vendu leur récolte : ${farmsSoldHTML(yearData.chain)}</span>` : ''}
                        ${yearData.chain && yearData.chain.farms.total > 0 ? nonSaleCausesHTML(yearData.chain) : ''}
                        ${coverage ? `<span class="supply-stat-farms coverage">Fermes nécessaires pour nourrir les ${coverage.population} personnes : ${coverage.farmsNeeded}</span><span class="supply-stat-farms detail">${coverage.detail}</span>` : ''}`}
                    </div>
                </div>
                <div class="supply-stats-months">
                    ${yearData.months
                      .map((monthData) => {
                        const totalPop =
                          (monthData.fedPopulation || 0) + (monthData.unfedPopulation || 0);
                        return `
                            <div class="supply-stat-month-card">
                                <div class="supply-stat-month-header">
                                    <span class="supply-stat-month-name">${monthNames[monthData.month] || `Mois ${monthData.month + 1}`}</span>
                                    <span class="supply-stat-month-season">${seasonBadge(monthData.month).emoji} <small>${seasonBadge(monthData.month).label}</small></span>
                                </div>
                                <div class="supply-stat-month-details">
                                    <div class="supply-stat-month-item fed">
                                        <span class="supply-stat-month-icon">✅</span>
                                        <span class="supply-stat-month-label">Nourris:</span>
                                        <span class="supply-stat-month-value">${monthData.fedPopulation || 0}</span>
                                    </div>
                                    <div class="supply-stat-month-item unfed">
                                        <span class="supply-stat-month-icon">⚠️</span>
                                        <span class="supply-stat-month-label">Non nourris:</span>
                                        <span class="supply-stat-month-value">${monthData.unfedPopulation || 0}</span>
                                    </div>
                                    ${monthFarmRowHTML(monthData, yearData.chain, coverage)}
                                    <div class="supply-stat-month-item total">
                                        <span class="supply-stat-month-icon">👥</span>
                                        <span class="supply-stat-month-label">Total:</span>
                                        <span class="supply-stat-month-value">${totalPop}</span>
                                    </div>
                                </div>
                            </div>
                        `;
                      })
                      .join('')}
                </div>
            </div>
        `;
  });

  container.innerHTML = html;
}

/** Per-tick states are folded into the monthly figures; every other row is an event worth keeping. */
/** Snapshot rows stored in the same table as the transactions: they are not exchanges. */
export const STATE_TRANSACTION_TYPES = new Set(['chain_state', 'population_state', 'service_cutoff']);


/**
 * The traceability as one JSON document, to read a finished game: per year, the
 * balance the panel shows (months, farms, hubs, causes, farms needed) and the
 * raw events in chronological order.
 * @param {Array<object>} transactions
 * @param {Array<{ year: number, month: number, fedPopulation: number, unfedPopulation: number }>} monthlyStats
 */
export function buildSupplyTraceabilityExport(transactions, monthlyStats) {
  const years = [...new Set(monthlyStats.map((month) => month.year))].sort((a, b) => a - b);
  const chronological = [...transactions].sort(
    (a, b) => a.turn - b.turn || a.id - b.id
  );

  return {
    exportDate: new Date().toISOString(),
    years: years.map((year) => {
      const months = monthlyStats.filter((month) => month.year === year).sort((a, b) => a.month - b.month);
      const chain = summarizeChain(transactions, year);
      const coverage = fullCoverageSummary(months);
      // The newest year, with a hub but no sale yet: its farm balance is not computable
      const inProgress = year === years[years.length - 1] && chain.hubs.total > 0 && !chain.collectionDone;
      return {
        status: inProgress ? 'in_progress' : 'complete',
        year,
        monthsWithoutFamine: months.filter((month) => (month.unfedPopulation || 0) === 0).length,
        months: months.map((month) => ({
          month: MONTHS[month.month],
          fed: month.fedPopulation,
          unfed: month.unfedPopulation,
          total: month.fedPopulation + month.unfedPopulation,
          farms: chain.byMonth[month.month]?.farms ?? null,
          hubs: chain.byMonth[month.month]?.hubs ?? null,
        })),
        farms: inProgress ? { total: chain.farms.total } : chain.farms,
        hubs: { ...chain.hubs, label: chain.hubLabel, capacity: chain.hubCapacity ?? null },
        harvestSold: chain.collectionDone,
        farmsNeeded: coverage && !inProgress ? { count: coverage.farmsNeeded, calculation: coverage.detail } : null,
      };
    }),
    events: chronological
      .filter((t) => !STATE_TRANSACTION_TYPES.has(t.transactionType))
      .map((t) => ({
        turn: t.turn,
        year: t.year,
        month: t.month,
        type: t.transactionType,
        from: t.fromType ? { id: t.fromId, type: t.fromType, coords: t.fromCoords } : null,
        to: t.toType ? { id: t.toId, type: t.toType, coords: t.toCoords } : null,
        good: t.foodType,
        quantity: t.quantity,
        ...(t.cause ? { cause: t.cause } : {}),
        ...(t.event ? { event: t.event, details: t.details ?? {} } : {}),
      })),
  };
}
