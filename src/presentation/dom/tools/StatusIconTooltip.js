import { unresolvedTerm } from '../shell/CatalogVocabulary.js';

/**
 * What each status icon over a building means, said when the cursor is over the building. The sprite names are the ones the scene gives them (see
 * MAP_FILTERS, MapOverlayVisibility.js, and the road and no-work sprites). An icon this table does not know shows "…" with a one-time warning.
 */
const MEANINGS = Object.freeze({
  'no-road': 'Sans route : aucun accès à une route',
  'no-work': 'Sans travailleurs : le bâtiment est à l’arrêt',
  'no-resource': 'Plus de ressource naturelle à portée',
  'input-shortage': 'Matière manquante : une activité attend ce qu’il lui faut',
  'failed-sell': 'Vente ratée : des produits sont restés invendus',
  'hub-full': 'Stock plein : plus de place pour de nouveaux produits',
  fallow: 'Jachère',
  'grow-food': 'Cultures en croissance',
  harvest: 'Récolte',
  'sell-food': 'Vente de la récolte ouverte',
  isBuying: 'Achète des produits',
  isCollecting: 'Collecte la récolte',
  'sold-to-hub': 'Récolte vendue à un entrepôt',
});

/** Gap between the cursor and the tooltip, in pixels. */
const OFFSET = 14;

/** @type {HTMLElement | null} */
let tooltipEl = null;

function tooltip() {
  if (tooltipEl) return tooltipEl;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'status-icon-tooltip';
  tooltipEl.setAttribute('role', 'tooltip');
  tooltipEl.hidden = true;
  document.body.append(tooltipEl);
  // The scene only reports hovers over the map: once the pointer is on anything else (the info modal that a click on the
  // building opens, a panel, the toolbar) or a press happens, no hover will come to hide it, so it would stay frozen.
  document.addEventListener('pointermove', (event) => {
    if (!(event.target instanceof HTMLCanvasElement)) tooltipEl.hidden = true;
  });
  document.addEventListener('pointerdown', () => {
    tooltipEl.hidden = true;
  }, true);
  return tooltipEl;
}

/**
 * Shows what the icons over the hovered building mean, next to the cursor; hides the tooltip when there are none.
 * @param {string[]} spriteNames the status icons showing on the building under the cursor
 * @param {number} clientX
 * @param {number} clientY
 */
export function updateStatusIconTooltip(spriteNames, clientX, clientY) {
  const element = tooltip();
  if (spriteNames.length === 0) {
    element.hidden = true;
    return;
  }
  element.replaceChildren(
    ...spriteNames.map((name) => {
      const line = document.createElement('div');
      line.textContent = MEANINGS[name] ?? unresolvedTerm('status icon meaning', name);
      return line;
    })
  );
  element.hidden = false;
  // Beside the cursor, and back inside the screen when it would run past the right or the bottom edge.
  const { width, height } = element.getBoundingClientRect();
  element.style.left = `${Math.max(0, Math.min(clientX + OFFSET, window.innerWidth - width - 4))}px`;
  element.style.top = `${Math.max(0, Math.min(clientY + OFFSET, window.innerHeight - height - 4))}px`;
}
