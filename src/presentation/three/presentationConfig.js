export const assetsConfig = {
  baseUrl: '/',
  models: {
    mainModel: '/resources/lowpoly/village_town_assets_v2.glb',
    catalog: '/village_town_assets.json',
  },
  textures: {
    base: '/resources/textures/maps/base.png',
    specular: '/resources/textures/maps/specular.png',
    grid: '/resources/textures/maps/grid.png',
  },
};

export const renderingConfig = {
  shadows: {
    enabled: true,
    type: 'PCFSoftShadowMap',
    mapSize: 1024,
    normalBias: 0.01,
  },
  lights: {
    sun: {
      color: 0xffffff,
      intensity: 2,
      position: { x: 0, y: 1, z: 0 },
      // Orthographic shadow camera extents are derived from citySize in LightingManager
      camera: { left: -20, right: 20, top: 20, bottom: -20, near: 0.5, far: 80 },
    },
    ambient: { color: 0xffffff, intensity: 0.5 },
  },
  grid: {
    opacity: 0.2,
  },
};
