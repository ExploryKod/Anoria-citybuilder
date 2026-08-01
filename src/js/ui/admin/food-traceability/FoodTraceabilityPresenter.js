/**
 * FoodTraceabilityPresenter — HTML sections / stats (données déjà calculées).
 */

import { tryResolveBuildingInstanceIdFromRef } from '../../../acl/building-identity.js';

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
  const foodTypeLabels = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou' };
  const transactionDetails = Object.entries(byFoodType)
    .map(([foodType, quantity]) => {
      const label = foodTypeLabels[foodType] || foodType;
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
                                    ${farmStocksBefore.wheat > 0 ? `<div>Blé: ${farmStocksBefore.wheat}</div>` : ''}
                                    ${farmStocksBefore.carrot > 0 ? `<div>Carotte: ${farmStocksBefore.carrot}</div>` : ''}
                                    ${farmStocksBefore.cabbage > 0 ? `<div>Chou: ${farmStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${farmStocksBefore.food || 0}</div>
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
                                    ${marketStocksBefore.wheat > 0 ? `<div>Blé: ${marketStocksBefore.wheat}</div>` : ''}
                                    ${marketStocksBefore.carrot > 0 ? `<div>Carotte: ${marketStocksBefore.carrot}</div>` : ''}
                                    ${marketStocksBefore.cabbage > 0 ? `<div>Chou: ${marketStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksBefore.food || 0}</div>
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
                                    ${farmStocksAfter.wheat > 0 ? `<div>Blé: ${farmStocksAfter.wheat}</div>` : ''}
                                    ${farmStocksAfter.carrot > 0 ? `<div>Carotte: ${farmStocksAfter.carrot}</div>` : ''}
                                    ${farmStocksAfter.cabbage > 0 ? `<div>Chou: ${farmStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${farmStocksAfter.food || 0}</div>
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
                                    ${marketStocksAfter.wheat > 0 ? `<div>Blé: ${marketStocksAfter.wheat}</div>` : ''}
                                    ${marketStocksAfter.carrot > 0 ? `<div>Carotte: ${marketStocksAfter.carrot}</div>` : ''}
                                    ${marketStocksAfter.cabbage > 0 ? `<div>Chou: ${marketStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksAfter.food || 0}</div>
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
  const foodTypeLabels = { wheat: 'Blé', carrot: 'Carotte', cabbage: 'Chou' };
  const transactionDetails = Object.entries(byFoodType)
    .map(([foodType, quantity]) => {
      const label = foodTypeLabels[foodType] || foodType;
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
                                    ${marketStocksBefore.wheat > 0 ? `<div>Blé: ${marketStocksBefore.wheat}</div>` : ''}
                                    ${marketStocksBefore.carrot > 0 ? `<div>Carotte: ${marketStocksBefore.carrot}</div>` : ''}
                                    ${marketStocksBefore.cabbage > 0 ? `<div>Chou: ${marketStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksBefore.food || 0}</div>
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
                                    ${houseStocksBefore.wheat > 0 ? `<div>Blé: ${houseStocksBefore.wheat}</div>` : ''}
                                    ${houseStocksBefore.carrot > 0 ? `<div>Carotte: ${houseStocksBefore.carrot}</div>` : ''}
                                    ${houseStocksBefore.cabbage > 0 ? `<div>Chou: ${houseStocksBefore.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${houseStocksBefore.food || 0}</div>
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
                                    ${marketStocksAfter.wheat > 0 ? `<div>Blé: ${marketStocksAfter.wheat}</div>` : ''}
                                    ${marketStocksAfter.carrot > 0 ? `<div>Carotte: ${marketStocksAfter.carrot}</div>` : ''}
                                    ${marketStocksAfter.cabbage > 0 ? `<div>Chou: ${marketStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${marketStocksAfter.food || 0}</div>
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
                                    ${houseStocksAfter.wheat > 0 ? `<div>Blé: ${houseStocksAfter.wheat}</div>` : ''}
                                    ${houseStocksAfter.carrot > 0 ? `<div>Carotte: ${houseStocksAfter.carrot}</div>` : ''}
                                    ${houseStocksAfter.cabbage > 0 ? `<div>Chou: ${houseStocksAfter.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${houseStocksAfter.food || 0}</div>
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
                                    ${stocks.wheat > 0 ? `<div>Blé: ${stocks.wheat}</div>` : ''}
                                    ${stocks.carrot > 0 ? `<div>Carotte: ${stocks.carrot}</div>` : ''}
                                    ${stocks.cabbage > 0 ? `<div>Chou: ${stocks.cabbage}</div>` : ''}
                                    <div class="food-traceability-stocks-total">Total: ${stocks.food || 0}</div>
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
