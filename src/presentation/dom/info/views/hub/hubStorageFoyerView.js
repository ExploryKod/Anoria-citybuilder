/**
 * Hub storage foyer — view (DOM + hub panel delegate).
 */

import { renderHubStorageInfoPanel } from './hubStorageInfoPanel.js';
import { renderKvPanelView } from '../kvPanelView.js';

/**
 * @param {HTMLElement} container
 * @param {{ hubParams: object | null, employees: import('../../buildingInfoTypes.js').InfoKvPanelModel | null }} model
 */
export async function renderHubStorageFoyerView(container, model) {
  container.innerHTML = '';
  if (!model?.hubParams) return;

  await renderHubStorageInfoPanel(model.hubParams);
  renderKvPanelView(container, model.employees);
}
