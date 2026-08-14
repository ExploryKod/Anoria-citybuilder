import {
  bullDozeButton,
  panelLayoutCloseBtn,
  selectButton,
} from '../shell/nodes.js';
import { closeModal, toggleModal } from '../tools/ToolPanel.js';

/**
 * Wire tools that still live as DOM stubs / right-rail actions.
 * Category construction opens via MobileCompactToolbar → ToolPanel (no left toolbar modals).
 *
 * @param {{
 *   buttonStateManager?: { isEnabled?: (id: string) => boolean } | null,
 *   invokeSetActiveTool?: (e: Event) => void,
 * }} [bindingDeps]
 */
export function initToolBarBindings(bindingDeps = {}) {
  const {
    invokeSetActiveTool = () => {},
  } = bindingDeps;

  bullDozeButton?.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  selectButton?.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  document.getElementById('legend-toolbar-btn')?.addEventListener('click', toggleModal);
  document.getElementById('finance-legend-btn')?.addEventListener('click', toggleModal);

  panelLayoutCloseBtn?.addEventListener('click', closeModal);
}
