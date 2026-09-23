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
 * or 'emoji'. `button.pillCategory` (optional) names the build-bar category pill
 * this tool IS: the pill itself activates the tool and no carousel is shown
 * under it (a road has nothing to choose from — see
 * buildingCategories.js's getDirectToolForCategory). Omitted, the pill of
 * `group` opens a carousel of the tools of that group as usual.
 * `button` is `null` for StonePath-Right/Left/Cross-001
 * (rotation variants of StonePath-001, never a distinct carousel button) and
 * Church-002 (legacy save-compat id, not a placeable tool).
 *
 * Field notes:
 *  - transform.rotationDeg: fixed yaw (degrees) declared per entry; the player's R
 *    key adds 90° steps on top. `null` for kenneyCityKit entries (the adapter
 *    derives orientation from the prefab).
 *  - selectableMeshes (optional): ordered array of catalog ids the S key cycles
 *    through while the entry's tool is active — see resolveSelectedMeshId in
 *    resolveBuildingMesh.js. Only StonePath-001 declares it today.
 *  - presentation.brightness (optional, kenneyGlb): multiplies the model's colors
 *    (1 = as authored, >1 lighter) — a pure look tweak, tunable without code.
 *  - presentation.ghostStyle (optional): 'tint' (default, flat coloured ghost) or
 *    'preview' (real textured mesh, translucent + state glow) — for pieces too
 *    detailed to read as a flat ghost, e.g. roads.
 *  - kenneyFarmField entries: `geometry.glb` is the ground GLB (tiled per footprint tile) and
 *    `crop` describes the crop planted on it (perTile, stages — one GLB per growth stage —, stageBySeason,
 *    defaultStage, requiresStaff, idleStage, previewStage) — see
 *    kenneyFarmFieldAdapter.js. The game drives it through mesh.userData.applySeason(season)
 *    and mesh.userData.applyStaffing(staffed).
 *  - kenneyGlb entries: geometry.glb is the full public URL of a single-tile GLB (road piece,
 *    nature-kit tree/rock); transform.rotationDeg.y is the base yaw (R adds 90° steps on top).
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
 *  - sceneTile 'grass'/'terrain' (see terrainAssets.js) use geometry.sourceKey as a
 *    procedural-material key instead of a GLB mesh name — these three are
 *    procedural THREE geometry
 *    with a shared Lambert material, not cloned GLB meshes.
 */

export const BUILDING_ASSETS = Object.freeze({
  // Palais
  'House-2Story': {
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
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
      instanceable: true,
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
  'House-Red-Legacy': {
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
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null,
    // button: {
    //   group: 'houses',
    //   editorGroup: null,
    //   label: 'House Red',
    //   tooltip: 'House Red',
    //   icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    // },
    tags: ['houses', 'building'],
  },
  // Maison violette
  'House-Purple-Legacy': {
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
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null,
    // button: {
    //   group: 'houses',
    //   editorGroup: null,
    //   label: 'House Purple',
    //   tooltip: 'House Purple',
    //   icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
    // },
    tags: ['houses', 'building'],
  },
  // Champ de blé
  'Farm-Wheat': {
    source: 'kenneyFarmField',
    geometry: {
      glb: '/resources/kenney_nature-kit/Models/GLTF format/crops_dirtDoubleRow.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: { x: 0, y: 0, z: 0 },
      // Same clearance as the roads: the ground piece is only 0.05 thick, so it must
      // sit above the terrain surface (a fallow field draws nothing else).
      positionOffsetY: 0.05,
      scale: 1,
    },
    // Assembled field: the ground above + one wheat model per growth stage (nature kit).
    crop: {
      perTile: 2,
      stages: {
        fallow: null,
        growing: { glb: '/resources/kenney_nature-kit/Models/GLTF format/crops_wheatStageA.glb' },
        ripe: { glb: '/resources/kenney_nature-kit/Models/GLTF format/crops_wheatStageB.glb' },
      },
      stageBySeason: { Hiver: 'fallow', Printemps: 'growing', 'Été': 'ripe', Automne: 'ripe' },
      defaultStage: 'ripe',
      // No workers → no crop at all (constant fallow); the ghost still previews it.
      requiresStaff: true,
      idleStage: 'fallow',
      previewStage: 'ripe',
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
      instanceable: true,
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
    source: 'kenneyFarmField',
    geometry: {
      glb: '/resources/kenney_nature-kit/Models/GLTF format/crops_dirtDoubleRow.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: { x: 0, y: 0, z: 0 },
      // Same clearance as the wheat field: the ground piece is only 0.05 thick.
      positionOffsetY: 0.05,
      scale: 1,
    },
    // Assembled field like Farm-Wheat. The nature kit has a single (mature) carrot model:
    // the young stage reuses it at half size.
    crop: {
      perTile: 3,
      stages: {
        fallow: null,
        growing: { glb: '/resources/kenney_nature-kit/Models/GLTF format/crop_carrot.glb', scale: 0.5 },
        ripe: { glb: '/resources/kenney_nature-kit/Models/GLTF format/crop_carrot.glb' },
      },
      stageBySeason: { Hiver: 'fallow', Printemps: 'growing', 'Été': 'ripe', Automne: 'ripe' },
      defaultStage: 'ripe',
      requiresStaff: true,
      idleStage: 'fallow',
      previewStage: 'ripe',
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
      instanceable: true,
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
    source: 'kenneyFarmField',
    geometry: {
      glb: '/resources/kenney_nature-kit/Models/GLTF format/crops_dirtDoubleRow.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: { x: 0, y: 0, z: 0 },
      // Same clearance as the other fields: the ground piece is only 0.05 thick.
      positionOffsetY: 0.05,
      scale: 1,
    },
    // Assembled field like Farm-Wheat. The nature kit has no cabbage: the leafy-crop
    // models (2 growth stages) stand in for it.
    crop: {
      perTile: 2,
      stages: {
        fallow: null,
        growing: { glb: '/resources/kenney_nature-kit/Models/GLTF format/crops_leafsStageA.glb' },
        ripe: { glb: '/resources/kenney_nature-kit/Models/GLTF format/crops_leafsStageB.glb' },
      },
      stageBySeason: { Hiver: 'fallow', Printemps: 'growing', 'Été': 'ripe', Automne: 'ripe' },
      defaultStage: 'ripe',
      requiresStaff: true,
      idleStage: 'fallow',
      previewStage: 'ripe',
    },
    presentation: {
      mode: 'lit',
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
      instanceable: true,
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
  // Caisse
  'Crate-001': {
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
  // Silo à blé
  'Cylinder': {
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
  'Market-Stall-Legacy': {
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
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null,
    // button: {
    //   group: 'markets',
    //   editorGroup: null,
    //   label: 'Market Stall',
    //   tooltip: 'Market Stall',
    //   icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>' },
    // },
    tags: ['markets', 'building', 'legacy-alias'],
  },
  // Étal bleu
  'Market-Stall-Blue': {
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
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
      instanceable: true,
    },
    button: null, // not a distinct carousel entry — Market-Stall-Red is the one placeable market, user request 2026-09-08 ("I need only one market in this game")
    tags: ['markets', 'building'],
  },
  // Étal rouge
  'Market-Stall-Red': {
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
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
      instanceable: true,
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
    source: 'kenneyGlb',
    geometry: {
      glb: '/resources/kenney_city-kit-roads/Models/GLB format/road-straight.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      // Yaw only (degrees): the Kenney road pieces are flat, Y-up, 1×1 tiles.
      rotationDeg: { x: 0, y: 0, z: 0 },
      positionOffsetY: 0.05,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      ghostStyle: 'preview',
      // The Kenney asphalt is dark and blends with the walkers: >1 lightens the whole piece.
      brightness: 1.5,
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: {
      group: 'infrastructure',
      // The 'roads' pill is this tool: one click on it activates the road tool, no carousel.
      pillCategory: 'roads',
      editorGroup: null,
      label: 'Chemin de pierre',
      tooltip: 'Chemin de pierre — R pour tourner, S pour changer de forme',
      icon: { kind: 'svg', value: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="8" y1="8" x2="8" y2="10"/><line x1="16" y1="8" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="16"/><line x1="16" y1="14" x2="16" y2="16"/></svg>' },
    },
    tags: ['infrastructure', 'building', 'road'],
    // Ordered catalog ids the S key cycles through while this tool is active
    // (the first one is the default). Each id is a full catalog entry of its
    // own, so the placed tile keeps that id; R still rotates whichever mesh is
    // selected. See resolveBuildingMesh.js's resolveSelectedMeshId.
    selectableMeshes: ['StonePath-001', 'StonePath-Right-001', 'StonePath-Tee-001', 'StonePath-Cross-001', 'StonePath-End-001'],
  },
  // Chemin de pierre (virage droite, réutilise le mesh StonePath-001)
  'StonePath-Right-001': {
    source: 'kenneyGlb',
    geometry: {
      glb: '/resources/kenney_city-kit-roads/Models/GLB format/road-bend.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      // Yaw only (degrees): the Kenney road pieces are flat, Y-up, 1×1 tiles.
      rotationDeg: { x: 0, y: 0, z: 0 },
      positionOffsetY: 0.05,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      ghostStyle: 'preview',
      // The Kenney asphalt is dark and blends with the walkers: >1 lightens the whole piece.
      brightness: 1.5,
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
    source: 'kenneyGlb',
    geometry: {
      glb: '/resources/kenney_city-kit-roads/Models/GLB format/road-bend.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      // Yaw only (degrees): the Kenney road pieces are flat, Y-up, 1×1 tiles.
      rotationDeg: { x: 0, y: 180, z: 0 },
      positionOffsetY: 0.05,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      ghostStyle: 'preview',
      // The Kenney asphalt is dark and blends with the walkers: >1 lightens the whole piece.
      brightness: 1.5,
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
    source: 'kenneyGlb',
    geometry: {
      glb: '/resources/kenney_city-kit-roads/Models/GLB format/road-crossroad.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      // Yaw only (degrees): the Kenney road pieces are flat, Y-up, 1×1 tiles.
      rotationDeg: { x: 0, y: 0, z: 0 },
      positionOffsetY: 0.05,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      ghostStyle: 'preview',
      // The Kenney asphalt is dark and blends with the walkers: >1 lightens the whole piece.
      brightness: 1.5,
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a distinct carousel entry — crossroad variant of StonePath-001, selected via R-key rotation cycling, never placed directly by clicking a button
    tags: ['infrastructure', 'building', 'road'],
  },
  // Chemin de pierre en T (variante sélectionnable par S, jamais un bouton à part)
  'StonePath-Tee-001': {
    source: 'kenneyGlb',
    geometry: {
      glb: '/resources/kenney_city-kit-roads/Models/GLB format/road-intersection.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: { x: 0, y: 0, z: 0 },
      positionOffsetY: 0.05,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      ghostStyle: 'preview',
      // The Kenney asphalt is dark and blends with the walkers: >1 lightens the whole piece.
      brightness: 1.5,
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a distinct carousel entry — selected via the S key on StonePath-001
    tags: ['infrastructure', 'building', 'road'],
  },
  // Bout de chemin (variante sélectionnable par S, jamais un bouton à part)
  'StonePath-End-001': {
    source: 'kenneyGlb',
    geometry: {
      glb: '/resources/kenney_city-kit-roads/Models/GLB format/road-end.glb',
      sourceKey: null,
      aliases: [],
      kit: null,
      buildingId: null,
    },
    transform: {
      rotationDeg: { x: 0, y: 0, z: 0 },
      positionOffsetY: 0.05,
      scale: 1,
    },
    presentation: {
      mode: 'lit',
      ghostStyle: 'preview',
      // The Kenney asphalt is dark and blends with the walkers: >1 lightens the whole piece.
      brightness: 1.5,
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a distinct carousel entry — selected via the S key on StonePath-001
    tags: ['infrastructure', 'building', 'road'],
  },
  // Chapelle — RÉASSIGNÉ au kit Kenney Industrial building-l (geometry
  // copied from Kenney-Industrial-building-l below; economy/footprint stay
  // keyed to 'Chapel', untouched). Tower/chimney silhouette chosen as the
  // least-mismatched available Kenney mesh for a spiritual-center reskin —
  // no religious-themed Kenney asset exists in this project.
  'Chapel': {
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
      group: 'public',
      editorGroup: null,
      label: 'Chapel',
      tooltip: 'Chapel',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-l.png' },
    },
    tags: ['public', 'building'],
  },
  // Librairie — chargée depuis viking_carrot_farm_v1.glb (hors GLB partagé)
  'BookShop-001': {
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
      castShadow: null,
      receiveShadow: null,
      renderOrder: null,
      frustumCulled: true,
      displayColor: null,
    },
    button: null, // not a placeable tool — legacy save-compatibility id only (old saves referencing Church-002 render via the Chapel mesh), never exposed as a carousel button
    tags: ['public', 'building', 'legacy-alias'],
  },
  // ---- kenneyCityKit ----
  // Commerce — building-a — kept as its own entry (button: null) so its own
  // economy/footprint facts (auto-folded from kenneyCityKitRegistry.generated.js,
  // unrenameable) always have a renderer. Market-Stall below borrows its
  // geometry (copy, not move) to reassign the transverse "Market-Stall" id.
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
    button: null, // not a distinct carousel entry — no placeable id uses this mesh (Market-Stall-Red is the one placeable market)
    tags: ['commercial', 'building'],
  },
  // Étal — RÉASSIGNÉ au kit Kenney Commercial building-a (geometry copied from
  // Kenney-Commercial-building-a above; economy/footprint stay keyed to
  // 'Market-Stall', untouched). Legacy save-compat id — Market-Stall-Red is
  // the one placeable market (user request 2026-09-08).
  'Market-Stall': {
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
      instanceable: true,
    },
    button: null, // not a distinct carousel entry — Market-Stall-Red is the one placeable market
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['commercial', 'building'],
  },
  // Commerce — building-d
  // Bibliothèque (below) réassigne cette geometry — plus d'entrée carousel
  // "Commerce" distincte pour building-d, voir Library.
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
    button: null, // not a distinct carousel entry — Library (below) is the placeable id for this mesh
    tags: ['commercial', 'building'],
  },
  // Bibliothèque — RÉASSIGNÉ au kit Kenney Commercial building-d (geometry
  // copied from Kenney-Commercial-building-d above; economy/footprint stay
  // keyed to 'Library', untouched). Education-layer service — see
  // shared/asset-economy/buildingEconomy.js.
  'Library': {
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
      group: 'public',
      editorGroup: null,
      label: 'Bibliothèque',
      tooltip: 'Bibliothèque',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-d.png' },
    },
    tags: ['public', 'building'],
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['commercial', 'building'],
  },
  // Cabinet médical (below) réassigne cette geometry — plus d'entrée
  // carousel "Commerce" distincte pour building-f, voir Doctor.
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
    button: null, // not a distinct carousel entry — Doctor (below) is the placeable id for this mesh
    tags: ['commercial', 'building'],
  },
  // Cabinet médical — RÉASSIGNÉ au kit Kenney Commercial building-f
  // (geometry copied from Kenney-Commercial-building-f above; economy/
  // footprint stay keyed to 'Doctor', untouched). Medical-layer service.
  'Doctor': {
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
      group: 'public',
      editorGroup: null,
      label: 'Cabinet médical',
      tooltip: 'Cabinet médical',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-f.png' },
    },
    tags: ['public', 'building'],
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['commercial', 'building'],
  },
  // École (below) réassigne cette geometry — plus d'entrée carousel
  // "Commerce" distincte pour building-i, voir School.
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
    button: null, // not a distinct carousel entry — School (below) is the placeable id for this mesh
    tags: ['commercial', 'building'],
  },
  // École — RÉASSIGNÉ au kit Kenney Commercial building-i (geometry copied
  // from Kenney-Commercial-building-i above; economy/footprint stay keyed
  // to 'School', untouched). Education-layer service.
  'School': {
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
      group: 'public',
      editorGroup: null,
      label: 'École',
      tooltip: 'École',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-i.png' },
    },
    tags: ['public', 'building'],
  },
  // Hôpital (below) réassigne cette geometry — plus d'entrée carousel
  // "Commerce" distincte pour building-j, voir Hospital.
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
    button: null, // not a distinct carousel entry — Hospital (below) is the placeable id for this mesh
    tags: ['commercial', 'building'],
  },
  // Hôpital — RÉASSIGNÉ au kit Kenney Commercial building-j (geometry
  // copied from Kenney-Commercial-building-j above; economy/footprint stay
  // keyed to 'Hospital', untouched). Medical-layer service.
  'Hospital': {
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
      group: 'public',
      editorGroup: null,
      label: 'Hôpital',
      tooltip: 'Hôpital',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-j.png' },
    },
    tags: ['public', 'building'],
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['commercial', 'building'],
  },
  // Cinéma (below) réassigne cette geometry — plus d'entrée carousel
  // "Commerce" distincte pour building-m, voir Cinema.
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
    button: null, // not a distinct carousel entry — Cinema (below) is the placeable id for this mesh
    tags: ['commercial', 'building'],
  },
  // Cinéma — RÉASSIGNÉ au kit Kenney Commercial building-m (geometry copied
  // from Kenney-Commercial-building-m above; economy/footprint stay keyed
  // to 'Cinema', untouched). Entertainment-layer service.
  'Cinema': {
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
      group: 'public',
      editorGroup: null,
      label: 'Cinéma',
      tooltip: 'Cinéma',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-m.png' },
    },
    tags: ['public', 'building'],
  },
  // Théâtre (below) réassigne cette geometry — plus d'entrée carousel
  // "Commerce" distincte pour building-n, voir Theatre.
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
    button: null, // not a distinct carousel entry — Theatre (below) is the placeable id for this mesh
    tags: ['commercial', 'building'],
  },
  // Théâtre — RÉASSIGNÉ au kit Kenney Commercial building-n (geometry
  // copied from Kenney-Commercial-building-n above; economy/footprint stay
  // keyed to 'Theatre', untouched). Entertainment-layer service.
  'Theatre': {
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
      group: 'public',
      editorGroup: null,
      label: 'Théâtre',
      tooltip: 'Théâtre',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-commercial_2.1/Previews/building-n.png' },
    },
    tags: ['public', 'building'],
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['industrial', 'building'],
  },
  // Industrie — building-d
  // Atelier de plats (below) réassigne cette geometry — plus d'entrée
  // carousel "Industrie" distincte pour building-d, voir Factory-Plate.
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
    button: null, // not a distinct carousel entry — Factory-Plate (below) is the placeable id for this mesh
    tags: ['industrial', 'building'],
  },
  // Atelier de plats — RÉASSIGNÉ au kit Kenney Industrial building-d
  // (geometry copied from Kenney-Industrial-building-d above; economy/
  // footprint stay keyed to 'Factory-Plate', untouched). Pottery workshop
  // (see buildingEconomy.js).
  'Factory-Plate': {
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
      label: 'Atelier de plats',
      tooltip: 'Atelier de plats',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-d.png' },
    },
    tags: ['industry', 'building'],
  },
  // Bûcheron — RÉASSIGNÉ au kit Kenney Industrial building-o (geometry copied
  // from Kenney-Industrial-building-o; economy/footprint keyed to 'Lumberjack').
  // Raw-material producer, see buildingEconomy.js.
  'Lumberjack': {
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
      label: 'Bûcheron',
      tooltip: 'Bûcheron',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-o.png' },
    },
    tags: ['industry', 'building'],
  },
  // Atelier de meubles — RÉASSIGNÉ au kit Kenney Industrial building-f (economy/footprint keyed to 'Factory-Furniture').
  'Factory-Furniture': {
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
      label: 'Atelier de meubles',
      tooltip: 'Atelier de meubles',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-f.png' },
    },
    tags: ['industry', 'building'],
  },
  // Entrepôt — RÉASSIGNÉ au kit Kenney Industrial building-a (economy/footprint keyed to 'Warehouse').
  'Warehouse': {
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
      label: 'Entrepôt',
      tooltip: 'Entrepôt',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-a.png' },
    },
    tags: ['industry', 'building'],
  },
  // Industrie — building-e
  // Bains publics (below) réassigne cette geometry — plus d'entrée
  // carousel "Industrie" distincte pour building-e, voir PublicBath.
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
    button: null, // not a distinct carousel entry — PublicBath (below) is the placeable id for this mesh
    tags: ['industrial', 'building'],
  },
  // Bains publics — RÉASSIGNÉ au kit Kenney Industrial building-e
  // (geometry copied from Kenney-Industrial-building-e above; economy/
  // footprint stay keyed to 'PublicBath', untouched). Medical-layer
  // service (grouped with Doctor/Hospital — see buildingEconomy.js).
  'PublicBath': {
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
      group: 'public',
      editorGroup: null,
      label: 'Bains publics',
      tooltip: 'Bains publics',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-e.png' },
    },
    tags: ['public', 'building'],
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['industrial', 'building'],
  },
  // Atelier de pots (below) réassigne cette geometry — plus d'entrée
  // carousel "Industrie" distincte pour building-g, voir Factory-Pot.
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
    button: null, // not a distinct carousel entry — Factory-Pot (below) is the placeable id for this mesh
    tags: ['industrial', 'building'],
  },
  // Atelier de pots — RÉASSIGNÉ au kit Kenney Industrial building-g
  // (geometry copied from Kenney-Industrial-building-g above; economy/
  // footprint stay keyed to 'Factory-Pot', untouched). Pottery workshop.
  'Factory-Pot': {
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
      label: 'Atelier de pots',
      tooltip: 'Atelier de pots',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-g.png' },
    },
    tags: ['industry', 'building'],
  },
  // Atelier d'amphores (below) réassigne cette geometry — plus d'entrée
  // carousel "Industrie" distincte pour building-h, voir Factory-Amphora.
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
    button: null, // not a distinct carousel entry — Factory-Amphora (below) is the placeable id for this mesh
    tags: ['industrial', 'building'],
  },
  // Atelier d'amphores — RÉASSIGNÉ au kit Kenney Industrial building-h
  // (geometry copied from Kenney-Industrial-building-h above; economy/
  // footprint stay keyed to 'Factory-Amphora', untouched). Pottery workshop.
  'Factory-Amphora': {
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
      label: 'Atelier d\'amphores',
      tooltip: 'Atelier d\'amphores',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-h.png' },
    },
    tags: ['industry', 'building'],
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['industrial', 'building'],
  },
  // Industrie — building-k
  // Taverne (below) réassigne cette geometry — plus d'entrée carousel
  // "Industrie" distincte pour building-k, voir Pub.
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
    button: null, // not a distinct carousel entry — Pub (below) is the placeable id for this mesh
    tags: ['industrial', 'building'],
  },
  // Taverne — RÉASSIGNÉ au kit Kenney Industrial building-k (geometry
  // copied from Kenney-Industrial-building-k above; economy/footprint stay
  // keyed to 'Pub', untouched). Entertainment-layer service.
  'Pub': {
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
      group: 'public',
      editorGroup: null,
      label: 'Taverne',
      tooltip: 'Taverne',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-industrial_1.0/Previews/building-k.png' },
    },
    tags: ['public', 'building'],
  },
  // Industrie — building-l
  // not a distinct carousel entry — Chapel (above) is the placeable id for this mesh
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
    button: null, // not a distinct carousel entry — Chapel (above) is the placeable id for this mesh
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['industrial', 'building'],
  },
  // Maison — building-type-a — kept as its own entry (button: null) so its own
  // economy/footprint facts (auto-folded from kenneyCityKitRegistry.generated.js,
  // unrenameable) always have a renderer. House-Red below borrows its geometry
  // (copy, not move) to reassign the transverse "House-Red" id.
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
    button: null, // not a distinct carousel entry — House-Red (below) is the placeable id for this mesh
    tags: ['suburban', 'building'],
  },
  // Maison rouge — RÉASSIGNÉE au kit Kenney Suburban building-type-a (geometry
  // copied from Kenney-Suburban-building-type-a above; economy/footprint stay
  // keyed to 'House-Red', untouched).
  'House-Red': {
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
      instanceable: true,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-a',
      tooltip: 'Maison d\' artisants (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-a.png' },
    },
    tags: ['suburban', 'building'],
    // Visible tier evolution for artisans — see HouseLevelPolicy.js/
    // socialCategoryCatalog.js for the gameplay tiers this mirrors. Each
    // entry reuses an existing, otherwise-unused Kenney suburban geometry —
    // see resolveBuildingMesh.js's resolveVisualBuildingId.
    // All 3 variants are 2×1 like the base (type-a) — a mismatched footprint
    // (e.g. type-f is 2×2) shifts the mesh's centering at evolution time,
    // since footprint size drives the placement offset. Keep any future
    // level variant assignment footprint-matched to its base house.
    levelVariants: {
      2: 'Kenney-Suburban-building-type-d',
      3: 'Kenney-Suburban-building-type-e',
      4: 'Kenney-Suburban-building-type-o',
    },
  },
  // Maison — building-type-b — kept as its own entry (button: null), same reason as type-a above.
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
    button: null, // not a distinct carousel entry — House-Blue (below) is the placeable id for this mesh
    tags: ['suburban', 'building'],
  },
  // Maison bleue — RÉASSIGNÉE au kit Kenney Suburban building-type-b (geometry
  // copied from Kenney-Suburban-building-type-b above; economy/footprint stay
  // keyed to 'House-Blue', untouched).
  'House-Blue': {
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
      instanceable: true,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-b',
      tooltip: 'Maison de commerçant (2×2, 34€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-b.png' },
    },
    tags: ['suburban', 'building'],
    // Visible tier evolution for merchants — all 3 variants are 2×2 like the
    // base (type-b); see the footprint-matching note on House-Red above.
    levelVariants: {
      2: 'Kenney-Suburban-building-type-f',
      3: 'Kenney-Suburban-building-type-g',
      4: 'Kenney-Suburban-building-type-m',
    },
  },
  // Maison — building-type-c — kept as its own entry (button: null), same reason as type-a above.
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
    button: null, // not a distinct carousel entry — House-Purple (below) is the placeable id for this mesh
    tags: ['suburban', 'building'],
  },
  // Maison violette — RÉASSIGNÉE au kit Kenney Suburban building-type-c (geometry
  // copied from Kenney-Suburban-building-type-c above; economy/footprint stay
  // keyed to 'House-Purple', untouched).
  'House-Purple': {
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
      instanceable: true,
    },
    button: {
      group: 'houses',
      editorGroup: null,
      label: 'type-c',
      tooltip: 'Maison de Savant (2×1, 18€)',
      icon: { kind: 'png', value: '/resources/kenney_city-kit-suburban_20/Previews/building-type-c.png' },
    },
    tags: ['suburban', 'building'],
    // Visible tier evolution for scholars — all 3 variants are 2×1 like the
    // base (type-c); see the footprint-matching note on House-Red above.
    levelVariants: {
      2: 'Kenney-Suburban-building-type-h',
      3: 'Kenney-Suburban-building-type-i',
      4: 'Kenney-Suburban-building-type-j',
    },
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
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
    button: null, // not a distinct carousel entry — no gameplay role yet (raw Kenney prefab)
    tags: ['suburban', 'building'],
  },
});
