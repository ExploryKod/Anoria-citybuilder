/**
 * @jest-environment jsdom
 */
import { describe, expect, test, jest } from '@jest/globals';
import * as THREE from 'three';

const loads = [];
jest.unstable_mockModule('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    async loadAsync(url) {
      loads.push(url);
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.4, 0.4, 0.4) })));
      return { scene };
    }
  },
}));

const { getBuildingSourceAdapter } = await import('../../../src/presentation/three/adapters/buildingSourceAdapterRegistry.js');
await import('../../../src/presentation/three/adapters/registerBuildingSourceAdapters.js');
const { ASSET_CATALOG } = await import('../../../src/presentation/three/meshs/resolveBuildingMesh.js');

const meshOf = (group) => {
  let found = null;
  group.traverse((child) => { if (child.isMesh && !found) found = child; });
  return found;
};

describe('kenneyGlb adapter — presentation.brightness', () => {
  const adapter = getBuildingSourceAdapter('kenneyGlb');
  const road = ASSET_CATALOG['StonePath-001'];

  test('every road declares a brightness above 1 (lighter than the authored asphalt)', () => {
    for (const id of ['StonePath-001', 'StonePath-Right-001', 'StonePath-Left-001', 'StonePath-Cross-001', 'StonePath-Tee-001', 'StonePath-End-001']) {
      expect(ASSET_CATALOG[id].presentation.brightness).toBeGreaterThan(1);
    }
  });

  test('the model colors are multiplied by the catalog brightness', async () => {
    const group = await adapter.createMesh(0, 0, { catalogEntry: road, buildingId: 'StonePath-001' });
    expect(meshOf(group).material.color.r).toBeCloseTo(0.4 * road.presentation.brightness);
  });

  test('a piece without brightness keeps its authored colors, and tuning never leaks between entries', async () => {
    const plain = { ...road, geometry: { ...road.geometry, glb: '/plain-piece.glb' }, presentation: { mode: 'lit' } };
    const untouched = await adapter.createMesh(0, 0, { catalogEntry: plain, buildingId: 'plain' });
    expect(meshOf(untouched).material.color.r).toBeCloseTo(0.4);

    const lighter = await adapter.createMesh(0, 0, { catalogEntry: { ...plain, presentation: { brightness: 2 } }, buildingId: 'plain' });
    expect(meshOf(lighter).material.color.r).toBeCloseTo(0.8);
    // the un-tuned template is cached separately and still authored
    const again = await adapter.createMesh(1, 1, { catalogEntry: plain, buildingId: 'plain' });
    expect(meshOf(again).material.color.r).toBeCloseTo(0.4);
  });
});
