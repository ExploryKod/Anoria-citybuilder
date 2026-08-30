import { setToolPanelAssets } from '../tools/ToolPanel.js';
import { updateSpeedDisplay } from './SpeedControls.js';
// Modified at lines 3-4 to test kenney fantasy
import { getKenneyModularMeshAdapter } from '../../three/adapters/kenney-test/KenneyModularMeshAdapter.js';

export async function loadGameAssets(assetManager) {
  await assetManager.initializeTerrains();

  // Modified at lines 9-10 to test kenney fantasy
  await getKenneyModularMeshAdapter().initialize();

  // Houses + nature are needed before scene.initialize / ResourceManager
  // (trees write Tree-Sapin etc. into city.tiles; meshes must exist or every
  // game tick retries createAsset(undefined) → THREE.Object3D.add spam).
  await Promise.all([
    assetManager.initializeBuildings('houses'),
    assetManager.initializeBuildings('nature'),
  ]);

  const loadNonCriticalAssets = () => {
    Promise.all([
      assetManager.initializeBuildings('palaces'),
      assetManager.initializeBuildings('markets'),
      assetManager.initializeBuildings('farms'),
      assetManager.initializeBuildings('industry'),
      assetManager.initializeBuildings('infrastructure'),
      assetManager.initializeBuildings('public'),
      assetManager.initializeBuildings('decoration'),
      assetManager.initializeBuildings('tombs'),
    ])
      .then(() => {
        setToolPanelAssets(assetManager.getButtonData(), assetManager.getToolIds());
      })
      .catch(() => {});
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

/**
 * @param {{ registerButton?: (id: string, button: HTMLElement) => void } | null} [buttonStateManager]
 */
export function initButtonStateRegistry(buttonStateManager = null) {
  if (!buttonStateManager) {
    console.warn('⚠️ ButtonStateManager not available');
    return;
  }

  ['palace-btn', 'infrastructure-btn', 'workshop-btn'].forEach((id) => {
    const button = document.getElementById(id);
    if (button) {
      buttonStateManager.registerButton(id, button);
    }
  });
}
