/**
 * Manual per-building overrides for status-icon placement: WHERE the icon
 * anchors (position, a fraction of the bounding box — see
 * meshUtils.resolveStatusIconPosition) AND how big it renders (scale, same
 * absolute Three.js sprite-scale convention as StatusIconDefaults.js).
 *
 * The generic bounding-box-relative default position math (and the fixed
 * default scale) can't know where a specific hand-modeled asset's roofline
 * actually is, or how big an icon should read against it — that needs eyes
 * on the model. Populate this table using the /placement.html tuning tool:
 * pick a building, drag the icon and resize it until it looks right, copy
 * the resulting `{ position, scale }` here.
 *
 * Sparse by design: a building/icon pair not listed here falls back to the
 * generic default in `resolveIconAppearance` (see resolveStatusIconAnchor.js).
 * Either `position` or `scale` may be omitted from an override — the
 * omitted one falls back to the default for that icon.
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
