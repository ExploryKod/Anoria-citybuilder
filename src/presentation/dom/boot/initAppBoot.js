import AssetManager from '../../three/meshs/AssetManager.js';
import {
  registerAppFunction,
  getPopupManager,
  getButtonStateManager,
  playGame,
  invokeSetActiveTool,
} from '../../../composition/sessionShell.js';
import { getSessionGame } from '../../../composition/sessionRuntime.js';
import { registerActiveToolHandler } from './ActiveToolRegistration.js';
import { loadGameAssets, initButtonStateRegistry } from './AssetLoader.js';
import { bootstrapGameSession } from './GameSessionBootstrap.js';
import { initPlaybackControls } from './PlaybackControls.js';
import { initSpeedControls } from './SpeedControls.js';
import { initToolBarBindings } from './ToolBarBindings.js';
import { initMobileToolbar, initToolbarDropdowns } from './ToolbarShell.js';
import { bindToolPanelDeps } from '../tools/ToolPanel.js';

export async function initAppBoot() {
  const assetManager = new AssetManager();

  registerActiveToolHandler({
    registerAppFunction,
    popupManager: getPopupManager(),
    getGame: getSessionGame,
  });
  await loadGameAssets(assetManager);
  initButtonStateRegistry();
  bindToolPanelDeps({
    popupManager: getPopupManager(),
    buttonStateManager: getButtonStateManager(),
    playGame,
    invokeSetActiveTool,
  });
  initPlaybackControls();
  initSpeedControls();
  initToolBarBindings();
  initToolbarDropdowns();
  initMobileToolbar();
  await bootstrapGameSession(assetManager);
}
