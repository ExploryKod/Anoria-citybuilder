import { setToolPanelAssets } from '../tools/ToolPanel.js';
import { updateSpeedDisplay } from './SpeedControls.js';
import { getKenneyCityKitMeshAdapter } from '../../three/adapters/kenney-city-kit/KenneyCityKitMeshAdapter.js';
import { getKenneyNatureTerrainAdapter } from '../../three/adapters/kenney-nature-terrain/KenneyNatureTerrainAdapter.js';
import { getKenneyNaturePropAdapter } from '../../three/adapters/kenney-nature-props/KenneyNaturePropAdapter.js';
import { applyTerrainDisplayCssVariables } from '../../../shared/terrain-catalog/applyTerrainDisplayCssVariables.js';

export async function loadGameAssets(assetManager) {
  applyTerrainDisplayCssVariables();
  await assetManager.initializeTerrains();

  await getKenneyNatureTerrainAdapter().initialize();
  await getKenneyNaturePropAdapter().initialize();
  await getKenneyCityKitMeshAdapter().initialize();

  // Houses + nature are needed before scene.initialize / ResourceManager
  // (trees write Tree-Sapin etc. into city.tiles; meshes must exist or every
  // game tick retries createAsset(undefined) → THREE.Object3D.add spam).
  await Promise.all([
    assetManager.initializeBuildings('houses'),
    assetManager.initializeBuildings('nature'),
  ]);

  // Legacy mesh categories still load in the background for saves and procedural nature.
  const loadNonCriticalAssets = () => {
    Promise.all([
      assetManager.initializeBuildings('palaces'),
      assetManager.initializeBuildings('markets'),
      assetManager.initializeBuildings('industry'),
      assetManager.initializeBuildings('public'),
      assetManager.initializeBuildings('decoration'),
      assetManager.initializeBuildings('tombs'),
      assetManager.initializeBuildings('farms'),
      assetManager.initializeBuildings('infrastructure'),
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
}
