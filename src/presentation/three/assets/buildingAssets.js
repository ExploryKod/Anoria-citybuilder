/**
 * DECLARATIVE ASSET DATA — objects only, no functions.
 *
 * Bridges whatever a source package (village_town_assets_v2.glb, a Kenney
 * kit GLB, a Kenney nature-kit GLB) actually is, to what Three.js needs to
 * render it: geometry origin, transform, and presentation.
 *
 * NOT included here (stays separate, per explicit decision): game mechanics
 * (price, employment, maintenance — see
 * src/shared/building-catalog/buildingCatalog.js), collision footprint
 * (single-sourced in src/shared/asset-footprint/resolveFootprint.js), and
 * status-icon anchors
 * (already consolidated separately in
 * src/presentation/three/meshs/statusIconAnchors.js).
 *
 * `button` is the carousel/toolbar entry (group/editorGroup/label/tooltip/
 * icon). ToolPanel.js's resolveIcon() reads it directly, with NO fallback: a
 * missing entry or `button: null` throws rather than degrading to a default
 * icon — this file is the only place a building's icon/label/category is
 * decided. `button.group` is the REAL in-game gameplay category (one of
 * houses/farms/industry/markets/infrastructure/public — the exact keys
 * ToolPanel.js's GROUP_CREATORS route on) and is what actually determines
 * which carousel panel an id appears in; `editorGroup` is always `null` here
 * because no building-layer asset is placed via the separate map-editor
 * toolbar (see natureAssets.js/terrainAssets.js, where it isn't). icon.kind
 * is one of 'svg' (inline markup), 'png' (Kenney-style full-color preview
 * tile), 'icon' (a 24px monochrome silhouette PNG, styled like the SVGs —
 * used only where a raster icon predates this catalog, e.g. Windmill-001),
 * or 'emoji'. `button` is `null` for StonePath-Right/Left/Cross-001
 * (rotation variants of StonePath-001, never a distinct carousel button) and
 * Church-002 (legacy save-compat id, not a placeable tool).
 *
 * Field notes:
 *  - transform.rotationDeg: 'AUTO_DETECTED_AT_RUNTIME' means the real engine
 *    code (VillageTownAssetManager#createBuilding) decides this per-mesh via
 *    a bounding-box heuristic (isLocalYUpMesh), not a fixed declared value —
 *    flagged instead of guessed. Every other villageTown entry uses the
 *    pack's default authoring rotation (90,180,180) unless the source code
 *    hardcodes a named exception (Chapel, BookShop-001, StonePath turns).
 *  - kenneyCityKit entries: geometry.glb is intentionally null — the actual
 *    GLB path lives in the single runtime-fetched catalog JSON
 *    (/resources/kenney_city_kits_catalog.json via kenneyCityKitConfig.js),
 *    not duplicated here.
 *  - kenneyNatureProp / kenneyNatureTerrain entries: transform fields beyond
 *    surfaceY are null — actual per-GLB bbox placement offsets are
 *    scanned and generated in
 *    src/shared/editor-catalog/kenneyPlacementProfiles.generated.js; this
 *    file intentionally does not re-duplicate that generated, auto-scanned
 *    data by hand.
 *  - villageTown 'grass'/'terrain' use geometry.sourceKey as a
 *    procedural-material key instead of a GLB mesh name — these three are
 *    procedural THREE geometry
 *    with a shared Lambert material, not cloned GLB meshes.
 */

export const BUILDING_ASSETS = Object.freeze({
  // ---- villageTown ----
  // Palais
  'House-2Story': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'House-2Story',
      aliases: ['House_2Story', 'House_2Story_Purple', 'House_2Story_Purple001', 'House_2Story_Purple002', 'House_2Story_Purple003', 'House_2Story_Purple004', 'House_2Story_Purple005', 'House_2Story_Purple006', 'House_2Story_Purple007', 'House_2Story_Purple008', 'House_2Story_Purple009'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.5,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'House 2Story',
      tooltip: 'House 2Story',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/></svg>' },
    },
    tags: ['palaces', 'building'],
  },
  // Maison rouge
  'House-Red': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'House-Red',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.5,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'House Red',
      tooltip: 'House Red',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    },
    tags: ['houses', 'building'],
  },
  // Maison violette
  'House-Purple': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'House-Purple',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.5,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'House Purple',
      tooltip: 'House Purple',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    },
    tags: ['houses', 'building'],
  },
  // Champ de blé
  'Farm-Wheat': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Farm-Wheat',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'farms',
      editorGroup: null,
      label: 'Farm Wheat',
      tooltip: 'Farm Wheat',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/></svg>' },
    },
    tags: ['farms', 'building'],
  },
  // Champ de carottes
  'Farm-Carrot': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Farm-Carrot',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'farms',
      editorGroup: null,
      label: 'Farm Carrot',
      tooltip: 'Farm Carrot',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/></svg>' },
    },
    tags: ['farms', 'building'],
  },
  // Champ de choux
  'Farm-Cabbage': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Farm-Cabbage',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'farms',
      editorGroup: null,
      label: 'Farm Cabbage',
      tooltip: 'Farm Cabbage',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22"/><path d="M2 22 17 7"/></svg>' },
    },
    tags: ['farms', 'building'],
  },
  // Botte de foin
  'Hay-Bale': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Hay-Bale',
      aliases: ['Hay_Bale'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'farms',
      editorGroup: null,
      label: 'Hay Bale',
      tooltip: 'Hay Bale',
      icon: { kind: 'emoji', value: '🌾' },
    },
    tags: ['farms', 'building'],
  },
  // Chariot de foin
  'Hay-Cart': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Hay-Cart',
      aliases: ['Hay_Cart'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'farms',
      editorGroup: null,
      label: 'Hay Cart',
      tooltip: 'Hay Cart',
      icon: { kind: 'emoji', value: '🛒' },
    },
    tags: ['farms', 'building'],
  },
  // Meule de foin
  'Hay-Pile': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Hay-Pile',
      aliases: ['Hay_Pile'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'farms',
      editorGroup: null,
      label: 'Hay Pile',
      tooltip: 'Hay Pile',
      icon: { kind: 'emoji', value: '📦' },
    },
    tags: ['farms', 'building'],
  },
  // Moulin (taille alignée sur houses, override explicite)
  'Windmill-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Windmill-001',
      aliases: ['Windmill', 'Windmill001', 'Windmill002', 'Windmill003'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.5,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'Windmill 001',
      tooltip: 'Windmill 001',
      // 'icon' (not 'png'): a 24px monochrome silhouette icon like the SVGs
      // around it, not a Kenney-style full-color preview tile — see
      // ToolPanel.js resolveIcon().
      icon: { kind: 'icon', value: '/icons/windmill.png' },
    },
    tags: ['industry', 'building'],
  },
  // Grange
  'Barn-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Barn-001',
      aliases: ['Barn', 'Barn001'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.5,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'Barn 001',
      tooltip: 'Barn 001',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>' },
    },
    tags: ['industry', 'building'],
  },
  // Caisse
  'Crate-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Crate-001',
      aliases: ['Crate', 'Crate001', 'Crate002', 'Crate003', 'Crate004', 'Crate005', 'Crate006', 'Crate007', 'Crate008', 'Crate009', 'Crate010', 'Crate011', 'Crate012', 'Crate013', 'Crate014', 'Crate015', 'Crate016', 'Crate017', 'Crate018', 'Crate019', 'Crate020', 'Crate021', 'Crate022', 'Crate023', 'Crate024', 'Crate025', 'Crate026', 'Crate027', 'Crate028', 'Crate029', 'Crate030', 'Crate031', 'Crate032', 'Crate033', 'Crate034'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.5,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'Crate 001',
      tooltip: 'Crate 001',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>' },
    },
    tags: ['industry', 'building'],
  },
  // Chai — chargé depuis winery_v3.glb (hors GLB partagé)
  'Winery-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Winery-001',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.009,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'Winery 001',
      tooltip: 'Winery 001',
      icon: { kind: 'emoji', value: '🍷' },
    },
    tags: ['industry', 'building', 'standalone-glb'],
  },
  // Silo à blé
  'Cylinder': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Cylinder',
      aliases: ['Cylinder007', 'Cylinder008', 'Cylinder009', 'Cylinder011', 'Cylinder012', 'Cylinder013'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 5,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'Cylinder',
      tooltip: 'Cylinder',
      icon: { kind: 'emoji', value: '🛑' },
    },
    tags: ['industry', 'building'],
  },
  // Étal (alias legacy → mesh bleu)
  'Market-Stall': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Market-Stall-Blue',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.7,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'Market Stall',
      tooltip: 'Market Stall',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>' },
    },
    tags: ['markets', 'building', 'legacy-alias'],
  },
  // Étal bleu
  'Market-Stall-Blue': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Market-Stall-Blue',
      aliases: ['Market_Stall_Blue'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.7,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'Market Stall Blue',
      tooltip: 'Market Stall Blue',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>' },
    },
    tags: ['markets', 'building'],
  },
  // Étal rouge
  'Market-Stall-Red': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Market-Stall-Red',
      aliases: ['Market_Stall_Red'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.7,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'Market Stall Red',
      tooltip: 'Market Stall Red',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>' },
    },
    tags: ['markets', 'building'],
  },
  // Chemin de pierre
  'StonePath-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'StonePath-001',
      aliases: ['StonePath', 'StonePath001', 'StonePath002', 'StonePath003', 'StonePath004', 'StonePath005', 'StonePath006', 'StonePath007', 'StonePath008', 'StonePath009'],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.8,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'infrastructure',
      editorGroup: null,
      label: 'Chemin de pierre',
      tooltip: 'Chemin de pierre — touche R pour tourner',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="8" y1="8" x2="8" y2="10"/><line x1="16" y1="8" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="16"/><line x1="16" y1="14" x2="16" y2="16"/></svg>' },
    },
    tags: ['infrastructure', 'building', 'road'],
  },
  // Chemin de pierre (virage droite, réutilise le mesh StonePath-001)
  'StonePath-Right-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'StonePath-001',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 270,
      },
      positionOffsetY: 0.2,
      scale: 0.8,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a distinct carousel entry — right-turn variant of StonePath-001, selected via R-key rotation cycling, never placed directly by clicking a button
    tags: ['infrastructure', 'building', 'road'],
  },
  // Chemin de pierre (virage gauche, réutilise le mesh StonePath-001)
  'StonePath-Left-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'StonePath-001',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 90,
      },
      positionOffsetY: 0.2,
      scale: 0.8,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a distinct carousel entry — left-turn variant of StonePath-001, selected via R-key rotation cycling, never placed directly by clicking a button
    tags: ['infrastructure', 'building', 'road'],
  },
  // Croisement (réutilise le mesh StonePath-001)
  'StonePath-Cross-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'StonePath-001',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 90,
        y: 180,
        z: 180,
      },
      positionOffsetY: 0.2,
      scale: 0.8,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a distinct carousel entry — crossroad variant of StonePath-001, selected via R-key rotation cycling, never placed directly by clicking a button
    tags: ['infrastructure', 'building', 'road'],
  },
  // Chapelle
  'Chapel': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Chapel',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 0,
        y: 180,
        z: 0,
      },
      positionOffsetY: 0.2,
      scale: 0.8,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'public',
      editorGroup: null,
      label: 'Chapel',
      tooltip: 'Chapel',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/></svg>' },
    },
    tags: ['public', 'building'],
  },
  // Librairie — chargée depuis viking_carrot_farm_v1.glb (hors GLB partagé)
  'BookShop-001': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'BookShop-001',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: {
        x: 0,
        y: 180,
        z: 0,
      },
      positionOffsetY: 0.2,
      scale: 0.002,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'public',
      editorGroup: null,
      label: 'BookShop 001',
      tooltip: 'BookShop 001',
      icon: { kind: 'emoji', value: '📚' },
    },
    tags: ['public', 'building', 'standalone-glb'],
  },
  // Chapelle (alias de sauvegarde legacy, réutilise le mesh Chapel — upright-ness non forcée par nom pour cet id, dépend de la détection runtime isLocalYUpMesh)
  'Church-002': {
    source: 'villageTown',
    geometry: {
      glb: 'village_town_assets_v2.glb',
      sourceKey: 'Chapel',
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: 'AUTO_DETECTED_AT_RUNTIME',
      positionOffsetY: 0.2,
      scale: 0.8,
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a placeable tool — legacy save-compatibility id only (old saves referencing Church-002 render via the Chapel mesh), never exposed as a carousel button
    tags: ['public', 'building', 'legacy-alias'],
  },
  // Maison bleue — RÉASSIGNÉE au kit Kenney Suburban. Icon below still shows the old
  // village house — this is the exact identity/mesh split the catalog now makes visible
  // and fixable in one place (see file header).
  'House-Blue': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-a',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'House Blue',
      tooltip: 'House Blue',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    },
    tags: ['houses', 'building', 'reassigned-to-kenney'],
  },
  // ---- kenneyCityKit ----
  // Commerce — building-a
  'Kenney-Commercial-building-a': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-a',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'a',
      tooltip: 'Kenney commercial — building-a (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-a.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-b
  'Kenney-Commercial-building-b': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-b',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'b',
      tooltip: 'Kenney commercial — building-b (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-b.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-c
  'Kenney-Commercial-building-c': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-c',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'c',
      tooltip: 'Kenney commercial — building-c (1×2, 16€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-c.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-d
  'Kenney-Commercial-building-d': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-d',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'd',
      tooltip: 'Kenney commercial — building-d (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-d.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-e
  'Kenney-Commercial-building-e': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-e',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'e',
      tooltip: 'Kenney commercial — building-e (2×1, 16€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-e.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-f
  'Kenney-Commercial-building-f': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-f',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'f',
      tooltip: 'Kenney commercial — building-f (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-f.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-g
  'Kenney-Commercial-building-g': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-g',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'g',
      tooltip: 'Kenney commercial — building-g (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-g.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-h
  'Kenney-Commercial-building-h': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-h',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'h',
      tooltip: 'Kenney commercial — building-h (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-h.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-i
  'Kenney-Commercial-building-i': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-i',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'i',
      tooltip: 'Kenney commercial — building-i (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-i.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-j
  'Kenney-Commercial-building-j': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-j',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'j',
      tooltip: 'Kenney commercial — building-j (3×2, 40€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-j.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-k
  'Kenney-Commercial-building-k': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-k',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'k',
      tooltip: 'Kenney commercial — building-k (3×1, 22€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-k.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-l
  'Kenney-Commercial-building-l': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-l',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'l',
      tooltip: 'Kenney commercial — building-l (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-l.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-m
  'Kenney-Commercial-building-m': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-m',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'm',
      tooltip: 'Kenney commercial — building-m (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-m.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-n
  'Kenney-Commercial-building-n': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-n',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'n',
      tooltip: 'Kenney commercial — building-n (3×2, 40€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-n.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-skyscraper-a
  'Kenney-Commercial-building-skyscraper-a': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-skyscraper-a',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'skyscraper-a',
      tooltip: 'Kenney commercial — building-skyscraper-a (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-skyscraper-a.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-skyscraper-b
  'Kenney-Commercial-building-skyscraper-b': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-skyscraper-b',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'skyscraper-b',
      tooltip: 'Kenney commercial — building-skyscraper-b (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-skyscraper-b.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-skyscraper-c
  'Kenney-Commercial-building-skyscraper-c': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-skyscraper-c',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'skyscraper-c',
      tooltip: 'Kenney commercial — building-skyscraper-c (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-skyscraper-c.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-skyscraper-d
  'Kenney-Commercial-building-skyscraper-d': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-skyscraper-d',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'skyscraper-d',
      tooltip: 'Kenney commercial — building-skyscraper-d (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-skyscraper-d.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Commerce — building-skyscraper-e
  'Kenney-Commercial-building-skyscraper-e': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'commercial',
      buildingId: 'Kenney-Commercial-building-skyscraper-e',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'markets',
      editorGroup: null,
      label: 'skyscraper-e',
      tooltip: 'Kenney commercial — building-skyscraper-e (2×2, 28€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-skyscraper-e.png' },
    },
    tags: ['commercial', 'building'],
  },
  // Industrie — building-a
  'Kenney-Industrial-building-a': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-a',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'a',
      tooltip: 'Kenney industrial — building-a (3×2, 75€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-a.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-b
  'Kenney-Industrial-building-b': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-b',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'b',
      tooltip: 'Kenney industrial — building-b (3×2, 75€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-b.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-c
  'Kenney-Industrial-building-c': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-c',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'c',
      tooltip: 'Kenney industrial — building-c (2×3, 75€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-c.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-d
  'Kenney-Industrial-building-d': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-d',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'd',
      tooltip: 'Kenney industrial — building-d (1×2, 35€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-d.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-e
  'Kenney-Industrial-building-e': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-e',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'e',
      tooltip: 'Kenney industrial — building-e (2×2, 55€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-e.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-f
  'Kenney-Industrial-building-f': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-f',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'f',
      tooltip: 'Kenney industrial — building-f (2×2, 55€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-f.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-g
  'Kenney-Industrial-building-g': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-g',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'g',
      tooltip: 'Kenney industrial — building-g (2×2, 55€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-g.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-h
  'Kenney-Industrial-building-h': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-h',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'h',
      tooltip: 'Kenney industrial — building-h (2×2, 55€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-h.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-i
  'Kenney-Industrial-building-i': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-i',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'i',
      tooltip: 'Kenney industrial — building-i (1×2, 35€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-i.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-j
  'Kenney-Industrial-building-j': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-j',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'j',
      tooltip: 'Kenney industrial — building-j (1×2, 35€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-j.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-k
  'Kenney-Industrial-building-k': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-k',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'k',
      tooltip: 'Kenney industrial — building-k (2×1, 35€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-k.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-l
  'Kenney-Industrial-building-l': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-l',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'l',
      tooltip: 'Kenney industrial — building-l (3×2, 75€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-l.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-m
  'Kenney-Industrial-building-m': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-m',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'm',
      tooltip: 'Kenney industrial — building-m (2×2, 55€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-m.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-n
  'Kenney-Industrial-building-n': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-n',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'n',
      tooltip: 'Kenney industrial — building-n (1×2, 35€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-n.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-o
  'Kenney-Industrial-building-o': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-o',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'o',
      tooltip: 'Kenney industrial — building-o (1×2, 35€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-o.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-p
  'Kenney-Industrial-building-p': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-p',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'p',
      tooltip: 'Kenney industrial — building-p (2×1, 35€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-p.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-q
  'Kenney-Industrial-building-q': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-q',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'q',
      tooltip: 'Kenney industrial — building-q (3×2, 75€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-q.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-r
  'Kenney-Industrial-building-r': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-r',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 'r',
      tooltip: 'Kenney industrial — building-r (3×2, 75€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-r.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-s
  'Kenney-Industrial-building-s': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-s',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 's',
      tooltip: 'Kenney industrial — building-s (3×1, 45€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-s.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Industrie — building-t
  'Kenney-Industrial-building-t': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'industrial',
      buildingId: 'Kenney-Industrial-building-t',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'industry',
      editorGroup: null,
      label: 't',
      tooltip: 'Kenney industrial — building-t (2×2, 55€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-t.png' },
    },
    tags: ['industrial', 'building'],
  },
  // Maison — building-type-a
  'Kenney-Suburban-building-type-a': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-a',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-a',
      tooltip: 'Kenney suburban — building-type-a (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-a.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-b
  'Kenney-Suburban-building-type-b': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-b',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-b',
      tooltip: 'Kenney suburban — building-type-b (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-b.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-c
  'Kenney-Suburban-building-type-c': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-c',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-c',
      tooltip: 'Kenney suburban — building-type-c (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-c.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-d
  'Kenney-Suburban-building-type-d': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-d',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-d',
      tooltip: 'Kenney suburban — building-type-d (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-d.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-e
  'Kenney-Suburban-building-type-e': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-e',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-e',
      tooltip: 'Kenney suburban — building-type-e (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-e.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-f
  'Kenney-Suburban-building-type-f': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-f',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-f',
      tooltip: 'Kenney suburban — building-type-f (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-f.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-g
  'Kenney-Suburban-building-type-g': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-g',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-g',
      tooltip: 'Kenney suburban — building-type-g (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-g.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-h
  'Kenney-Suburban-building-type-h': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-h',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-h',
      tooltip: 'Kenney suburban — building-type-h (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-h.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-i
  'Kenney-Suburban-building-type-i': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-i',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-i',
      tooltip: 'Kenney suburban — building-type-i (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-i.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-j
  'Kenney-Suburban-building-type-j': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-j',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-j',
      tooltip: 'Kenney suburban — building-type-j (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-j.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-k
  'Kenney-Suburban-building-type-k': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-k',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-k',
      tooltip: 'Kenney suburban — building-type-k (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-k.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-l
  'Kenney-Suburban-building-type-l': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-l',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-l',
      tooltip: 'Kenney suburban — building-type-l (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-l.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-m
  'Kenney-Suburban-building-type-m': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-m',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-m',
      tooltip: 'Kenney suburban — building-type-m (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-m.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-n
  'Kenney-Suburban-building-type-n': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-n',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-n',
      tooltip: 'Kenney suburban — building-type-n (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-n.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-o
  'Kenney-Suburban-building-type-o': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-o',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-o',
      tooltip: 'Kenney suburban — building-type-o (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-o.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-p
  'Kenney-Suburban-building-type-p': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-p',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-p',
      tooltip: 'Kenney suburban — building-type-p (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-p.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-q
  'Kenney-Suburban-building-type-q': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-q',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-q',
      tooltip: 'Kenney suburban — building-type-q (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-q.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-r
  'Kenney-Suburban-building-type-r': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-r',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-r',
      tooltip: 'Kenney suburban — building-type-r (1×1, 10€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-r.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-s
  'Kenney-Suburban-building-type-s': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-s',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-s',
      tooltip: 'Kenney suburban — building-type-s (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-s.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-t
  'Kenney-Suburban-building-type-t': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-t',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-t',
      tooltip: 'Kenney suburban — building-type-t (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-t.png' },
    },
    tags: ['suburban', 'building'],
  },
  // Maison — building-type-u
  'Kenney-Suburban-building-type-u': {
    source: 'kenneyCityKit',
    geometry: {
      glb: null,
      sourceKey: null,
      aliases: [],
      kit: 'suburban',
      buildingId: 'Kenney-Suburban-building-type-u',
    },
    transform: {
      rotationDeg: null,
      positionOffsetY: 0.2,
      scale: null,
    },
    presentation: {
      mode: 'lit',
      castShadow: true,
      receiveShadow: true,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-u',
      tooltip: 'Kenney suburban — building-type-u (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-u.png' },
    },
    tags: ['suburban', 'building'],
  },
});
