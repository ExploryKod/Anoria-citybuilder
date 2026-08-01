import AssetManager from '../../three/meshs/AssetManager.js';
import { registerActiveToolHandler } from './ActiveToolRegistration.js';
import { loadGameAssets, initButtonStateRegistry } from './AssetLoader.js';
import { bootstrapGameSession } from './GameSessionBootstrap.js';
import { initPlaybackControls } from './PlaybackControls.js';
import { initSpeedControls } from './SpeedControls.js';
import { initToolBarBindings } from './ToolBarBindings.js';
import { initMobileToolbar, initToolbarDropdowns } from './ToolbarShell.js';

export async function initAppBoot() {
  const assetManager = new AssetManager();

  registerActiveToolHandler();
  await loadGameAssets(assetManager);
  initButtonStateRegistry();
  initPlaybackControls();
  initSpeedControls();
  initToolBarBindings();
  initToolbarDropdowns();
  initMobileToolbar();
  await bootstrapGameSession(assetManager);
}
