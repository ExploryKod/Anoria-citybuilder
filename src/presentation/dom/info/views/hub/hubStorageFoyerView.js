/**
 * Hub storage tabs — interactive storage UI only (staff lives on its own tab).
 */

import { renderHubStorageInfoPanel, renderHubStorageOrdersPanel } from './hubStorageInfoPanel.js';

/**
 * The Stockage tab.
 * @param {HTMLElement} container
 * @param {object | null} hubParams
 */
export async function renderHubStorageFoyerView(container, hubParams) {
  container.innerHTML = '';
  if (!hubParams) return;
  await renderHubStorageInfoPanel({ ...hubParams, container });
}

/**
 * The Ordres tab.
 * @param {HTMLElement} container
 * @param {object | null} hubParams
 */
export async function renderHubStorageOrdersView(container, hubParams) {
  container.innerHTML = '';
  if (!hubParams) return;
  await renderHubStorageOrdersPanel({ ...hubParams, container });
}
