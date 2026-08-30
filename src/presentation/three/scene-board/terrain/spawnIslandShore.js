import { buildIslandShoreLayout } from '../../../../shared/terrain-catalog/islandShoreLayout.js';
import { resolveTerrainZoneIndex } from '../../../../shared/terrain-catalog/terrainZoneLayout.js';
import { attachSceneTilePort } from '../SceneTilePort.js';
import { createKenneyShoreSceneTile } from './createKenneyShoreSceneTile.js';
import { spawnIslandShoreScatter } from './spawnIslandShoreScatter.js';

/**
 * @typedef {object} SpawnIslandShoreResult
 * @property {import('../SceneTilePort.js').SceneTilePort[]} ports
 * @property {number} tileCount
 */

/**
 * @param {object} params
 * @param {number} params.citySize
 * @param {number} params.zoneSize
 * @param {number} params.zonePadding
 * @param {import('three').Group[]} params.zoneGroups
 * @param {import('three').Scene} params.scene
 * @param {number} [params.padding=4]
 * @param {number} [params.seed=42]
 * @returns {SpawnIslandShoreResult}
 */
export function spawnIslandShore({
  citySize,
  zoneSize,
  zonePadding,
  zoneGroups,
  scene,
  padding = 4,
  seed = 42,
}) {
  const layout = buildIslandShoreLayout(citySize, { padding, seed });
  /** @type {import('../SceneTilePort.js').SceneTilePort[]} */
  const ports = [];

  for (const tile of layout) {
    const port = attachSceneTilePort(createKenneyShoreSceneTile(tile.x, tile.y, tile));
    port.root.name = `shore-${tile.role}-${tile.compass}-${tile.x}-${tile.y}`;

    const zoneIndex = resolveTerrainZoneIndex(
      tile.x,
      tile.y,
      citySize,
      zoneSize,
      zonePadding
    );

    if (zoneIndex != null && zoneGroups[zoneIndex]) {
      zoneGroups[zoneIndex].add(port.root);
    } else {
      scene.add(port.root);
    }

    ports.push(port);
  }

  void spawnIslandShoreScatter({ tiles: layout, seed, scene });

  return { ports, tileCount: ports.length };
}

/** @deprecated use spawnIslandShore */
export function spawnIslandBeachBorder(params) {
  return spawnIslandShore(params);
}
