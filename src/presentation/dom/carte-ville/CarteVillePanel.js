/**
 * CarteVillePanel — popup carte ville (init, filtres, légende, fetch).
 * Rendu grille : CarteVillePresenter.js
 */

import {
  renderCityMapGridHtml,
  renderCityMapLoadingHtml,
  renderCityMapErrorHtml,
  buildCityExport,
  renderCityMapLegendHtml,
  enrichMapBuildings,
} from './CarteVillePresenter.js';
import { createModalFocusSession } from '../shell/modalFocus.js';

/**
 * @type {{
 *   supply: object,
 *   parcels: object,
 *   popupManager?: object | null,
 *   getCity?: () => { size?: number } | null,
 * } | null}
 */
let deps = null;

let carteVilleFiltersInitialized = false;
let carteVilleLegendInitialized = false;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let cityMapFocusSession = null;

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

function initCarteVilleFilters() {
  if (carteVilleFiltersInitialized) {
    const filterBar = document.querySelector('.city-map-filters');
    const activeBtn = filterBar?.querySelector('.filter-btn.active');
    const current = activeBtn ? activeBtn.getAttribute('data-filter') : 'all';
    applyCityMapFilter(current);
    return;
  }
  carteVilleFiltersInitialized = true;

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

export async function generateCarteVille() {
  if (!deps?.supply || !deps?.parcels) {
    console.warn('[CarteVillePanel] deps not initialized');
    return;
  }

  const { supply, parcels, getCity } = deps;
  const cityMapGrid = document.getElementById('city-map-grid');
  if (!cityMapGrid) return;

  try {
    cityMapGrid.innerHTML = renderCityMapLoadingHtml();

    let citySize = 16;
    const city = getCity?.();
    if (city?.size) {
      citySize = city.size;
    }

    let buildings = [];
    try {
      buildings = await supply.listSupplyMapBuildings();
    } catch (error) {
      console.warn('Could not load Supply map buildings:', error);
      buildings = [];
    }

    // Staff and stock live on the stored rows, not in the supply map query
    try {
      buildings = enrichMapBuildings(
        buildings,
        await deps.construction.listAllBuildingRows(),
        (sector) => deps.employment?.getSectorName?.(sector) ?? null
      );
    } catch (error) {
      console.warn('Could not enrich map buildings:', error);
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

    cityMapGrid.innerHTML = renderCityMapGridHtml({
      citySize,
      buildingMap,
      hasRoadAccessFromCount: (...args) => parcels.hasRoadAccessFromCount(...args),
    });

    // The legend lists what the map shows, named by the catalog (the status dots stay static)
    const legendBuildings = document.getElementById('city-map-legend-buildings');
    if (legendBuildings) legendBuildings.innerHTML = renderCityMapLegendHtml(buildings);
  } catch (error) {
    console.error('Error generating city map:', error);
    cityMapGrid.innerHTML = renderCityMapErrorHtml(error);
    cityMapGrid.querySelector('.city-map-retry-btn')?.addEventListener('click', () => {
      void generateCarteVille();
    });
  }
}

/** Day plus time of day (2026-09-20-163045), so several exports never overwrite each other. */
function exportStamp() {
  const now = new Date();
  return `${now.toISOString().split('T')[0]}-${now.toTimeString().slice(0, 8).replace(/:/g, '')}`;
}

/**
 * Downloads the whole city state as JSON. A section that cannot be read is
 * reported in the file instead of failing the export.
 */
async function exportCityToJSON() {
  const errors = {};
  const read = async (name, load, fallback) => {
    try {
      return await load();
    } catch (error) {
      errors[name] = error?.message ?? String(error);
      return fallback;
    }
  };

  const payload = buildCityExport({
    buildingRows: await read('buildings', () => deps.construction.listAllBuildingRows(), []),
    employmentSummary: await read('employmentSummary', () => deps.employment.getCityEmploymentSummary(), null),
    populationSummary: await read('populationSummary', () => deps.housing.getCityPopulationSummary(), null),
    news: {
      incoming: await read('incomingNews', () => deps.intelligence.listIncomingNews(), []),
      archived: await read('archivedNews', () => deps.intelligence.listArchivedNews(), []),
    },
    citySize: deps.getCity?.()?.size ?? null,
    errors,
  });

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `city-${exportStamp()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * @param {{
 *   supply: object,
 *   parcels: object,
 *   construction?: object,
 *   housing?: object,
 *   employment?: object,
 *   intelligence?: object,
 *   popupManager?: object | null,
 *   getCity?: () => { size?: number } | null,
 * }} panelDeps
 */
export function initCarteVillePopup(panelDeps) {
  deps = panelDeps;
  const { popupManager } = deps;

  const cityMapBtn = document.getElementById('city-map-btn');
  const cityMapPanel = document.getElementById('city-map-panel');
  const cityMapCloseBtn = document.querySelector('.city-map-close-btn');

  if (!cityMapBtn || !cityMapPanel || !cityMapCloseBtn) {
    console.warn('City map popup elements not found');
    return;
  }

  function initCollapsibleLegend() {
    if (carteVilleLegendInitialized) return;
    carteVilleLegendInitialized = true;

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
      popupManager?.forceOpenPopup('city-map-panel');
      cityMapFocusSession?.release({ restoreFocus: false });
      cityMapFocusSession = createModalFocusSession({
        panel: cityMapPanel,
        onEscape: closeCityMap,
        initialFocus: '.city-map-close-btn',
      });
      await generateCarteVille();
      setTimeout(initCollapsibleLegend, 100);
      initCarteVilleFilters();
    } else {
      closeCityMap();
    }
  });

  function closeCityMap() {
    cityMapFocusSession?.release();
    cityMapFocusSession = null;
    cityMapPanel.classList.remove('active');
    popupManager?.forceClosePopup('city-map-panel');
  }

  cityMapCloseBtn.addEventListener('click', () => {
    closeCityMap();
  });

  document.getElementById('city-map-export-btn')?.addEventListener('click', () => {
    exportCityToJSON().catch((error) => {
      console.error('[CarteVille] Error exporting the city:', error);
      alert("Erreur lors de l'export de la ville: " + error.message);
    });
  });

  cityMapPanel.addEventListener('click', (e) => {
    if (e.target === cityMapPanel) {
      closeCityMap();
    }
  });
}
