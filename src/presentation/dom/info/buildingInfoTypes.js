/**
 * Shared types for building info panel.
 *
 * Règles minimales (pas de sur-architecture) :
 * - `useBuildingInfoSelection` : presenter (I/O ports + orchestration)
 * - `formats/*` : VM → modèle d'affichage, sans DOM
 * - `views/*` + `layout/` : DOM (cadre modal + briques)
 */

/**
 * @typedef {import('./resolveBuildingInfoGroup.js').BuildingInfoGroupId} BuildingInfoGroupId
 */

/**
 * @typedef {'centered' | 'sidebar'} BuildingInfoPanelLayoutMode
 */

/**
 * @typedef {object} BuildingInfoLayoutOptions
 * @property {BuildingInfoPanelLayoutMode} [layout]
 * @property {string | null} [accent]
 * @property {'foyer' | 'building'} [foyerTabLabel]
 * @property {'barn' | 'windmill' | null} [hubOverlayMode]
 */

/**
 * @typedef {object} InfoKvRow
 * @property {string} label
 * @property {string|number} value
 * @property {string} [subtext]
 */

/**
 * @typedef {object} InfoBannerMessage
 * @property {string} text
 * @property {'neutral'|'success'|'warning'|'error'} [variant]
 */

/**
 * @typedef {object} InfoKvSection
 * @property {string} title
 * @property {ReadonlyArray<InfoKvRow>} rows
 * @property {ReadonlyArray<InfoBannerMessage>} [banners]
 */

/**
 * @typedef {object} InfoKvPanelModel
 * @property {ReadonlyArray<InfoKvSection>} sections
 */

/**
 * @typedef {object} BuildingInfoViewModel
 * @property {string} buildingType
 * @property {string | null} uniqueId
 * @property {object | null} buildingRow
 * @property {object} selectedObject
 * @property {number} anchorX
 * @property {number} anchorY
 * @property {string} terrainLabel
 * @property {number} buildingPop
 * @property {object} roadAccess
 * @property {ReadonlyArray<object>} neighborRows
 * @property {object | null} supplyView
 * @property {object | null} stocks
 * @property {1 | 2} houseLevel
 * @property {object | null} lastConsumption
 * @property {object} employment
 * @property {object} supply
 * @property {object} accounting
 * @property {object} construction
 * @property {number} [currentYear]
 * @property {'barn' | 'windmill' | null} [hubKind]
 * @property {object | null} [hubView]
 */

/**
 * @typedef {object} BuildingInfoGroupDefinition
 * @property {(vm: BuildingInfoViewModel) => BuildingInfoLayoutOptions} formatLayoutOptions
 * @property {(vm: BuildingInfoViewModel) => { title?: string, meta?: string, accent?: string | null } | null} formatLayoutHeader
 * @property {(vm: BuildingInfoViewModel) => unknown} formatFoyer
 * @property {(container: HTMLElement, model: unknown) => void | Promise<void>} renderFoyer
 */

/**
 * @param {object} params
 * @returns {BuildingInfoViewModel}
 */
export function createBuildingInfoViewModel(params) {
  const {
    buildingType,
    uniqueId,
    buildingRow,
    selectedObject,
    anchorX,
    anchorY,
    terrainLabel,
    buildingPop,
    roadAccess,
    neighbors,
    supplyView,
    stocks,
    employment,
    supply,
    accounting,
    construction,
  } = params;

  return {
    buildingType,
    uniqueId,
    buildingRow,
    selectedObject,
    anchorX,
    anchorY,
    terrainLabel,
    buildingPop,
    roadAccess,
    neighborRows: (neighbors ?? []).filter((n) => n.x != null && n.y != null),
    supplyView,
    stocks,
    houseLevel: buildingRow?.level === 2 ? 2 : 1,
    lastConsumption: buildingRow?.lastConsumption ?? null,
    employment,
    supply,
    accounting,
    construction,
  };
}
