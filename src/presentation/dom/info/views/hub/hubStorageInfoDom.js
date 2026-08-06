/**
 * DOM helpers for hub storage info overlay extensions.
 */

import { getBuildingInfoBody, setBuildingInfoTitle as setLayoutTitle } from '../../layout/buildingInfoLayout.js';

export function setInfoBuildingTitle(title) {
  setLayoutTitle(title);
}

/**
 * @param {'barn'|'windmill'} hubKind
 */
export function setHubInfoOverlayMode(hubKind) {
  const overlay = document.querySelector('.info-building-overlay');
  if (!overlay) return;
  overlay.classList.remove('info-building-overlay--hub-barn', 'info-building-overlay--hub-windmill');
  overlay.classList.add(
    hubKind === 'windmill' ? 'info-building-overlay--hub-windmill' : 'info-building-overlay--hub-barn'
  );
}

export function clearHubInfoOverlayMode() {
  const overlay = document.querySelector('.info-building-overlay');
  if (!overlay) return;
  overlay.classList.remove('info-building-overlay--hub-barn', 'info-building-overlay--hub-windmill');
}

/** @returns {HTMLElement|null} */
export function getInfoBuildingBody() {
  return getBuildingInfoBody();
}
