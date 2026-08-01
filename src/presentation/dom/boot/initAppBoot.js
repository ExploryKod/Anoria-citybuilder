import AssetManager from '../../three/meshs/AssetManager.js';
import {
  registerAppFunction,
  registerAppService,
  pauseGame,
  playGame,
  replayGame,
  invokeSetActiveTool,
  getTimeManager,
} from '../../../composition/sessionShell.js';
import { getSessionGame, getSessionScene } from '../../../composition/sessionRuntime.js';
import { registerActiveToolHandler } from './ActiveToolRegistration.js';
import { loadGameAssets, initButtonStateRegistry } from './AssetLoader.js';
import { bootstrapGameSession } from './GameSessionBootstrap.js';
import { initPlaybackControls } from './PlaybackControls.js';
import { initSpeedControls } from './SpeedControls.js';
import { initToolBarBindings } from './ToolBarBindings.js';
import { initMobileToolbar, initToolbarDropdowns } from './ToolbarShell.js';
import { bindToolPanelDeps } from '../tools/ToolPanel.js';
import { bindPopupManagerDeps, popupManager } from '../shell/PopupManager.js';
import { buttonStateManager } from '../shell/ButtonStateManager.js';
import '../shell/EventBlocker.js';
import { initParametersPanel } from '../parametres/ParametersPanel.js';
import { loadBudgetStates } from '../compta/compte-de-resultat/CompteDeResultatPanel.js';

export async function initAppBoot() {
  const assetManager = new AssetManager();

  bindPopupManagerDeps({ pauseGame, playGame });

  registerActiveToolHandler({
    registerAppFunction,
    popupManager,
    getGame: getSessionGame,
  });
  await loadGameAssets(assetManager);
  initButtonStateRegistry(buttonStateManager);
  bindToolPanelDeps({
    popupManager,
    buttonStateManager,
    playGame,
    invokeSetActiveTool,
  });
  initPlaybackControls({
    popupManager,
    pauseGame,
    playGame,
    replayGame,
    getScene: getSessionScene,
  });
  initSpeedControls({ getGame: getSessionGame });
  initToolBarBindings({
    buttonStateManager,
    invokeSetActiveTool,
  });
  initToolbarDropdowns();
  initMobileToolbar();
  initParametersPanel({
    pauseGame,
    playGame,
    registerAppService,
    getTimeManager,
  });
  registerAppFunction('loadBudgetStates', (period = '3', showLoading = true) =>
    loadBudgetStates(period, showLoading)
  );
  await bootstrapGameSession(assetManager);
}
