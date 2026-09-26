/**
 * CarteVillePresenter — codes bâtiments et HTML grille carte ville.
 */

import { TimeManager } from '../../../shared/time/TimeManager.js';
import { getBuildingDefinition } from '../../../shared/building-catalog/buildingCatalog.js';
import { isRoadBuildingType } from '../../../composition/constructionCatalog.js';
import { buildingName, goodLabel, namesOfBuildings } from '../shell/CatalogVocabulary.js';
import {
  getAnnualSupplyEntry,
  getAnnualYieldPerProducer,
  getMapCode,
  getMaxStockOfRole,
  getPerCapitaDemand,
  getResourceRoles,
  getResourceStockShape,
  getSuppliedCategories,
  requiresRoad,
} from '../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * The map code of a type — derived from its catalog name (see getMapCode), never named here.
 * @param {string|null|undefined} type
 * @returns {string}
 */
export function getBuildingCode(type) {
  return getMapCode(type);
}

/**
 * @param {Array<object>|null|undefined} neighbors
 * @returns {string}
 */
export function getNeighborCodes(neighbors) {
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

/** @param {unknown} value @returns {string} Safe inside an HTML attribute or text node. */
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Shown on a field whose stock is empty: not an alarm outside the harvest window. */
const EMPTY_HARVEST_STOCK_NOTE = 'Stock vide (normal entre la vente et la prochaine récolte)';

/**
 * CSS class carrying a type's colour, read from the catalog: a house wears its
 * social group's (`residentialGroup`), any other building its employment
 * sector's (`employment.sector`), and a type with neither the neutral one.
 * The colours themselves live in the stylesheet, one rule per group or sector.
 * @param {string} type
 * @returns {string} A leading-space class, ready to append.
 */
function styleClassOf(type) {
  const definition = getBuildingDefinition(type);
  if (definition?.residentialGroup) return ` group-${escapeHtml(definition.residentialGroup)}`;
  if (definition?.employment?.sector) return ` sector-${escapeHtml(definition.employment.sector)}`;
  return ' sector-none';
}

/** The catalog's name for a type, the raw id when it has none. */
function displayNameOf(type) {
  return buildingName(type);
}

/**
 * Whether a type holds a stock of the goods the supply chain carries and is
 * not merely a hub buffer: a house, a market, a field. Read from the catalog's
 * roles — a service (`flag` consumption) or a hub does not count.
 * @param {string} buildingType
 * @returns {boolean}
 */
function holdsFood(buildingType) {
  const goods = new Set(getResourceStockShape().categories);
  return getResourceRoles(buildingType).some(
    (entry) =>
      entry.role !== 'hub' &&
      entry.role !== 'collector' &&
      entry.consumption !== 'flag' &&
      entry.categories.some((category) => goods.has(category))
  );
}

/**
 * The map buildings with what the supply query does not carry: staff present
 * and needed, and the stock total, taken from the stored building rows.
 * @param {Array<object>} buildings Map buildings (ListSupplyMapBuildings).
 * @param {Array<object>} rows Raw building rows.
 * @param {(sector: number) => string | null} [getSectorName] The employment catalog's sector names.
 * @returns {Array<object>}
 */
export function enrichMapBuildings(buildings, rows, getSectorName = () => null) {
  const rowById = new Map(rows.map((row) => [row.instanceId ?? row.id, row]));
  const { totalKey } = getResourceStockShape();
  return buildings.map((building) => {
    const sector = getBuildingDefinition(building.type)?.employment?.sector;
    const withSector = sector ? { ...building, sectorName: getSectorName(sector) } : building;
    const row = rowById.get(building.id);
    if (!row) return withSector;
    return {
      ...withSector,
      worker: row.employees?.worker ?? null,
      workerNeed: row.employees?.worker_need ?? null,
      stockTotal: row.stocks?.[totalKey] ?? null,
    };
  });
}

/**
 * Tooltip of a map cell, every label taken from the catalog: the building's
 * name, its coordinates, its inhabitants, and its road and stock status.
 * @param {object} building A map building (see ListSupplyMapBuildings).
 * @returns {string}
 */
export function describeMapBuilding(building) {
  const lines = [displayNameOf(building.type), `Case ${building.x},${building.y}`];

  if (building.kind === 'house') {
    lines.push(`Habitants : ${Number(building.pop || 0)}`);
  }

  if (isRoadBuildingType(building.type)) {
    // A road tile has no road need to report
  } else if (!requiresRoad(building.type)) {
    lines.push('Route non requise');
  } else {
    const roadCount = Number(building.roadCount || 0);
    lines.push(roadCount > 0 ? `Routes à portée : ${roadCount}` : 'Pas de route');
  }

  if (building.sectorName) {
    lines.push(`Secteur : ${building.sectorName}`);
  }

  if (building.workerNeed > 0) {
    lines.push(`Travailleurs : ${building.worker ?? 0} / ${building.workerNeed}`);
  }

  if (holdsFood(building.type) && building.stockTotal != null) {
    lines.push(`${goodLabel(getResourceStockShape().totalKey)} en stock : ${building.stockTotal}`);
  }
  if (getAnnualSupplyEntry(building.type) && building.hasFood === false) {
    lines.push(EMPTY_HARVEST_STOCK_NOTE);
  }
  return lines.join('\n');
}

/**
 * The building part of the legend, built from what the map really shows: one
 * row per name the player reads (the catalog's `displayName`) with the code its
 * cells carry. Several names can share a code — each still gets its own row.
 * @param {Array<{ type?: string }>} buildings
 * @returns {string}
 */
export function renderCityMapLegendHtml(buildings) {
  const rows = new Map();
  for (const building of buildings) {
    if (!building.type) continue;
    const name = displayNameOf(building.type);
    rows.set(name, { code: getBuildingCode(building.type), styleClass: styleClassOf(building.type) });
  }

  return [...rows.entries()]
    .sort(([nameA, a], [nameB, b]) => a.code.localeCompare(b.code) || nameA.localeCompare(nameB))
    .map(
      ([name, { code, styleClass }]) =>
        `<div class="legend-item"><span class="legend-code legend-code-small ${escapeHtml(code.toLowerCase())}${styleClass}">${escapeHtml(code)}</span><span class="legend-label">${escapeHtml(name)}</span></div>`
    )
    .join('');
}

/**
 * @param {object} params
 * @param {number} params.citySize
 * @param {Map<string, object>} params.buildingMap
 * @param {(roadCount: unknown) => boolean} params.hasRoadAccessFromCount
 * @returns {string}
 */
export function renderCityMapGridHtml({ citySize, buildingMap, hasRoadAccessFromCount }) {
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

        const isRoad = isRoadBuildingType(building.type);
        const needsRoadAccess = !isRoad && requiresRoad(building.type);

        const hasRoad = needsRoadAccess ? hasRoadAccessFromCount(building.roadCount) : true;

        const canHaveFood = holdsFood(building.type);

        const hasFood = canHaveFood ? building.hasFood === true : true;

        const isHouse = building.kind === 'house';
        const marketTooFar = isHouse ? building.marketTooFar === true : false;

        // Filter group: what the building is, not what it is called
        const category = building.kind === 'house' ? 'houses' : isRoad ? 'infrastructure' : 'services';

        tableHTML += `<td class="grid-cell" data-category="${category}" title="${escapeHtml(describeMapBuilding(building))}">`;

        tableHTML += `<div class="status-indicators">`;
        if (needsRoadAccess && !hasRoad) {
          tableHTML += `<span class="status-indicator no-road" title="Pas de route"></span>`;
        }
        if (isHouse && !hasFood && marketTooFar) {
          tableHTML += `<span class="status-indicator market-too-far" title="${escapeHtml(`${namesOfBuildings('distributor', getSuppliedCategories()).join('/')} trop loin`)}"></span>`;
        } else if (canHaveFood && !hasFood && !marketTooFar) {
          const noFoodTitle = getAnnualSupplyEntry(building.type) ? EMPTY_HARVEST_STOCK_NOTE : `Pas de ${goodLabel(getResourceStockShape().totalKey).toLowerCase()}`;
          tableHTML += `<span class="status-indicator no-food" title="${escapeHtml(noFoodTitle)}"></span>`;
        }
        tableHTML += `</div>`;

        tableHTML += `<span class="building-code ${code.toLowerCase()}${styleClassOf(building.type)}">${code}</span>`;
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
  return tableHTML;
}

/** @returns {string} */
export function renderCityMapLoadingHtml() {
  return `
            <div class="grid-loading">
                <div class="loading-spinner"></div>
                <p>Chargement de la carte...</p>
            </div>
        `;
}

/**
 * @param {Error|unknown} error
 * @returns {string}
 */
export function renderCityMapErrorHtml(error) {
  const message = error?.message || 'Erreur inconnue';
  return `
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
                        ${message}
                    </p>
                </div>
                <button type="button" class="city-map-retry-btn" style="margin-top: 20px; padding: 8px 16px; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;">
                    🔄 Réessayer
                </button>
            </div>
        `;
}

/** Row fields left out of the export: bulky and redundant with the coordinates and footprint. */
const EXPORT_OMITTED_FIELDS = ['neighbors', 'id', 'anchorX', 'anchorY', 'name'];

/**
 * The city as one JSON document, readable without the screen: every building
 * with its whole stored state (population, staff, road, stocks, service
 * coverage, hub links…), the employment and population summaries, the news,
 * and the settings the numbers depend on.
 * @param {object} params
 * @param {Array<object>} params.buildingRows Raw building rows.
 * @param {object|null} params.employmentSummary
 * @param {object|null} params.populationSummary
 * @param {{ incoming: Array<object>, archived: Array<object> }} params.news
 * @param {number|null} params.citySize
 * @param {Record<string, string>} params.errors Sections that could not be read, by name.
 */
export function buildCityExport({ buildingRows, employmentSummary, populationSummary, news, citySize, errors }) {
  const buildings = buildingRows
    .map((row) => {
      const kept = { ...row };
      for (const field of EXPORT_OMITTED_FIELDS) delete kept[field];
      return kept;
    })
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));

  return {
    exportDate: new Date().toISOString(),
    config: {
      citySize,
      daysPerMonth: TimeManager.DAYS_PER_MONTH,
      perCapitaDemand: getPerCapitaDemand(),
      annualYieldPerProducer: getAnnualYieldPerProducer(),
      // The ceiling of the hub of what citizens eat, and of the stall that hands it out: both read from the catalog.
      hubMaxStock: getMaxStockOfRole('hub', getSuppliedCategories()) ?? null,
      distributorMaxStock: getMaxStockOfRole('distributor', getSuppliedCategories()) ?? null,
    },
    omittedBuildingFields: EXPORT_OMITTED_FIELDS,
    buildings,
    employmentSummary,
    populationSummary,
    news,
    unreadableSections: errors,
  };
}
