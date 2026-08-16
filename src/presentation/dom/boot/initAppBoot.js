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
import { disableGatedPlacementTools } from '../shell/SkillPlacementGating.js';
import { bootstrapGameSession } from './GameSessionBootstrap.js';
import { initPlaybackControls } from './PlaybackControls.js';
import { initSpeedControls } from './SpeedControls.js';
import { initToolBarBindings } from './ToolBarBindings.js';
import { initMobileToolbar } from './ToolbarShell.js';
import { initHudTimeBarMinWidth } from '../shell/hudTimeBarSizing.js';
import { initHudPopRailTabs } from '../shell/hudPopRailTabs.js';
import { initHudPopRailCollapse } from '../shell/hudPopRailCollapse.js';
import { adoptHudFabDockChildren } from '../shell/hudFabDock.js';
import { initHudShellMenus } from '../shell/HudShellMenus.js';
import { initHamletTravelMenu } from '../shell/HamletTravelMenu.js';
import { initMobileCompactToolbar } from '../tools/MobileCompactToolbar.js';
import { initMobileClickStateFab } from '../tools/MobileClickStateFab.js';
import { initMissingTooltips, observeMissingTooltips } from './TooltipTitles.js';
import { bindToolPanelDeps } from '../tools/ToolPanel.js';
import { bindPopupManagerDeps, popupManager } from '../shell/PopupManager.js';
import { buttonStateManager } from '../shell/ButtonStateManager.js';
import '../shell/EventBlocker.js';
import { initParametersPanel } from '../parametres/ParametersPanel.js';
import { initMapFiltersPanel } from '../filters/MapFiltersPanel.js';
import { loadBudgetStates } from '../compta/compte-de-resultat/CompteDeResultatPanel.js';
import { mountCookieConsent } from '../../pages/site/mountCookieBanner.js';

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
  disableGatedPlacementTools(buttonStateManager);
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
  initMobileCompactToolbar({
    invokeSetActiveTool,
    buttonStateManager,
  });
  initMobileClickStateFab({ invokeSetActiveTool });
  initHudTimeBarMinWidth();
  initMobileToolbar();
  initHudPopRailTabs();
  initHudPopRailCollapse();
  initParametersPanel({
    pauseGame,
    playGame,
    registerAppService,
    getTimeManager,
    getScene: getSessionScene,
  });
  // After ParametersPanel (it rebinds #parameters-btn).
  initHudShellMenus();
  registerAppFunction('loadBudgetStates', (period = '3', showLoading = true) =>
    loadBudgetStates(period, showLoading)
  );
  await bootstrapGameSession(assetManager);
  initHamletTravelMenu();
  initMapFiltersPanel({
    getScene: getSessionScene,
  });
  initMissingTooltips();
  observeMissingTooltips();
  await mountCookieConsent();
  adoptHudFabDockChildren();
}
