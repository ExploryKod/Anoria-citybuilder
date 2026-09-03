import { resolveStatusIconPosition } from '../meshUtils.js';

/**
 * Default status-icon anchor offsets and scales — fractions of the mesh's
 * local bounding box (see meshUtils.resolveStatusIconPosition), not absolute
 * units. Single source of truth for both the real game (scene.js) and the
 * /placement.html tuning tool, so the tool's starting point always matches
 * what the game actually falls back to.
 *
 * A per-building override in STATUS_ICON_ANCHOR_OVERRIDES takes precedence
 * over these defaults (see resolveIconAppearance below).
 */
export const STATUS_ICON_DEFAULTS = Object.freeze({
  road: { position: { x: -1, y: 1, z: 1 }, scale: { x: 1.2, y: 1.2, z: 1 }, spriteColor: null, backgroundColor: null },
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
  'sold-to-windmill': {
    position: { x: 0.5, y: 0.5, z: 0 },
    scale: { x: 0.5, y: 0.5, z: 1 },
    spriteColor: 0x00ff00,
    backgroundColor: 0xffffff,
  },
  'no-work': {
    position: { x: -0.8, y: 0.5, z: -0.2 },
    scale: { x: 0.5, y: 0.5, z: 0.5 },
    spriteColor: 0xff0000,
    backgroundColor: 0xffe8e8,
  },
  'no-work-market-windmill': {
    position: { x: -0.5, y: 0.5, z: 0 },
    scale: { x: 0.6, y: 0.6, z: 1 },
    spriteColor: 0xff0000,
    backgroundColor: 0xffe8e8,
  },
});

/**
 * Manual per-building overrides for status-icon placement: WHERE the icon
 * anchors (position, a fraction of the bounding box — see
 * meshUtils.resolveStatusIconPosition) AND how big it renders (scale, same
 * absolute Three.js sprite-scale convention as STATUS_ICON_DEFAULTS).
 *
 * The generic bounding-box-relative default position math (and the fixed
 * default scale) can't know where a specific hand-modeled asset's roofline
 * actually is, or how big an icon should read against it — that needs eyes
 * on the model. Populate this table using the /placement.html tuning tool:
 * pick a building, drag the icon and resize it until it looks right, copy
 * the resulting `{ position, scale }` here.
 *
 * Sparse by design: a building/icon pair not listed here falls back to the
 * generic default in `resolveIconAppearance`. Either `position` or `scale`
 * may be omitted from an override — the omitted one falls back to the
 * default for that icon.
 *
 * Shape: { [buildingId]: { [iconKey]: { position?: {x,y,z}, scale?: {x,y,z} } } }
 * iconKey matches the sprite name used at the call site (e.g. 'road',
 * 'no-food', 'isBuying', 'isCollecting', 'grow-food', 'no-work', ...).
 */
export const STATUS_ICON_ANCHOR_OVERRIDES = Object.freeze({
  // 'Kenney-Suburban-building-type-a': {
  //   'no-food': { position: { x: -0.3, y: 0.9, z: 0 }, scale: { x: 0.5, y: 0.5, z: 0.5 } },
  //   'road': { position: { x: -0.6, y: 1.1, z: 0.2 }, scale: { x: 0.6, y: 0.6, z: 0.6 } },
  // },
});

/**
 * Resolves both WHERE and HOW BIG a status icon (no-food, no-road,
 * isBuying, ...) should render on `mesh`: a manual per-building override if
 * one exists in STATUS_ICON_ANCHOR_OVERRIDES (position and/or scale),
 * otherwise the generic bounding-box-relative position with the given
 * default scale. Single choke point — every status-sprite call site should
 * go through this, not resolveStatusIconPosition directly, so a future
 * tuning pass has exactly one table to edit for both position and scale.
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
  const buildingId = mesh?.userData?.type || mesh?.userData?.id;
  const override = STATUS_ICON_ANCHOR_OVERRIDES[buildingId]?.[iconKey];
  return {
    position: resolveStatusIconPosition(mesh, override?.position ?? fallbackOffset),
    scale: override?.scale ?? fallbackScale,
  };
}
