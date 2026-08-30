import { buildIslandShoreLayout } from './islandShoreLayout.js';

/** @deprecated use buildIslandShoreLayout */
export function buildIslandBeachBorderLayout(citySize, options = {}) {
  return buildIslandShoreLayout(citySize, options);
}
