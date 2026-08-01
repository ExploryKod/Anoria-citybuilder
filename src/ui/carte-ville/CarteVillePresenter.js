/**
 * CarteVillePresenter — codes bâtiments et HTML grille carte ville.
 */

/**
 * @param {string|null|undefined} type
 * @returns {string}
 */
export function getBuildingCode(type) {
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
