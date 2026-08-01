import { getGameCity, getPopupManager, registerAppFunction } from '../../acl/appRuntime.js';
import { hasRoadAccessFromCount } from '../../acl/parcels.js';
import { listSupplyMapBuildings } from '../../acl/supply.js';

let cityMapFiltersInitialized = false;
let cityMapLegendInitialized = false;

function applyCityMapFilter(filter) {
  const grid = document.getElementById('city-map-grid');
  if (!grid) return;
  const cells = grid.querySelectorAll('.grid-cell');
  cells.forEach((cell) => {
    const cat = cell.getAttribute('data-category') || 'other';
    if (filter === 'all' || filter === cat) {
      cell.classList.remove('filtered-hidden');
    } else {
      cell.classList.add('filtered-hidden');
    }
  });
}

function initCityMapFilters() {
  if (cityMapFiltersInitialized) {
    const filterBar = document.querySelector('.city-map-filters');
    const activeBtn = filterBar?.querySelector('.filter-btn.active');
    const current = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
    applyCityMapFilter(current);
    return;
  }
  cityMapFiltersInitialized = true;

  const filterBar = document.querySelector('.city-map-filters');
  if (!filterBar) return;
  const btns = filterBar.querySelectorAll('.filter-btn');
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.getAttribute('data-filter') || 'all';
      applyCityMapFilter(filter);
    });
  });
  const activeBtn = filterBar.querySelector('.filter-btn.active');
  const current = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
  applyCityMapFilter(current);

  const neighborsBtn = filterBar.querySelector('.neighbors-btn');
  const grid = document.getElementById('city-map-grid');
  if (neighborsBtn && grid) {
    if (!neighborsBtn.classList.contains('active')) {
      grid.classList.add('hide-neighbors');
    }
    neighborsBtn.addEventListener('click', () => {
      const willBeActive = !neighborsBtn.classList.contains('active');
      neighborsBtn.classList.toggle('active', willBeActive);
      if (willBeActive) {
        grid.classList.remove('hide-neighbors');
      } else {
        grid.classList.add('hide-neighbors');
      }
    });
  }
}

function getBuildingCode(type) {
  if (!type) return '';
  if (type.includes('House-Blue')) return 'HB';
  if (type.includes('House-Red')) return 'HR';
  if (type.includes('House-Purple')) return 'HP';
  if (type.includes('House-2Story') || type.includes('House_2Story')) return 'H2S';
  if (type.includes('Market')) return 'M';
  if (type.includes('Farm')) return 'F';
  if (type.includes('Windmill')) return 'WM';
  if (type.includes('Barn')) return 'BA';
  if (type.includes('Church')) return 'CH';
  if (type.includes('Well')) return 'WE';
  if (type.includes('Fountain')) return 'FO';
  if (type.includes('Tombstone') || type.includes('Tomb')) return 'TO';
  if (type.includes('roads')) return 'R';
  if (type.includes('Road')) return 'R';
  return type.charAt(0).toUpperCase();
}

function getNeighborCodes(neighbors) {
  if (!neighbors || !Array.isArray(neighbors) || neighbors.length === 0) {
    return '';
  }

  return neighbors
    .map((neighbor) => {
      const typeLike = neighbor.type || neighbor.name || '';
      const code = getBuildingCode(typeLike);
      if (neighbor.x !== undefined && neighbor.y !== undefined) {
        return `${code}(${neighbor.x},${neighbor.y})`;
      }
      return code;
    })
    .join(' ');
}

export async function generateCityMap() {
  const cityMapGrid = document.getElementById('city-map-grid');
  if (!cityMapGrid) return;

  try {
    cityMapGrid.innerHTML = `
            <div class="grid-loading">
                <div class="loading-spinner"></div>
                <p>Chargement de la carte...</p>
            </div>
        `;

    let citySize = 16;
    const city = getGameCity();
    if (city?.size) {
      citySize = city.size;
    }

    let buildings = [];
    try {
      buildings = await listSupplyMapBuildings();
    } catch (error) {
      console.warn('Could not load Supply map buildings:', error);
      buildings = [];
    }

    const buildingMap = new Map();
    buildings.forEach((building) => {
      if (
        building.x !== undefined &&
        building.y !== undefined &&
        building.x != null &&
        building.y != null
      ) {
        const key = `${building.x},${building.y}`;
        buildingMap.set(key, building);
      }
    });

    let tableHTML = '<table class="city-grid-table"><thead><tr>';
    tableHTML +=
      '<th class="coord-label-cell"><span class="coord-label-x">X ↕</span><span class="coord-label-y">↔ Y</span></th>';

    for (let y = 0; y < citySize; y++) {
      tableHTML += `<th class="y-header">${y}</th>`;
    }
    tableHTML += '</tr></thead><tbody>';

    for (let x = 0; x < citySize; x++) {
      tableHTML += `<tr><th class="x-header">${x}</th>`;

      for (let y = 0; y < citySize; y++) {
        const key = `${x},${y}`;
        const building = buildingMap.get(key);

        if (building) {
          const code = getBuildingCode(building.type);
          const neighbors = building.neighbors || [];
          const neighborCodes = getNeighborCodes(neighbors);

          const isRoad = building.type.includes('roads') || building.type.includes('Road');
          const needsRoadAccess = !isRoad;

          const hasRoad = needsRoadAccess ? hasRoadAccessFromCount(building.roadCount) : true;

          const canHaveFood =
            building.type.includes('House') ||
            building.type.includes('Market') ||
            building.type.includes('Farm');

          const hasFood = canHaveFood ? building.hasFood === true : true;

          const isHouse = building.kind === 'house';
          const marketTooFar = isHouse ? building.marketTooFar === true : false;

          let category = 'services';
          if (building.type && (building.type.includes('House') || building.type.includes('Palace'))) {
            category = 'houses';
          } else if (
            building.type &&
            (building.type.includes('roads') || building.type.includes('Road'))
          ) {
            category = 'infrastructure';
          } else if (
            building.type &&
            (building.type.includes('Well') || building.type.includes('Church'))
          ) {
            category = 'services';
          } else if (
            building.type &&
            (building.type.includes('Market') || building.type.includes('Farm'))
          ) {
            category = 'services';
          }

          tableHTML += `<td class="grid-cell" data-category="${category}">`;

          tableHTML += `<div class="status-indicators">`;
          if (needsRoadAccess && !hasRoad) {
            tableHTML += `<span class="status-indicator no-road" title="Pas de route"></span>`;
          }
          if (isHouse && !hasFood && marketTooFar) {
            tableHTML += `<span class="status-indicator market-too-far" title="Marché trop loin"></span>`;
          } else if (canHaveFood && !hasFood && !marketTooFar) {
            tableHTML += `<span class="status-indicator no-food" title="Pas de nourriture"></span>`;
          }
          tableHTML += `</div>`;

          tableHTML += `<span class="building-code ${code.toLowerCase()}">${code}</span>`;
          if (neighborCodes) {
            tableHTML += `<div class="neighbors-list">${neighborCodes}</div>`;
          }
          if (category === 'houses') {
            const habitants = Number(building.pop || 0);
            tableHTML += `<div class="habitants-count" title="Habitants">${habitants}</div>`;
          }
          tableHTML += `</td>`;
        } else {
          tableHTML += `<td class="grid-cell empty-cell" data-category="infrastructure"> 
                        <span class="building-code grass" style="opacity: 0.3;">G</span>
                    </td>`;
        }
      }

      tableHTML += '</tr>';
    }

    tableHTML += '</tbody></table>';

    cityMapGrid.innerHTML = tableHTML;
  } catch (error) {
    console.error('Error generating city map:', error);
    cityMapGrid.innerHTML = `
            <div class="grid-loading">
                <p style="font-size: 1.2rem; margin-bottom: 10px;">⚠️ Impossible de charger la carte</p>
                <p style="font-size: 0.9rem; color: #cbd5e1; margin-bottom: 20px;">
                    Une erreur s'est produite lors du chargement de la carte de votre ville
                </p>
                <div style="background: rgba(239, 68, 68, 0.1); padding: 15px; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); max-width: 400px;">
                    <p style="color: #fca5a5; font-size: 0.85rem; margin: 0 0 10px 0;">
                        <strong>Détails de l'erreur:</strong>
                    </p>
                    <p style="color: #fca5a5; font-size: 0.75rem; margin: 0; font-family: monospace;">
                        ${error.message || 'Erreur inconnue'}
                    </p>
                </div>
                <button type="button" class="city-map-retry-btn" style="margin-top: 20px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                    🔄 Réessayer
                </button>
            </div>
        `;
    cityMapGrid.querySelector('.city-map-retry-btn')?.addEventListener('click', () => {
      void generateCityMap();
    });
  }
}

export function initCityMapPopup() {
  const cityMapBtn = document.getElementById('city-map-btn');
  const cityMapPanel = document.getElementById('city-map-panel');
  const cityMapCloseBtn = document.querySelector('.city-map-close-btn');

  if (!cityMapBtn || !cityMapPanel || !cityMapCloseBtn) {
    console.warn('City map popup elements not found');
    return;
  }

  function initCollapsibleLegend() {
    if (cityMapLegendInitialized) return;
    cityMapLegendInitialized = true;

    const legendToggle = document.querySelector('.legend-toggle');
    const legend = document.querySelector('.city-map-legend');

    if (legendToggle && legend) {
      legendToggle.addEventListener('click', () => {
        legend.classList.toggle('collapsed');
      });
    }
  }

  cityMapBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    e.preventDefault();

    cityMapPanel.classList.toggle('active');

    if (cityMapPanel.classList.contains('active')) {
      if (getPopupManager()) {
        getPopupManager().forceOpenPopup('city-map-panel');
      }
      await generateCityMap();
      setTimeout(initCollapsibleLegend, 100);
      initCityMapFilters();
    } else if (getPopupManager()) {
      getPopupManager().forceClosePopup('city-map-panel');
    }
  });

  cityMapCloseBtn.addEventListener('click', () => {
    cityMapPanel.classList.remove('active');
    if (getPopupManager()) {
      getPopupManager().forceClosePopup('city-map-panel');
    }
  });

  cityMapPanel.addEventListener('click', (e) => {
    if (e.target === cityMapPanel) {
      cityMapPanel.classList.remove('active');
      if (getPopupManager()) {
        getPopupManager().forceClosePopup('city-map-panel');
      }
    }
  });
}

registerAppFunction('generateCityMap', generateCityMap);
