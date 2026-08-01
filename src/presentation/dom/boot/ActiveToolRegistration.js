import { registerAppFunction, getPopupManager } from '../../../composition/sessionShell.js';
import { getSessionGame } from '../../../composition/sessionRuntime.js';
import {
  getButtonsDisabled,
  getButtonsUnactive,
  closeModal,
  toggleModal,
} from '../tools/ToolPanel.js';

export function registerActiveToolHandler() {
  let selectedControl = document.getElementById('bulldoze-btn');

  registerAppFunction('setActiveTool', (e) => {
    getButtonsUnactive(e);
    if (e.target.classList.contains('panel-btn')) {
      getButtonsDisabled();
      closeModal();

      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.classList.remove('pointer-events-disabled');
        canvas.style.pointerEvents = 'auto';
        canvas.style.touchAction = 'none';
        canvas.classList.add('canvas-interactive');
      }

      getPopupManager()?.forceClosePopup('panel-layout');
    } else if (!e.target.dataset.toolid) {
      toggleModal(e);
    }

    selectedControl = e.currentTarget;
    selectedControl.classList.add('selected');
    getSessionGame()?.setActiveToolId(e.target.dataset.toolid);
  });
}
