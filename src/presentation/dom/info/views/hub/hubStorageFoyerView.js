/**
 * Hub storage foyer — interactive storage UI only (staff lives on its own tab).
 */

import { renderHubStorageInfoPanel } from './hubStorageInfoPanel.js';

/**
 * @param {HTMLElement} container
 * @param {object | null} hubParams
 */
export async function renderHubStorageFoyerView(container, hubParams) {
  container.innerHTML = '';
  if (!hubParams) return;
  await renderHubStorageInfoPanel(hubParams);
}
