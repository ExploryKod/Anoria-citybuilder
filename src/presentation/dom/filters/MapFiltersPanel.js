/**
 * Map filters flyout — presentation toggles for map status overlays.
 * Opener on the right rail; selectable filter icons in a sibling column. Each filter button (`data-map-filter="<id>"`, an id of MAP_FILTERS) is its own
 * switch: any of them can be on at once, and one that is on is coloured.
 */

/**
 * @param {{
 *   getScene?: () => {
 *     setMapFilterOn?: (filterId: string, on: boolean) => void,
 *     isMapFilterOn?: (filterId: string) => boolean,
 *   } | null,
 * }} [deps]
 */
export function initMapFiltersPanel(deps = {}) {
  const { getScene = () => null } = deps;
  const openBtn = document.getElementById('map-filters-btn');
  const column = document.getElementById('map-filters-column');
  const filterButtons = [...(column?.querySelectorAll('[data-map-filter]') ?? [])];

  if (!openBtn || !column || filterButtons.length === 0) return;

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
        filterButtons[0].focus();
      });
      return;
    }

    if (restoreFocus) {
      openBtn.focus();
    }
  }

  /** @param {HTMLElement} button */
  function syncFilterButton(button) {
    const scene = getScene();
    const filterId = button.dataset.mapFilter;
    const on = scene?.isMapFilterOn ? scene.isMapFilterOn(filterId) : true;
    const label = button.dataset.label;
    button.classList.toggle('active', on);
    button.setAttribute('aria-pressed', on ? 'true' : 'false');
    button.title = on ? `${label} : affichées (cliquer pour masquer)` : `${label} : masquées (cliquer pour afficher)`;
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

  for (const button of filterButtons) {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const scene = getScene();
      if (!scene?.setMapFilterOn) return;
      const filterId = button.dataset.mapFilter;
      scene.setMapFilterOn(filterId, !scene.isMapFilterOn(filterId));
      syncFilterButton(button);
    });
  }

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

  filterButtons.forEach(syncFilterButton);
}
