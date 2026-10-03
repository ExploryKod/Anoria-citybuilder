import { close as closeBuildBar, isOpenState as isBuildBarOpen } from './CompactToolbar.js';
import { syncMobileClickStateFab } from './MobileClickStateFab.js';
import { closeHamletSwitcher } from '../hamlets/hamletSwitcher.js';

const CONSTRUCTION_ID = 'toolbar-mobile-toggle';
const HAMLETS_ID = 'hamlet-switcher-btn';
const MODE_BUTTONS = '#toolbar-mobile-toggle, .mobile-click-state-btn, #hamlet-switcher-btn, #world-map-link-btn';

/**
 * The bottom bar works like radio buttons: one mode is active at a time and choosing a mode closes
 * whatever modal another mode opened. Runs in the capture phase so it reads the state before the
 * button's own handler changes it.
 * @param {{ getGame: () => { setActiveToolId: (toolId: string) => void } | null | undefined }} deps
 */
export function initBottomModeRadio({ getGame }) {
  const container = document.querySelector('.legend-btns-container--mobile');
  if (!container) throw new Error('[bottomModeRadio] .legend-btns-container--mobile is missing from the page');

  container.addEventListener('click', (event) => {
    const clicked = event.target.closest(MODE_BUTTONS);
    if (!clicked) return;

    document.querySelectorAll(MODE_BUTTONS).forEach((button) => button.classList.remove('active'));

    if (clicked.id === CONSTRUCTION_ID) {
      closeHamletSwitcher();
      if (!isBuildBarOpen()) {
        getGame()?.setActiveToolId('select-object');
        syncMobileClickStateFab('select-object');
      }
      return;
    }

    if (clicked.id === HAMLETS_ID) {
      closeBuildBar();
      return;
    }

    closeBuildBar();
    closeHamletSwitcher();
  }, true);
}
