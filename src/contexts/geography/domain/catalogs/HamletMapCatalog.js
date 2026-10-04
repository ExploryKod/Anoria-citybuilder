import { HAMLET_CATALOG } from '../../../../shared/hamlet-catalog/hamletCatalog.js';

/**
 * Internal kingdom map — proto hamlet positions on an axial hex grid.
 * Layout mirrors 3D neighbor deco topology around Anoria (eraanurbs).
 */

/** @type {ReadonlyArray<{ id: string, name: string, q: number, r: number, sprite: string, labelAnchor?: string }>} */
export const HAMLET_MAP_SITES = Object.freeze(
  HAMLET_CATALOG.filter((hamlet) => hamlet.map).map((hamlet) => ({
    id: hamlet.slug,
    name: hamlet.name,
    q: hamlet.map.q,
    r: hamlet.map.r,
    sprite: hamlet.map.sprite,
    labelAnchor: hamlet.map.labelAnchor,
  }))
);
/**
 * @param {string} hamletId
 */
export function getHamletMapSite(hamletId) {
  return HAMLET_MAP_SITES.find((site) => site.id === hamletId) ?? null;
}

/**
 * World-map hex for a proto-hamlet — same axial grid as the kingdom map, centred on Anoria.
 * @param {string} hamletId
 */
export function getHamletWorldHex(hamletId) {
  const site = getHamletMapSite(hamletId);
  if (!site) return null;
  return { q: site.q, r: site.r, sprite: site.sprite };
}
