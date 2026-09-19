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

  const initUI = () => updateSpeedDisplay();
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
