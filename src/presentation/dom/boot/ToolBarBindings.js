import {
  bullDozeButton,
  farmsButton,
  housesButton,
  industryButton,
  infrastructureButton,
  marketButton,
  palacesButton,
  panelLayoutCloseBtn,
  roadButton,
  selectButton,
  workshopButton,
} from '../shell/nodes.js';
import { closeModal, toggleModal } from '../tools/ToolPanel.js';

/**
 * @param {{
 *   buttonStateManager?: { isEnabled?: (id: string) => boolean } | null,
 *   invokeSetActiveTool?: (e: Event) => void,
 * }} [bindingDeps]
 */
export function initToolBarBindings(bindingDeps = {}) {
  const {
    buttonStateManager = null,
    invokeSetActiveTool = () => {},
  } = bindingDeps;

  bullDozeButton.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  selectButton.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  roadButton?.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  housesButton.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  palacesButton.addEventListener('click', (e) => {
    if (buttonStateManager && !buttonStateManager.isEnabled('palace-btn')) {
      return;
    }
    toggleModal(e);
  });

  farmsButton.addEventListener('click', toggleModal);
  industryButton.addEventListener('click', toggleModal);

  marketButton.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  infrastructureButton.addEventListener('click', (e) => {
    if (buttonStateManager && !buttonStateManager.isEnabled('infrastructure-btn')) {
      return;
    }
    toggleModal(e);
  });

  document.getElementById('bookshop-btn')?.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  workshopButton?.addEventListener('click', (e) => {
    invokeSetActiveTool(e);
  });

  document.getElementById('nature-btn')?.addEventListener('click', toggleModal);
  panelLayoutCloseBtn.addEventListener('click', closeModal);
}
