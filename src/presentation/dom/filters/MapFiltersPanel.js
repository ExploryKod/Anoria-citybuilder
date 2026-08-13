/**
 * Map filters flyout — presentation toggles for map status overlays.
 * Opener on the right rail; selectable filter icons in a sibling column.
 */

/**
 * @param {{
 *   getScene?: () => {
 *     setProductionIconsVisible?: (visible: boolean) => void,
 *     isProductionIconsVisible?: () => boolean,
 *   } | null,
 * }} [deps]
 */
export function initMapFiltersPanel(deps = {}) {
  const { getScene = () => null } = deps;
  const openBtn = document.getElementById('map-filters-btn');
  const column = document.getElementById('map-filters-column');
  const productionBtn = document.getElementById('filter-production-btn');

  if (!openBtn || !column || !productionBtn) return;

  function isOpen() {
    return column.classList.contains('is-open');
  }

  /**
   * @param {boolean} open
   * @param {{ restoreFocus?: boolean }} [options]
   */
  function setOpen(open, { restoreFocus = true } = {}) {
    column.hidden = !open;
    column.classList.toggle('is-open', open);
    column.setAttribute('aria-hidden', open ? 'false' : 'true');
    openBtn.classList.toggle('active', open);
    openBtn.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open) {
      requestAnimationFrame(() => {
        productionBtn.focus();
      });
      return;
    }

    if (restoreFocus) {
      openBtn.focus();
    }
  }

  function syncProductionButton() {
    const scene = getScene();
    const visible = scene?.isProductionIconsVisible
      ? scene.isProductionIconsVisible()
      : true;
    productionBtn.classList.toggle('active', visible);
    productionBtn.setAttribute('aria-pressed', visible ? 'true' : 'false');
    productionBtn.title = visible
      ? 'Icônes de production : visibles (cliquer pour masquer)'
      : 'Icônes de production : masquées (cliquer pour afficher)';
  }

  openBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (isOpen()) {
      setOpen(false, { restoreFocus: false });
    } else {
      setOpen(true);
    }
  });

  productionBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const scene = getScene();
    if (!scene?.setProductionIconsVisible) return;
    const next = !(scene.isProductionIconsVisible?.() ?? true);
    scene.setProductionIconsVisible(next);
    syncProductionButton();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !isOpen()) return;
    setOpen(false);
    event.preventDefault();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!isOpen()) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (column.contains(target) || openBtn.contains(target)) return;
    setOpen(false);
  });

  syncProductionButton();
}
