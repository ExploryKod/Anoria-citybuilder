import { resolveStatusIconPosition } from './meshUtils.js';
import { BUILDING_ASSETS } from '../assets/buildingAssets.js';

/**
 * Default status-icon anchor offsets and scales — fractions of the mesh's
 * local bounding box (see meshUtils.resolveStatusIconPosition), not absolute
 * units. Single source of truth for both the real game (scene.js) and the
 * /placement.html tuning tool, so the tool's starting point always matches
 * what the game actually falls back to.
 *
 * A per-building `statusIcons` entry in the mesh catalog (buildingAssets.js) takes precedence
 * over these defaults (see resolveIconAppearance below).
 */
export const STATUS_ICON_DEFAULTS = Object.freeze({
  road: { position: { x: -0.5, y: 1, z: 0 }, scale: { x: 0.6, y: 0.6, z: 1 }, spriteColor: null, backgroundColor: null },
  food: { position: { x: -0.5, y: 1, z: 0 }, scale: { x: 1.0, y: 1.0, z: 1 }, spriteColor: null, backgroundColor: null },
  'no-food': { position: { x: -0.5, y: 1, z: 0 }, scale: { x: 1.0, y: 1.0, z: 1 }, spriteColor: null, backgroundColor: null },
  'no-food-farm': {
    position: { x: -0.8, y: 0.5, z: -0.2 },
    scale: { x: 0.6, y: 0.6, z: 0.6 },
    spriteColor: 0xffff00,
    backgroundColor: null,
  },
  'grow-food': {
    position: { x: -0.8, y: 0.5, z: -0.2 },
    scale: { x: 0.4, y: 0.4, z: 0.4 },
    spriteColor: null,
    backgroundColor: 0xffe8e8,
  },
  harvest: {
    position: { x: -0.8, y: 0.5, z: -0.2 },
    scale: { x: 0.4, y: 0.4, z: 0.4 },
    spriteColor: null,
    backgroundColor: 0xffe8e8,
  },
  'sell-food': {
    position: { x: -0.8, y: 0.5, z: -0.2 },
    scale: { x: 0.4, y: 0.4, z: 0.4 },
    spriteColor: null,
    backgroundColor: 0xffe8e8,
  },
  isBuying: {
    position: { x: -0.5, y: 0.5, z: 0 },
    scale: { x: 0.6, y: 0.6, z: 1 },
    spriteColor: 0x00ff00,
    backgroundColor: 0xffffff,
  },
  isCollecting: {
    position: { x: -0.5, y: 0.5, z: 0 },
    scale: { x: 0.6, y: 0.6, z: 1 },
    spriteColor: 0x00ff00,
    backgroundColor: 0xffffff,
  },
  'sold-to-hub': {
    position: { x: 0.5, y: 0.5, z: 0 },
    scale: { x: 0.5, y: 0.5, z: 1 },
    spriteColor: 0x00ff00,
    backgroundColor: 0xffffff,
  },
  'failed-sell': {
    position: { x: 0.5, y: 0.5, z: 0 },
    scale: { x: 0.5, y: 0.5, z: 1 },
    spriteColor: null,
    backgroundColor: 0xffe8e8,
  },
  'no-resource': { position: { x: -0.5, y: 1, z: 0 }, scale: { x: 0.6, y: 0.6, z: 1 }, spriteColor: null, backgroundColor: null },
  'no-work': {
    position: { x: -0.8, y: 0.5, z: -0.2 },
    scale: { x: 0.5, y: 0.5, z: 0.5 },
    spriteColor: 0xff0000,
    backgroundColor: 0xffe8e8,
  },
  'no-work-service': {
    position: { x: -0.5, y: 0.5, z: 0 },
    scale: { x: 0.6, y: 0.6, z: 1 },
    spriteColor: 0xff0000,
    backgroundColor: 0xffe8e8,
  },
});

/**
 * Resolves both WHERE and HOW BIG a status icon (no-food, no-road,
 * isBuying, ...) should render on `mesh`: what the building's own mesh-catalog
 * entry declares (`statusIcons[iconKey]`: position and/or scale — either may be
 * omitted), otherwise the generic bounding-box-relative position with the given
 * default scale. The building is the one the game calls it (`userData.catalogId`),
 * so two buildings that share a kit mesh can still differ. Single choke point —
 * every status-sprite call site goes through this, and the /placement.html tool
 * prints the entry to paste into the building's `statusIcons`.
 *
 * @param {import('three').Object3D} mesh
 * @param {string} iconKey
 * @param {{x: number, y: number, z: number}} fallbackOffset
 * @param {{x: number, y: number, z: number}} fallbackScale
 * @returns {{
 *   position: {x: number, y: number, z: number},
 *   scale: {x: number, y: number, z: number},
 * }}
 */
export function resolveIconAppearance(mesh, iconKey, fallbackOffset, fallbackScale) {
  const override = BUILDING_ASSETS[mesh?.userData?.catalogId]?.statusIcons?.[iconKey];
  return {
    position: resolveStatusIconPosition(mesh, override?.position ?? fallbackOffset),
    scale: override?.scale ?? fallbackScale,
  };
}
