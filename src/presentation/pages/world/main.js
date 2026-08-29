import { bootSiteChrome } from '../site/bootSiteChrome.js';
import { bootMapContexts } from '../../../composition/bootMapContexts.js';
import { WorldMapController } from '../../dom/maps/WorldMapController.js';

bootSiteChrome({ legalFooter: false });

async function main() {
  const root = document.getElementById('map-root');
  if (!root) {
    throw new Error('world map root not found');
  }

  const { mapApi } = await bootMapContexts();
  const controller = new WorldMapController(root, { mapApi });
  await controller.init();
}

main().catch((error) => {
  console.error('[world] bootstrap failed:', error);
});
