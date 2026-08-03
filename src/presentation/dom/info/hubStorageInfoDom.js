/**
 * DOM helpers for hub storage info overlay extensions.
 */

export function setInfoBuildingTitle(title) {
  const heading = document.querySelector('.info-building-overlay .info-building__header h2');
  if (heading) {
    heading.textContent = title;
  }
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
  return document.querySelector('.info-building__body');
}
