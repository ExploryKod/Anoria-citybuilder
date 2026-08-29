import { HAMLET_ACCESS } from '../../../core/persistence/hamlet/hamletAccess.js';

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildHamletsMapView.js').buildHamletsMapView>>} view
 * @param {string | null} selectedHamletId
 */
export function renderHamletsMapStage(view, selectedHamletId) {
  const markers = view.hamlets.map((hamlet) => {
    const isSelected = hamlet.id === selectedHamletId;
    const isActive = hamlet.access === HAMLET_ACCESS.active;
    const isUnlocked = hamlet.access === HAMLET_ACCESS.unlocked;
    const isLocked = hamlet.access === HAMLET_ACCESS.locked;
    const labelAnchor = hamlet.map.labelAnchor ?? 'bottom';
    const tag = isLocked ? 'div' : 'button';
    const attrs = isLocked
      ? ` aria-disabled="true" title="${hamlet.name} — verrouillé"`
      : ` type="button" data-hamlet-id="${hamlet.id}" aria-pressed="${isSelected}" title="${hamlet.name}"`;

    const classes = [
      'hamlets-map-marker',
      isActive ? 'hamlets-map-marker--active' : '',
      isUnlocked ? 'hamlets-map-marker--unlocked' : '',
      isLocked ? 'hamlets-map-marker--locked' : '',
      isSelected ? 'selected' : '',
    ]
      .filter(Boolean)
      .join(' ');

    return `
      <${tag} class="${classes}" style="left:${hamlet.map.x}%;top:${hamlet.map.y}%"${attrs}>
        <span class="hamlets-map-marker-node" aria-hidden="true"></span>
        <span class="hamlets-map-marker-label hamlets-map-marker-label--${labelAnchor}">${hamlet.name}</span>
      </${tag}>`;
  }).join('');

  const influenceRadius = 12 + view.unlockedCount * 2.4;

  return `
    <div class="trade-map-stage hamlets-map-stage">
      <div class="trade-map-world" aria-hidden="true">
        <div class="trade-map-sheet"></div>
        <div class="trade-map-grid-lines"></div>
        <div class="trade-map-compass" aria-hidden="true">
          <span class="trade-map-compass-n">N</span>
          <span class="trade-map-compass-rose"></span>
        </div>
      </div>
      <div class="hamlets-map-influence" style="--hamlets-influence-radius:${influenceRadius}%" aria-hidden="true"></div>
      <div class="trade-map-layer hamlets-map-layer">
        ${markers}
      </div>
    </div>`;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildHamletsMapView.js').buildHamletsMapView>>} view
 * @param {string | null} selectedHamletId
 */
export function renderHamletsMapPanel(view, selectedHamletId) {
  const hamlet = view.hamlets.find((item) => item.id === selectedHamletId);
  if (!hamlet) {
    return `
      <div class="trade-map-panel-empty">
        <p>Sélectionnez un hameau sur la carte</p>
      </div>`;
  }

  let statusText = 'Verrouillé';
  let statusClass = 'closed';
  let actionHtml = '<p class="trade-map-panel-active-note">Ce hameau n’est pas encore accessible.</p>';

  if (hamlet.access === HAMLET_ACCESS.active) {
    statusText = 'Hameau actif';
    statusClass = 'open';
    actionHtml = `
      <a href="/game" class="site-btn site-btn--primary site-btn--inline hamlets-map-enter-btn">
        Entrer dans le hameau
      </a>`;
  } else if (hamlet.access === HAMLET_ACCESS.unlocked) {
    statusText = 'Accessible';
    statusClass = 'open';
    actionHtml = `
      <button type="button" class="site-btn site-btn--primary site-btn--inline hamlets-map-travel-btn" data-hamlet-id="${hamlet.id}">
        Voyager vers ce hameau
      </button>`;
  }

  return `
    <div class="trade-map-panel-inner" data-hamlet-id="${hamlet.id}">
      <div class="trade-map-panel-header">
        <div class="trade-map-panel-title-group">
          <h3 class="trade-map-panel-city">${hamlet.name}</h3>
        </div>
        <span class="trade-map-panel-route ${statusClass}">${statusText}</span>
      </div>
      <p class="trade-map-panel-desc">
        ${hamlet.natureSeeded ? 'Nature déjà semée sur ce site.' : 'Site encore vierge — la nature sera générée au premier voyage.'}
      </p>
      ${actionHtml}
    </div>`;
}

/**
 * @param {Awaited<ReturnType<import('../../../contexts/geography/application/queries/buildHamletsMapView.js').buildHamletsMapView>>} view
 * @param {string | null} selectedHamletId
 */
export function renderHamletsMapPage(view, selectedHamletId) {
  const selected = selectedHamletId ?? view.activeHamletId;

  return `
    <div class="map-page-toolbar trade-map-toolbar">
      <span class="trade-map-toolbar-title">Carte du royaume</span>
      <span class="trade-map-toolbar-stats">${view.unlockedCount}/${view.totalHamlets} hameaux accessibles</span>
      <nav class="map-page-nav" aria-label="Navigation cartes">
        <a href="/world" class="map-page-nav-link">Monde</a>
        <a href="/game" class="map-page-nav-link">Partie</a>
      </nav>
    </div>
    <div class="map-page-body">
      <div class="map-page-canvas trade-map-canvas" id="hamlets-map-canvas">
        ${renderHamletsMapStage(view, selected)}
      </div>
      <div class="map-page-panel trade-map-panel" id="hamlets-map-panel">
        ${renderHamletsMapPanel(view, selected)}
      </div>
    </div>`;
}
