/**
 * FoodTraceabilityPresenter — HTML sections / stats (données déjà calculées).
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
import { getResourceCategoryPresentation } from '../../../../composition/supplyCatalog.js';
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
    (a, b) => a.turn - b.turn || new Date(a.date) - new Date(b.date)
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
    hubLabel: getBuildingDefinition(hubType)?.displayName?.toLowerCase() ?? 'hub',
    hubCapacity: getMaxStockForBuilding(hubType),
  };
}

const noWorkIconHTML = `<img class="food-stat-no-work-icon" src="${NO_WORK_ICON}" alt="Fermes inactives" title="Fermes inactives">`;

/** " et 1 moulin (icon : 0)" — the hubs next to the farms, empty when the game has none. */
function hubsClauseHTML(count, idle, label) {
  if (count <= 0) return '';
  return ` et ${count} ${label}${count > 1 ? 's' : ''} (${noWorkIconHTML} : ${idle})`;
}

/** What a player can act on when a farm did not sell, by cause id. */
const NON_SALE_CAUSES = {
  no_workers: () => `${noWorkIconHTML} sans travailleurs à la récolte`,
  no_road: () => '🛣️ sans route',
  hub_full: (capacity) => `📦 moulin plein${capacity ? ` (plafond ${capacity} paniers)` : ''}`,
  hub_idle: () => '🏚️ moulin sans travailleurs',
  no_hub: () => '❌ pas de moulin',
  demolished: () => '🚧 démolie avant la vente',
  unknown: () => '❔ cause non enregistrée',
};

/** Year row: farms that sold their harvest, out of the most farms standing at once that year. */
function farmsSoldHTML({ farms, hubs, hubLabel }) {
  return `${farms.sold}/${farms.total}${hubsClauseHTML(hubs.total, hubs.unsold, hubLabel)}`;
}

/** "Sans vente : <cause> N · <cause> N" — empty when every farm sold. */
function nonSaleCausesHTML({ farms, hubCapacity }) {
  if (farms.causes.length === 0) return '';
  const items = farms.causes.map(
    ({ id, count }) => `${(NON_SALE_CAUSES[id] ?? NON_SALE_CAUSES.unknown)(hubCapacity)} : ${count}`
  );
  return `<span class="food-stat-farms causes">Sans vente : ${items.join(' · ')}</span>`;
}

/** Goods the supply chain carries, and the aggregate they are filed under — both from the catalog. */
const chainGoods = getSuppliedCategories();
export const chainTotalKey = getResourceStockShape().totalKey;

/** @param {string} good */
export const isChainGood = (good) => chainGoods.includes(good);

/** @returns {Record<string, number>} A zeroed per-good tally. */
export const emptyGoodsTally = () => Object.fromEntries(chainGoods.map((good) => [good, 0]));

/** Subtract a per-good tally from a stock, never below zero. */
export function deductGoods(stocks, tally) {
  for (const good of chainGoods) {
    stocks[good] = Math.max(0, (stocks[good] || 0) - (tally[good] || 0));
  }
}

/** Recompute a stock's aggregate from its goods. */
export function refreshChainTotal(stocks) {
  stocks[chainTotalKey] = chainGoods.reduce((sum, good) => sum + (stocks[good] || 0), 0);
}

/** @param {Record<string, number> | null | undefined} stocks */
export const hasChainGoods = (stocks) => chainGoods.some((good) => (stocks?.[good] || 0) > 0);

/**
 * One line per good the supply chain carries that is present in the stock —
 * the goods and their labels come from the catalog, never from this file.
 * @param {Record<string, number> | null | undefined} stocks
 * @returns {string}
 */
function stockLines(stocks) {
  return getSuppliedCategories()
    .filter((category) => (stocks?.[category] ?? 0) > 0)
    .map((category) => `<div>${getResourceCategoryPresentation(category).label}: ${stocks[category]}</div>`)
    .join('');
}

/**
 * @param {object|null|undefined} building
 * @returns {string|null}
 */
export function buildingStockKey(building) {
  return tryResolveBuildingInstanceIdFromRef(building) ?? building?.id ?? null;
}

/**
 * @param {object} pair
 * @param {object} farmStocksBefore
 * @param {object} marketStocksBefore
 * @param {Record<string, number>} byFoodType
 * @param {object} farmStocksAfter
 * @param {object} marketStocksAfter
 * @returns {string}
 */
export function createFarmMarketSectionHTML(
  pair,
  farmStocksBefore,
  marketStocksBefore,
  byFoodType,
  farmStocksAfter,
  marketStocksAfter
) {
  const transactionDetails = Object.entries(byFoodType)
    .map(([foodType, quantity]) => {
      const label = getResourceCategoryPresentation(foodType).label;
      return `<div>${label}: ${quantity} panier(s)</div>`;
    })
    .join('');

  return `
        <div class="food-traceability-transaction-section">
            <div class="food-traceability-transaction-section-header">
                <span class="food-traceability-building-type">${pair.fromLabel}</span>
                <span class="food-traceability-coords-pill farm">${pair.farmCoords || 'N/A'}</span>
                <span class="food-traceability-arrow">→</span>
                <span class="food-traceability-building-type">${pair.toLabel}</span>
                <span class="food-traceability-coords-pill market">${pair.marketCoords || 'N/A'}</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.fromLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(farmStocksBefore)}
                                    <div class="food-traceability-stocks-total">Total: ${farmStocksBefore[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.toLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(marketStocksBefore)}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksBefore[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type farm-to-market">Vente</div>
                            <div class="food-traceability-transaction-subtitle">Vente à ${pair.toLabel}</div>
                            ${transactionDetails}
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type farm-to-market">Achat</div>
                            <div class="food-traceability-transaction-subtitle">Achat à ${pair.fromLabel}</div>
                            ${transactionDetails}
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.fromLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(farmStocksAfter)}
                                    <div class="food-traceability-stocks-total">Total: ${farmStocksAfter[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.toLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(marketStocksAfter)}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksAfter[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * @param {object} pair
 * @param {object} marketStocksBefore
 * @param {object} houseStocksBefore
 * @param {Record<string, number>} byFoodType
 * @param {object} marketStocksAfter
 * @param {object} houseStocksAfter
 * @returns {string}
 */
export function createMarketHouseSectionHTML(
  pair,
  marketStocksBefore,
  houseStocksBefore,
  byFoodType,
  marketStocksAfter,
  houseStocksAfter
) {
  const transactionDetails = Object.entries(byFoodType)
    .map(([foodType, quantity]) => {
      const label = getResourceCategoryPresentation(foodType).label;
      return `<div>${label}: ${quantity} panier(s)</div>`;
    })
    .join('');

  return `
        <div class="food-traceability-transaction-section">
            <div class="food-traceability-transaction-section-header">
                <span class="food-traceability-building-type">${pair.fromLabel}</span>
                <span class="food-traceability-coords-pill market">${pair.marketCoords || 'N/A'}</span>
                <span class="food-traceability-arrow">→</span>
                <span class="food-traceability-building-type">${pair.toLabel}</span>
                <span class="food-traceability-coords-pill house">${pair.houseCoords || 'N/A'}</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.fromLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(marketStocksBefore)}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksBefore[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.toLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(houseStocksBefore)}
                                    <div class="food-traceability-stocks-total">Total: ${houseStocksBefore[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type market-to-house">Vente</div>
                            <div class="food-traceability-transaction-subtitle">Vente à ${pair.toLabel}</div>
                            ${transactionDetails}
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type market-to-house">Achat</div>
                            <div class="food-traceability-transaction-subtitle">Achat à ${pair.fromLabel}</div>
                            ${transactionDetails}
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.fromLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(marketStocksAfter)}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksAfter[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${pair.toLabel}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(houseStocksAfter)}
                                    <div class="food-traceability-stocks-total">Total: ${houseStocksAfter[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

/**
 * @param {string} buildingType
 * @param {string} coords
 * @param {object} stocks
 * @param {string} pillClass
 * @returns {string}
 */
export function createBuildingStocksHTML(buildingType, coords, stocks, pillClass) {
  return `
        <div class="food-traceability-transaction-section">
            <div class="food-traceability-transaction-section-header">
                <span class="food-traceability-building-type">${buildingType}</span>
                <span class="food-traceability-coords-pill ${pillClass}">${coords || 'N/A'}</span>
                <span class="food-traceability-transaction-subtitle">(Stocks en fin de mois)</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks en fin de mois</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">${buildingType}</div>
                                <div class="food-traceability-stocks-details">
                                    ${stockLines(stocks)}
                                    <div class="food-traceability-stocks-total">Total: ${stocks[chainTotalKey] || 0}</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">-</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">-</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
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
    detail: `${peakPopulation} habitants (le plus haut de l'année) × ${MONTHS.length} mois × ${perCapita} panier par mois = ${demand} paniers à couvrir ÷ ${yieldPerFarm} paniers par ferme et par an = ${exact}, arrondi à ${farmsNeeded}`,
  };
}

/** The row every month card ends with: the farms that stood in the city that month. */
function monthFarmRowHTML(monthData, chain, coverage) {
  const month = chain?.byMonth[monthData.month];
  const figure = month
    ? `${month.farms.present}/${coverage ? coverage.farmsNeeded : '?'} ${noWorkIconHTML} : (${month.farms.idle})${hubsClauseHTML(month.hubs.present, month.hubs.idle, chain.hubLabel)}`
    : '—';
  return `<div class="food-stat-month-item farms">
                                        <span class="food-stat-month-icon">🌾</span>
                                        <span class="food-stat-month-label">Fermes:</span>
                                        <span class="food-stat-month-value">${figure}</span>
                                    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {Record<string, { months: Array<object>, chain?: object }>} dataByYear
 */
export function renderFoodStats(container, dataByYear) {
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
            <div class="food-stats-year-section">
                <div class="food-stats-year-header">
                    <h4 class="food-stats-year-title">Année ${year}</h4>
                    <div class="food-stats-year-summary">
                        <span class="food-stat-badge ${monthsWithoutFamine === yearData.months.length ? 'fed' : 'unfed'}">✅ ${monthsWithoutFamine}/${yearData.months.length} mois sans famine</span>
                        ${inProgress ? `<span class="food-stat-farms in-progress">⏳ Année en cours — le bilan des fermes sera calculé une fois la récolte vendue</span>` : `${yearData.chain && yearData.chain.farms.total > 0 ? `<span class="food-stat-farms sold">🌾 Fermes ayant vendu leur récolte : ${farmsSoldHTML(yearData.chain)}</span>` : ''}
                        ${yearData.chain && yearData.chain.farms.total > 0 ? nonSaleCausesHTML(yearData.chain) : ''}
                        ${coverage ? `<span class="food-stat-farms coverage">Fermes nécessaires pour nourrir les ${coverage.population} personnes : ${coverage.farmsNeeded}</span><span class="food-stat-farms detail">${coverage.detail}</span>` : ''}`}
                    </div>
                </div>
                <div class="food-stats-months">
                    ${yearData.months
                      .map((monthData) => {
                        const totalPop =
                          (monthData.fedPopulation || 0) + (monthData.unfedPopulation || 0);
                        return `
                            <div class="food-stat-month-card">
                                <div class="food-stat-month-header">
                                    <span class="food-stat-month-name">${monthNames[monthData.month] || `Mois ${monthData.month + 1}`}</span>
                                    <span class="food-stat-month-season">${seasonBadge(monthData.month).emoji} <small>${seasonBadge(monthData.month).label}</small></span>
                                </div>
                                <div class="food-stat-month-details">
                                    <div class="food-stat-month-item fed">
                                        <span class="food-stat-month-icon">✅</span>
                                        <span class="food-stat-month-label">Nourris:</span>
                                        <span class="food-stat-month-value">${monthData.fedPopulation || 0}</span>
                                    </div>
                                    <div class="food-stat-month-item unfed">
                                        <span class="food-stat-month-icon">⚠️</span>
                                        <span class="food-stat-month-label">Non nourris:</span>
                                        <span class="food-stat-month-value">${monthData.unfedPopulation || 0}</span>
                                    </div>
                                    ${monthFarmRowHTML(monthData, yearData.chain, coverage)}
                                    <div class="food-stat-month-item total">
                                        <span class="food-stat-month-icon">👥</span>
                                        <span class="food-stat-month-label">Total:</span>
                                        <span class="food-stat-month-value">${totalPop}</span>
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
const STATE_TRANSACTION_TYPES = new Set(['chain_state', 'population_state', 'building_state', 'employment_summary']);

/** What a building's stock counts as in the monthly figures, read from the catalog's roles. */
function stockKindOf(type) {
  if (getBuildingDefinition(type)?.residentialGroup) return 'houses';
  if (getAnnualSupplyEntry(type)) return 'farms';
  const roles = getResourceRoles(type);
  if (roles.some((entry) => entry.role === 'hub')) return 'hubs';
  if (roles.some((entry) => entry.role === 'distributor' && entry.consumption !== 'flag')) return 'distributors';
  return null;
}

/** @param {Map<string, { type: string, state: object }>} current The last state of every standing building. */
function aggregateBuildingStates(current) {
  const { totalKey } = getResourceStockShape();
  const out = {
    stocks: { houses: 0, farms: 0, hubs: 0, distributors: 0 },
    employment: { workers: 0, workerNeed: 0, understaffedBuildings: 0 },
    houseLevels: {},
  };
  for (const { type, state } of current.values()) {
    const kind = stockKindOf(type);
    if (kind) out.stocks[kind] += state.stocks?.[totalKey] ?? 0;
    if (state.workerNeed > 0) {
      out.employment.workers += state.workers ?? 0;
      out.employment.workerNeed += state.workerNeed;
      if ((state.workers ?? 0) < state.workerNeed) out.employment.understaffedBuildings += 1;
    }
    if (kind === 'houses') {
      const level = String(state.level ?? state.tier ?? '?');
      out.houseLevels[level] = (out.houseLevels[level] ?? 0) + 1;
    }
  }
  return out;
}

/**
 * The city's employment as of the end of each month, from the logged summaries: the last row
 * at or before that month, or null before the first.
 * @param {Array<object>} transactions
 * @param {number} year
 * @param {number[]} monthIndexes
 * @returns {Record<number, object | null>}
 */
export function summarizeEmploymentHistory(transactions, year, monthIndexes) {
  const rows = [...transactions]
    .filter((t) => t.transactionType === 'employment_summary')
    .sort((a, b) => a.turn - b.turn || new Date(a.date) - new Date(b.date));

  const byMonth = {};
  let current = null;
  let next = 0;
  for (const month of [...monthIndexes].sort((a, b) => a - b)) {
    while (
      next < rows.length &&
      (rows[next].year < year || (rows[next].year === year && rows[next].month <= month))
    ) {
      current = rows[next++].summary;
    }
    byMonth[month] = current;
  }
  return byMonth;
}

/**
 * The buildings' history of one year, rebuilt from the logged states: for each month with data
 * the goods held, the staff and the house levels as of that month's end, and the state of every
 * building standing at the end of the year. A demolished building leaves the picture.
 * @param {Array<object>} transactions
 * @param {number} year
 * @param {number[]} monthIndexes
 * @returns {{ byMonth: Record<number, object>, endOfYear: object[] } | null}
 */
export function summarizeBuildingHistory(transactions, year, monthIndexes) {
  const rows = [...transactions]
    .filter(
      (t) =>
        t.transactionType === 'building_state' ||
        (t.transactionType === 'game_event' && t.event === 'building_demolished')
    )
    .sort((a, b) => a.turn - b.turn || new Date(a.date) - new Date(b.date));
  if (!rows.some((t) => t.transactionType === 'building_state')) return null;

  const current = new Map();
  let next = 0;
  const advanceTo = (isBefore) => {
    while (next < rows.length && isBefore(rows[next])) {
      const t = rows[next++];
      const id = t.fromId || t.fromCoords;
      if (t.transactionType === 'building_state') {
        current.set(id, { type: t.fromType, x: t.fromCoords, id, state: t.state });
      } else {
        current.delete(id);
      }
    }
  };

  const byMonth = {};
  for (const month of [...monthIndexes].sort((a, b) => a - b)) {
    advanceTo((t) => t.year < year || (t.year === year && t.month <= month));
    byMonth[month] = aggregateBuildingStates(current);
  }
  advanceTo((t) => t.year <= year);
  const endOfYear = [...current.values()].map(({ id, type, x, state }) => ({ id, type, coords: x, ...state }));
  return { byMonth, endOfYear };
}

/**
 * The traceability as one JSON document, to read a finished game: per year, the
 * balance the panel shows (months, farms, hubs, causes, farms needed) and the
 * raw events in chronological order.
 * @param {Array<object>} transactions
 * @param {Array<{ year: number, month: number, fedPopulation: number, unfedPopulation: number }>} monthlyStats
 */
export function buildFoodTraceabilityExport(transactions, monthlyStats) {
  const years = [...new Set(monthlyStats.map((month) => month.year))].sort((a, b) => a - b);
  const chronological = [...transactions].sort(
    (a, b) => a.turn - b.turn || new Date(a.date) - new Date(b.date)
  );

  return {
    exportDate: new Date().toISOString(),
    years: years.map((year) => {
      const months = monthlyStats.filter((month) => month.year === year).sort((a, b) => a.month - b.month);
      const chain = summarizeChain(transactions, year);
      const history = summarizeBuildingHistory(transactions, year, months.map((month) => month.month));
      const employmentHistory = summarizeEmploymentHistory(transactions, year, months.map((month) => month.month));
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
          buildings: history?.byMonth[month.month] ?? null,
          unemployment: employmentHistory[month.month] ?? null,
        })),
        endOfYearBuildings: history?.endOfYear ?? null,
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
