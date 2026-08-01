import { getButtonStateManager } from '../../js/acl/appRuntime.js';
import { setToolPanelAssets } from '../tools/ToolPanel.js';
import { updateSpeedDisplay } from './SpeedControls.js';

export async function loadGameAssets(assetManager) {
  await assetManager.initializeTerrains();

  const loadHouses = async () => {
    await assetManager.initializeBuildings('houses');
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(loadHouses, { timeout: 500 });
  } else {
    setTimeout(loadHouses, 0);
  }

  const loadNonCriticalAssets = () => {
    Promise.all([
      assetManager.initializeBuildings('palaces'),
      assetManager.initializeBuildings('markets'),
      assetManager.initializeBuildings('farms'),
      assetManager.initializeBuildings('industry'),
      assetManager.initializeBuildings('infrastructure'),
      assetManager.initializeBuildings('public'),
      assetManager.initializeBuildings('nature'),
      assetManager.initializeBuildings('workshop'),
    ]).catch(() => {});
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(loadNonCriticalAssets, { timeout: 3000 });
  } else {
    setTimeout(loadNonCriticalAssets, 500);
  }

  const initUI = () => {
    setToolPanelAssets(assetManager.getButtonData(), assetManager.getToolIds());
    updateSpeedDisplay();
  };

  if (typeof requestIdleCallback !== 'undefined') {
    requestIdleCallback(initUI, { timeout: 1000 });
  } else {
    setTimeout(initUI, 100);
  }
}

export function initButtonStateRegistry() {
  const manager = getButtonStateManager();
  if (!manager) {
    console.warn('⚠️ ButtonStateManager not available');
    return;
  }

  ['palace-btn', 'infrastructure-btn', 'workshop-btn'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      manager.registerButton(id, button);
    }
  });
}
