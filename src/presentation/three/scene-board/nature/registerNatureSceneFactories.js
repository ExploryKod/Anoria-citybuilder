import { getNaturePropCatalogEntry } from '../../../../shared/editor-catalog/naturePropCatalog.js';
import { registerSceneObjectFactory } from '../SceneObjectRegistry.js';
import { createKenneyNatureSceneTile } from './createKenneyNatureSceneTile.js';

let registered = false;

export function registerNatureSceneFactories() {
  if (registered) return;
  registered = true;

  registerSceneObjectFactory(
    (logicalId) => Boolean(getNaturePropCatalogEntry(logicalId)),
    (logicalId, x, y) => createKenneyNatureSceneTile(logicalId, x, y)
  );
}

/** @internal */
export function resetNatureSceneFactoryRegistration() {
  registered = false;
}
