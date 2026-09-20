/**
 * FoodTraceabilityPresenter — HTML sections / stats (données déjà calculées).
 */

import { tryResolveBuildingInstanceIdFromRef } from '../../../../shared/building-identity/index.js';
import {
  getAllCategoriesForRole,
  getAnnualHarvestSchedule,
  getAnnualYieldPerProducer,
  getPerCapitaDemand,
  getResourceStockShape,
} from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getResourceCategoryPresentation } from '../../../../composition/supplyCatalog.js';
import { getTimeInfo, MONTHS, SEASON_EMOJI } from '../../../../shared/time/TimeCalendar.js';
import { toSupplySeason } from '../../../../composition/supplyTimeLabels.js';
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

/**
 * Farms of one year from the log. Per month: how many existed and how many
 * were idle (last state of the month). For the year: `total` is the most
 * farms standing at the same time (never a sum — a farm replaced by another
 * is still one), and a farm only counts as `sold` if a hub bought its
 * harvest — no workers, a wiped-out crop or a closed hub all mean no sale.
 * `unsold` is what is left, the slot where further causes (closure, disease,
 * weather…) can later be split out.
 * @param {Array<object>} transactions
 * @param {number} year
 * @returns {{ byMonth: Record<number, { present: number, idle: number }>, total: number, sold: number, unsold: number }}
 */
export function summarizeFarms(transactions, year) {
  const stateByMonth = {};
  const sold = new Set();
  for (const t of transactions) {
    if (t.year !== year) continue;
    const farm = t.fromId || t.fromCoords;
    if (t.transactionType === 'producer_state') {
      (stateByMonth[t.month] ??= new Map()).set(farm, t.quantity > 0);
    } else if (t.transactionType === 'source_to_hub' && t.quantity > 0) {
      sold.add(farm);
    }
  }
  const byMonth = Object.fromEntries(
    Object.entries(stateByMonth).map(([month, farms]) => [
      month,
      { present: farms.size, idle: [...farms.values()].filter((working) => !working).length },
    ])
  );
  const peak = Math.max(0, ...Object.values(byMonth).map((month) => month.present));
  // Without monthly states (older saves) the sales are the only farms known.
  const total = peak > 0 ? peak : sold.size;
  const soldCount = Math.min(sold.size, total);
  return { byMonth, total, sold: soldCount, unsold: total - soldCount };
}

const noWorkIconHTML = `<img class="food-stat-no-work-icon" src="${NO_WORK_ICON}" alt="Fermes inactives" title="Fermes inactives">`;

/** Year row: farms that sold their harvest, out of the most farms standing at once that year. */
function farmsSoldHTML({ sold, total, unsold }) {
  return `${sold}/${total} ${noWorkIconHTML} : ${unsold}`;
}

/** Goods the supply chain carries, and the aggregate they are filed under — both from the catalog. */
const chainGoods = getAllCategoriesForRole('hub');
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
  return getAllCategoriesForRole('hub')
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
                <span class="food-traceability-building-type">Ferme</span>
                <span class="food-traceability-coords-pill farm">${pair.farmCoords || 'N/A'}</span>
                <span class="food-traceability-arrow">→</span>
                <span class="food-traceability-building-type">Marché</span>
                <span class="food-traceability-coords-pill market">${pair.marketCoords || 'N/A'}</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Ferme</div>
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
                                <div class="food-traceability-stocks-label">Marché</div>
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
                            <div class="food-traceability-transaction-subtitle">Vente au marché</div>
                            ${transactionDetails}
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type farm-to-market">Achat</div>
                            <div class="food-traceability-transaction-subtitle">Achat à la ferme</div>
                            ${transactionDetails}
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Ferme</div>
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
                                <div class="food-traceability-stocks-label">Marché</div>
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
                <span class="food-traceability-building-type">Marché</span>
                <span class="food-traceability-coords-pill market">${pair.marketCoords || 'N/A'}</span>
                <span class="food-traceability-arrow">→</span>
                <span class="food-traceability-building-type">Maison</span>
                <span class="food-traceability-coords-pill house">${pair.houseCoords || 'N/A'}</span>
            </div>
            <div class="food-traceability-transaction-table">
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks avant transaction</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Marché</div>
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
                                <div class="food-traceability-stocks-label">Maison</div>
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
                            <div class="food-traceability-transaction-subtitle">Vente à la maison</div>
                            ${transactionDetails}
                        </div>
                    </div>
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Transaction</div>
                        <div class="food-traceability-transaction-details">
                            <div class="food-traceability-transaction-type market-to-house">Achat</div>
                            <div class="food-traceability-transaction-subtitle">Achat au marché</div>
                            ${transactionDetails}
                        </div>
                    </div>
                </div>
                <div class="food-traceability-transaction-row">
                    <div class="food-traceability-transaction-cell">
                        <div class="food-traceability-cell-header">Stocks après transaction (prévision)</div>
                        <div class="food-traceability-stocks-column">
                            <div class="food-traceability-stocks-cell">
                                <div class="food-traceability-stocks-label">Marché</div>
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
                                <div class="food-traceability-stocks-label">Maison</div>
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
 * Σ monthly population × per-capita demand ÷ annual yield per farm (all from the catalog).
 * @param {Array<object>} months
 * @returns {{ farmsNeeded: number, population: string, detail: string }|null} Null when the catalog has no yield to divide by.
 */
function fullCoverageSummary(months) {
  const yieldPerFarm = getAnnualYieldPerProducer();
  if (yieldPerFarm <= 0) return null;
  const perCapita = getPerCapitaDemand();
  const residentMonths = months.reduce(
    (sum, month) => sum + (month.fedPopulation || 0) + (month.unfedPopulation || 0),
    0
  );
  const demand = residentMonths * perCapita;
  const farmsNeeded = Math.ceil(demand / yieldPerFarm);
  const monthCount = months.length;
  const averagePopulation = residentMonths / monthCount;
  const populationLabel = Number.isInteger(averagePopulation)
    ? `${averagePopulation}`
    : `~${Math.round(averagePopulation)}`;
  const exact = (demand / yieldPerFarm).toFixed(1).replace('.', ',');
  return {
    farmsNeeded,
    population: populationLabel,
    detail: `${populationLabel} habitants × ${monthCount} mois × ${perCapita} panier par mois = ${demand} paniers à couvrir ÷ ${yieldPerFarm} paniers par ferme et par an = ${exact}, arrondi à ${farmsNeeded}`,
  };
}

/** The row every month card ends with: the farms that stood in the city that month. */
function monthFarmRowHTML(monthData, farms, coverage) {
  const month = farms?.byMonth[monthData.month];
  const figure = month
    ? `${month.present}/${coverage ? coverage.farmsNeeded : '?'} ${noWorkIconHTML} : (${month.idle})`
    : '—';
  return `<div class="food-stat-month-item farms">
                                        <span class="food-stat-month-icon">🌾</span>
                                        <span class="food-stat-month-label">Fermes:</span>
                                        <span class="food-stat-month-value">${figure}</span>
                                    </div>`;
}

/**
 * @param {HTMLElement} container
 * @param {Record<string, { months: Array<object>, farms?: object }>} dataByYear
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

    html += `
            <div class="food-stats-year-section">
                <div class="food-stats-year-header">
                    <h4 class="food-stats-year-title">Année ${year}</h4>
                    <div class="food-stats-year-summary">
                        <span class="food-stat-badge ${monthsWithoutFamine === yearData.months.length ? 'fed' : 'unfed'}">✅ ${monthsWithoutFamine}/${yearData.months.length} mois sans famine</span>
                        ${yearData.farms && yearData.farms.total > 0 ? `<span class="food-stat-farms sold">🌾 Fermes ayant vendu leur récolte : ${farmsSoldHTML(yearData.farms)}</span>` : ''}
                        ${coverage ? `<span class="food-stat-farms coverage">Fermes nécessaires pour nourrir les ${coverage.population} personnes : ${coverage.farmsNeeded}</span><span class="food-stat-farms detail">${coverage.detail}</span>` : ''}
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
                                    ${monthFarmRowHTML(monthData, yearData.farms, coverage)}
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
