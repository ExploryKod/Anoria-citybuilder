/**
 * Shared KV panel — view only (DOM).
 */

import {
  makeInfoBuildingText,
  makeInfoKeyValue,
  makeInfoSection,
} from '../layout/buildingInfoDom.js';

/**
 * @param {HTMLElement} container
 * @param {import('../../buildingInfoTypes.js').InfoKvPanelModel | null} model
 */
export function renderKvPanelView(container, model) {
  if (!model?.sections?.length) return;

  for (const section of model.sections) {
    makeInfoSection(section.title);
    for (const row of section.rows) {
      makeInfoKeyValue(row.label, row.value, row.subtext ?? null);
    }
    for (const banner of section.banners ?? []) {
      makeInfoBuildingText(banner.text, false, banner.variant ?? 'neutral');
    }
  }
}
