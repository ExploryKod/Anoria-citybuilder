/**
 * Default status-icon anchor offsets and scales — fractions of the mesh's
 * local bounding box (see meshUtils.resolveStatusIconPosition), not absolute
 * units. Single source of truth for both the real game (scene.js) and the
 * /placement.html tuning tool, so the tool's starting point always matches
 * what the game actually falls back to.
 *
 * A per-building override in StatusIconAnchorCatalog.js takes precedence
 * over these defaults (see resolveStatusIconAnchor.js).
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
