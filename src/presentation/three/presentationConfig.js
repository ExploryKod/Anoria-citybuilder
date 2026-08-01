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
      camera: { left: -10, right: 10, top: 0, bottom: -10, near: 0.5, far: 50 },
    },
    ambient: { color: 0xffffff, intensity: 0.5 },
  },
  grid: {
    opacity: 0.2,
  },
};
