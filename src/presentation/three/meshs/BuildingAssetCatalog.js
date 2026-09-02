/**
 * Stable game-logic building id -> which adapter/asset renders it.
 *
 * This is THE catalog for building-mesh resolution: every placeable id is
 * written out explicitly below, one line each — not derived at runtime from
 * buildingCatalog.js or the Kenney registry. Open this one file and you see
 * every id's current renderer; no cross-referencing other catalogs needed.
 * Placement code must not fall back to any other routing heuristic (string
 * prefixes, etc.) when an entry is missing — a missing/broken entry is a
 * bug to surface loudly, not a case to route around silently.
 *
 * Only "which asset" lives here — never size/scale. Tile footprint
 * (`gridSize`) is a separate, game-logic fact and lives in
 * `src/shared/building-catalog/buildingCatalog.js`, under
 * `<id>.construction.gridSize`. After changing an entry below, look at the
 * building in the running scene and hand-adjust that file's `gridSize` to
 * match what you actually see — there is no automatic resizing.
 *
 * `adapter` picks which renderer resolves `asset`:
 *  - 'villageTown'   -> `asset` is a mesh/tool name inside village_town_assets_v2.glb
 *  - 'kenneyCityKit' -> `asset` is a Kenney building id (e.g. 'Kenney-Suburban-building-type-a')
 *
 * To reassign a stable id to a different glb, edit its `adapter`/`asset`
 * below — nothing else in the codebase needs to change. Adding a new
 * placeable id anywhere else in the game (buildingCatalog.js or the Kenney
 * registry) means adding one matching line here too — this file does not
 * pick those up automatically, by design.
 */
export const BUILDING_ASSET_CATALOG = Object.freeze({
  // --- village_town_assets_v2.glb ---
  'Arch': { adapter: 'villageTown', asset: 'Arch' },
  'Barn-001': { adapter: 'villageTown', asset: 'Barn-001' },
  'Barrell': { adapter: 'villageTown', asset: 'Barrell' },
  'Bench': { adapter: 'villageTown', asset: 'Bench' },
  'BookShop-001': { adapter: 'villageTown', asset: 'BookShop-001' },
  'Boulder-001': { adapter: 'villageTown', asset: 'Boulder-001' },
  'Chapel': { adapter: 'villageTown', asset: 'Chapel' },
  'Church-002': { adapter: 'villageTown', asset: 'Church-002' },
  'Coffin': { adapter: 'villageTown', asset: 'Coffin' },
  'Crate-001': { adapter: 'villageTown', asset: 'Crate-001' },
  'Cube': { adapter: 'villageTown', asset: 'Cube' },
  'Cylinder': { adapter: 'villageTown', asset: 'Cylinder' },
  'Daisy': { adapter: 'villageTown', asset: 'Daisy' },
  'Farm-Cabbage': { adapter: 'villageTown', asset: 'Farm-Cabbage' },
  'Farm-Carrot': { adapter: 'villageTown', asset: 'Farm-Carrot' },
  'Farm-Wheat': { adapter: 'villageTown', asset: 'Farm-Wheat' },
  'Fence-001': { adapter: 'villageTown', asset: 'Fence-001' },
  'Fountain-001': { adapter: 'villageTown', asset: 'Fountain-001' },
  'Garland': { adapter: 'villageTown', asset: 'Garland' },
  'Grave-1': { adapter: 'villageTown', asset: 'Grave-1' },
  'Grave-2': { adapter: 'villageTown', asset: 'Grave-2' },
  'Hay-Bale': { adapter: 'villageTown', asset: 'Hay-Bale' },
  'Hay-Cart': { adapter: 'villageTown', asset: 'Hay-Cart' },
  'Hay-Pile': { adapter: 'villageTown', asset: 'Hay-Pile' },
  'House-2Story': { adapter: 'villageTown', asset: 'House-2Story' },
  'House-Blue': { adapter: 'villageTown', asset: 'House-Blue' },
  'House-Purple': { adapter: 'villageTown', asset: 'House-Purple' },
  'House-Red': { adapter: 'villageTown', asset: 'House-Red' },
  'Market-Stall': { adapter: 'villageTown', asset: 'Market-Stall' },
  'Market-Stall-Blue': { adapter: 'villageTown', asset: 'Market-Stall-Blue' },
  'Market-Stall-Red': { adapter: 'villageTown', asset: 'Market-Stall-Red' },
  'Obelisk': { adapter: 'villageTown', asset: 'Obelisk' },
  'Picnic-Table': { adapter: 'villageTown', asset: 'Picnic-Table' },
  'Pillar': { adapter: 'villageTown', asset: 'Pillar' },
  'Plane-001': { adapter: 'villageTown', asset: 'Plane-001' },
  'Plane-004': { adapter: 'villageTown', asset: 'Plane-004' },
  'Plane-007': { adapter: 'villageTown', asset: 'Plane-007' },
  'Pond-001': { adapter: 'villageTown', asset: 'Pond-001' },
  'Potted-Bush': { adapter: 'villageTown', asset: 'Potted-Bush' },
  'Shroom': { adapter: 'villageTown', asset: 'Shroom' },
  'Sphere-001': { adapter: 'villageTown', asset: 'Sphere-001' },
  'Sphere-002': { adapter: 'villageTown', asset: 'Sphere-002' },
  'StonePath-001': { adapter: 'villageTown', asset: 'StonePath-001' },
  'StonePath-Cross-001': { adapter: 'villageTown', asset: 'StonePath-Cross-001' },
  'StonePath-Left-001': { adapter: 'villageTown', asset: 'StonePath-Left-001' },
  'StonePath-Right-001': { adapter: 'villageTown', asset: 'StonePath-Right-001' },
  'Streetlight-001': { adapter: 'villageTown', asset: 'Streetlight-001' },
  'Tomb': { adapter: 'villageTown', asset: 'Tomb' },
  'Tombstone-1': { adapter: 'villageTown', asset: 'Tombstone-1' },
  'Tombstone-2': { adapter: 'villageTown', asset: 'Tombstone-2' },
  'Tombstone-3': { adapter: 'villageTown', asset: 'Tombstone-3' },
  'Tree-Arbuste': { adapter: 'villageTown', asset: 'Tree-Arbuste' },
  'Tree-Chene': { adapter: 'villageTown', asset: 'Tree-Chene' },
  'Tree-Pine-001': { adapter: 'villageTown', asset: 'Tree-Pine-001' },
  'Tree-Sapin': { adapter: 'villageTown', asset: 'Tree-Sapin' },
  'Tree-Square-001': { adapter: 'villageTown', asset: 'Tree-Square-001' },
  'Tree-Tall-001': { adapter: 'villageTown', asset: 'Tree-Tall-001' },
  'Well-001': { adapter: 'villageTown', asset: 'Well-001' },
  'Windmill-001': { adapter: 'villageTown', asset: 'Windmill-001' },
  'Winery-001': { adapter: 'villageTown', asset: 'Winery-001' },
  'grass': { adapter: 'villageTown', asset: 'grass' },
  'roads': { adapter: 'villageTown', asset: 'roads' },
  'terrain': { adapter: 'villageTown', asset: 'terrain' },

  // --- Kenney city-kit ---
  'Kenney-Commercial-building-a': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-a' },
  'Kenney-Commercial-building-b': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-b' },
  'Kenney-Commercial-building-c': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-c' },
  'Kenney-Commercial-building-d': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-d' },
  'Kenney-Commercial-building-e': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-e' },
  'Kenney-Commercial-building-f': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-f' },
  'Kenney-Commercial-building-g': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-g' },
  'Kenney-Commercial-building-h': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-h' },
  'Kenney-Commercial-building-i': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-i' },
  'Kenney-Commercial-building-j': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-j' },
  'Kenney-Commercial-building-k': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-k' },
  'Kenney-Commercial-building-l': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-l' },
  'Kenney-Commercial-building-m': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-m' },
  'Kenney-Commercial-building-n': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-n' },
  'Kenney-Commercial-building-skyscraper-a': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-skyscraper-a' },
  'Kenney-Commercial-building-skyscraper-b': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-skyscraper-b' },
  'Kenney-Commercial-building-skyscraper-c': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-skyscraper-c' },
  'Kenney-Commercial-building-skyscraper-d': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-skyscraper-d' },
  'Kenney-Commercial-building-skyscraper-e': { adapter: 'kenneyCityKit', asset: 'Kenney-Commercial-building-skyscraper-e' },
  'Kenney-Industrial-building-a': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-a' },
  'Kenney-Industrial-building-b': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-b' },
  'Kenney-Industrial-building-c': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-c' },
  'Kenney-Industrial-building-d': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-d' },
  'Kenney-Industrial-building-e': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-e' },
  'Kenney-Industrial-building-f': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-f' },
  'Kenney-Industrial-building-g': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-g' },
  'Kenney-Industrial-building-h': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-h' },
  'Kenney-Industrial-building-i': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-i' },
  'Kenney-Industrial-building-j': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-j' },
  'Kenney-Industrial-building-k': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-k' },
  'Kenney-Industrial-building-l': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-l' },
  'Kenney-Industrial-building-m': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-m' },
  'Kenney-Industrial-building-n': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-n' },
  'Kenney-Industrial-building-o': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-o' },
  'Kenney-Industrial-building-p': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-p' },
  'Kenney-Industrial-building-q': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-q' },
  'Kenney-Industrial-building-r': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-r' },
  'Kenney-Industrial-building-s': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-s' },
  'Kenney-Industrial-building-t': { adapter: 'kenneyCityKit', asset: 'Kenney-Industrial-building-t' },
  'Kenney-Suburban-building-type-a': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-a' },
  'Kenney-Suburban-building-type-b': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-b' },
  'Kenney-Suburban-building-type-c': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-c' },
  'Kenney-Suburban-building-type-d': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-d' },
  'Kenney-Suburban-building-type-e': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-e' },
  'Kenney-Suburban-building-type-f': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-f' },
  'Kenney-Suburban-building-type-g': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-g' },
  'Kenney-Suburban-building-type-h': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-h' },
  'Kenney-Suburban-building-type-i': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-i' },
  'Kenney-Suburban-building-type-j': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-j' },
  'Kenney-Suburban-building-type-k': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-k' },
  'Kenney-Suburban-building-type-l': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-l' },
  'Kenney-Suburban-building-type-m': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-m' },
  'Kenney-Suburban-building-type-n': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-n' },
  'Kenney-Suburban-building-type-o': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-o' },
  'Kenney-Suburban-building-type-p': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-p' },
  'Kenney-Suburban-building-type-q': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-q' },
  'Kenney-Suburban-building-type-r': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-r' },
  'Kenney-Suburban-building-type-s': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-s' },
  'Kenney-Suburban-building-type-t': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-t' },
  'Kenney-Suburban-building-type-u': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-u' },
});
