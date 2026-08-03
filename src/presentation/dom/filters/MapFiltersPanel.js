/**
 * Toolbar Filtres tab — presentation toggles for map status overlays.
 * Does not belong to a domain BC; wires DOM ↔ scene visibility APIs.
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
  const productionBtn = document.getElementById('filter-production-btn');
  if (!productionBtn) return;

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

  productionBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    const scene = getScene();
    if (!scene?.setProductionIconsVisible) return;
    const next = !(scene.isProductionIconsVisible?.() ?? true);
    scene.setProductionIconsVisible(next);
    syncProductionButton();
  });

  // Scene may boot after toolbar; sync once listeners are attached
  syncProductionButton();
}
