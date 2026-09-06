/**
 * Catalog of building-info tabs (presentation).
 * Groups declare which of these tabs they expose — never show all by default.
 */

/** @typedef {keyof typeof BUILDING_INFO_TAB_IDS} BuildingInfoTabId */

export const BUILDING_INFO_TAB_IDS = Object.freeze({
  foyer: 'foyer',
  diet: 'diet',
  stocks: 'stocks',
  trade: 'trade',
  staff: 'staff',
  services: 'services',
  neighbors: 'neighbors',
  messages: 'messages',
});

/** Default labels — groups may override per tab. */
export const BUILDING_INFO_TAB_LABELS = Object.freeze({
  [BUILDING_INFO_TAB_IDS.foyer]: '🏠 Bâtiment',
  [BUILDING_INFO_TAB_IDS.diet]: '🍽️ Régime',
  [BUILDING_INFO_TAB_IDS.stocks]: '📦 Stocks',
  [BUILDING_INFO_TAB_IDS.trade]: '💰 Ventes',
  [BUILDING_INFO_TAB_IDS.staff]: '👷 Personnel',
  [BUILDING_INFO_TAB_IDS.services]: '🔧 Services',
  [BUILDING_INFO_TAB_IDS.neighbors]: '🏘️ Voisins',
  [BUILDING_INFO_TAB_IDS.messages]: '💬 Messages',
});

/** All known tab ids (stable order for DOM sync). */
export const BUILDING_INFO_TAB_ORDER = Object.freeze([
  BUILDING_INFO_TAB_IDS.foyer,
  BUILDING_INFO_TAB_IDS.diet,
  BUILDING_INFO_TAB_IDS.stocks,
  BUILDING_INFO_TAB_IDS.trade,
  BUILDING_INFO_TAB_IDS.staff,
  BUILDING_INFO_TAB_IDS.services,
  BUILDING_INFO_TAB_IDS.neighbors,
  BUILDING_INFO_TAB_IDS.messages,
]);

/**
 * @param {string} tabId
 * @param {string} [overrideLabel]
 * @returns {string}
 */
export function resolveBuildingInfoTabLabel(tabId, overrideLabel) {
  if (overrideLabel) return overrideLabel;
  return BUILDING_INFO_TAB_LABELS[tabId] ?? tabId;
}
