/**
 * FoodTraceabilityPresenter — HTML sections / stats (données déjà calculées).
 */

import { tryResolveBuildingInstanceIdFromRef } from '../../../../shared/building-identity/index.js';
import { getAllCategoriesForRole, getResourceStockShape } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { getResourceCategoryPresentation } from '../../../../composition/supplyCatalog.js';

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
 * @param {HTMLElement} container
 * @param {Record<string, { months: Array<object> }>} dataByYear
 * @param {string|null} selectedYear
 */
export function renderFoodStats(container, dataByYear, selectedYear) {
  const monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];

  const years = Object.keys(dataByYear).sort((a, b) => parseInt(b) - parseInt(a));

  let html = '';

  if (selectedYear === null) {
    let totalFed = 0;
    let totalUnfed = 0;

    years.forEach((year) => {
      const yearData = dataByYear[year];
      yearData.months.forEach((month) => {
        totalFed += month.fedPopulation || 0;
        totalUnfed += month.unfedPopulation || 0;
      });
    });

    const totalPopulation = totalFed + totalUnfed;

    html += `
            <div class="food-stats-summary">
                <h4 class="food-stats-summary-title">📊 Vue Globale (Toutes années)</h4>
                <div class="food-stats-summary-grid">
                    <div class="food-stat-card fed">
                        <div class="food-stat-icon">✅</div>
                        <div class="food-stat-label">Population Nourrie</div>
                        <div class="food-stat-value">${totalFed}</div>
                        <div class="food-stat-unit">citoyens</div>
                    </div>
                    <div class="food-stat-card unfed">
                        <div class="food-stat-icon">⚠️</div>
                        <div class="food-stat-label">Population Non Nourrie</div>
                        <div class="food-stat-value">${totalUnfed}</div>
                        <div class="food-stat-unit">citoyens</div>
                    </div>
                    <div class="food-stat-card total">
                        <div class="food-stat-icon">👥</div>
                        <div class="food-stat-label">Population Totale</div>
                        <div class="food-stat-value">${totalPopulation}</div>
                        <div class="food-stat-unit">citoyens</div>
                    </div>
                </div>
            </div>
        `;
  }

  years.forEach((year) => {
    const yearData = dataByYear[year];
    let yearFed = 0;
    let yearUnfed = 0;

    yearData.months.forEach((month) => {
      yearFed += month.fedPopulation || 0;
      yearUnfed += month.unfedPopulation || 0;
    });

    html += `
            <div class="food-stats-year-section">
                <div class="food-stats-year-header">
                    <h4 class="food-stats-year-title">Année ${year}</h4>
                    <div class="food-stats-year-summary">
                        <span class="food-stat-badge fed">✅ ${yearFed}</span>
                        <span class="food-stat-badge unfed">⚠️ ${yearUnfed}</span>
                        <span class="food-stat-badge total">👥 ${yearFed + yearUnfed}</span>
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
