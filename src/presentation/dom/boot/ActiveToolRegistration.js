import {
  getButtonsDisabled,
  getButtonsUnactive,
  closeModal,
  toggleModal,
} from '../tools/ToolPanel.js';

/**
 * @param {{
 *   registerAppFunction: (name: string, fn: Function) => void,
 *   popupManager?: object | null,
 *   getGame?: () => { setActiveToolId?: Function } | null,
 * }} deps
 */
export function registerActiveToolHandler(deps) {
  const { registerAppFunction, popupManager, getGame } = deps;
  let selectedControl = document.getElementById('bulldoze-btn');

  registerAppFunction('setActiveTool', (e) => {
    getButtonsUnactive(e);

    const toolEl = e.target?.closest?.('[data-toolid]') || e.currentTarget;
    const toolId = toolEl?.dataset?.toolid;

    if (e.target.classList.contains('panel-btn') || e.target.closest?.('.panel-btn')) {
      getButtonsDisabled();
      closeModal();

      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.classList.remove('pointer-events-disabled');
        canvas.style.pointerEvents = 'auto';
        canvas.style.touchAction = 'none';
        canvas.classList.add('canvas-interactive');
      }

      popupManager?.forceClosePopup('panel-layout');
    } else if (!toolId) {
      toggleModal(e);
    }

    selectedControl = e.currentTarget;
    selectedControl?.classList?.add('selected');
    if (toolId) {
      getGame()?.setActiveToolId(toolId);
    }
  });
}
