import { bootSiteChrome } from '../site/bootSiteChrome.js';
import { bootMapContexts } from '../../../composition/bootMapContexts.js';
import { HamletsMapController } from '../../dom/maps/HamletsMapController.js';

bootSiteChrome();

async function main() {
  const root = document.getElementById('map-root');
  if (!root) {
    throw new Error('hamlets map root not found');
  }

  const { mapApi } = await bootMapContexts();
  const controller = new HamletsMapController(root, { mapApi });
  await controller.init();
}

main().catch((error) => {
  console.error('[hamlets] bootstrap failed:', error);
});
