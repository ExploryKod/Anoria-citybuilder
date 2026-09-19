/**
 * @jest-environment jsdom
 */
import { describe, expect, test, jest } from '@jest/globals';
import * as THREE from 'three';

// A one-mesh GLB stand-in: the adapter only needs meshes to clone / instance.
jest.unstable_mockModule('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    async loadAsync() {
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), new THREE.MeshStandardMaterial()));
      return { scene };
    }
  },
}));

const { getBuildingSourceAdapter } = await import(
  '../../../src/presentation/three/adapters/buildingSourceAdapterRegistry.js'
);
await import('../../../src/presentation/three/adapters/registerBuildingSourceAdapters.js');
const { ASSET_CATALOG } = await import('../../../src/presentation/three/meshs/resolveBuildingMesh.js');

const instancedMeshesOf = (group) => {
  const found = [];
  group.traverse((child) => { if (child.isInstancedMesh) found.push(child); });
  return found;
};
// Plants currently drawn (only the active growth stage has a non-zero count).
const plantedCount = (group) => instancedMeshesOf(group).reduce((sum, mesh) => sum + mesh.count, 0);

describe('kenneyFarmField adapter (assembled field)', () => {
  const adapter = getBuildingSourceAdapter('kenneyFarmField');
  const catalogEntry = ASSET_CATALOG['Farm-Wheat'];

  test('Farm-Wheat is declared as an assembled field with a crop', () => {
    expect(adapter).toBeTruthy();
    expect(catalogEntry.source).toBe('kenneyFarmField');
    expect(catalogEntry.crop.stages.ripe.glb).toMatch(/wheatStageB\.glb$/);
  });

  test('creates the ground plus a planted crop grid, on the requested tile', async () => {
    const field = await adapter.createMesh(4, 6, { catalogEntry, buildingId: 'Farm-Wheat', rotationStep: 0 });
    const perTile = catalogEntry.crop.perTile;

    expect(field.position.x).toBe(4);
    expect(field.position.z).toBe(6);
    expect(field.userData.isBuilding).toBe(true);
    expect(field.userData.type).toBe('Farm-Wheat');
    expect(typeof field.userData.applySeason).toBe('function');

    // One InstancedMesh set per growth stage, each with capacity for a 1×1 footprint.
    const sets = instancedMeshesOf(field);
    expect(sets.length).toBe(2); // growing + ripe (fallow plants nothing)
    sets.forEach((set) => expect(set.instanceMatrix.count).toBe(perTile * perTile));
  });

  test('a freshly placed field is unstaffed: nothing is planted', async () => {
    const field = await adapter.createMesh(0, 0, { catalogEntry, buildingId: 'Farm-Wheat' });
    expect(plantedCount(field)).toBe(0);
    // Even in the right season, no workers means no crop.
    field.userData.applySeason('Été');
    expect(plantedCount(field)).toBe(0);
  });

  test('the crop needs BOTH workers and the right season', async () => {
    const field = await adapter.createMesh(0, 0, { catalogEntry, buildingId: 'Farm-Wheat' });
    const planted = catalogEntry.crop.perTile ** 2;

    field.userData.applySeason('Été');
    field.userData.applyStaffing(true);
    expect(plantedCount(field)).toBe(planted);

    field.userData.applySeason('Hiver'); // staffed but wrong season
    expect(plantedCount(field)).toBe(0);

    field.userData.applySeason('Été');
    field.userData.applyStaffing(false); // right season but workers left
    expect(plantedCount(field)).toBe(0);
  });

  test('the placement ghost previews the crop', async () => {
    const field = await adapter.createMesh(0, 0, { catalogEntry });
    expect(plantedCount(field)).toBe(0);
    field.userData.showPreview();
    expect(plantedCount(field)).toBe(catalogEntry.crop.perTile ** 2);
  });

  test('each growth stage draws its own model (young wheat, then ripe wheat)', async () => {
    const field = await adapter.createMesh(0, 0, { catalogEntry, buildingId: 'Farm-Wheat' });
    field.userData.applyStaffing(true);
    const planted = catalogEntry.crop.perTile ** 2;

    const activeSet = () => instancedMeshesOf(field).filter((set) => set.count > 0);

    field.userData.applySeason('Hiver');
    expect(activeSet()).toHaveLength(0); // fallow

    field.userData.applySeason('Printemps');
    const growing = activeSet();
    expect(growing).toHaveLength(1);
    expect(growing[0].count).toBe(planted);

    field.userData.applySeason('Été');
    const ripe = activeSet();
    expect(ripe).toHaveLength(1);
    expect(ripe[0]).not.toBe(growing[0]); // a different stage model
  });

  test('an unknown season falls back to the default stage', async () => {
    const field = await adapter.createMesh(0, 0, { catalogEntry, buildingId: 'Farm-Wheat' });
    field.userData.applyStaffing(true);
    field.userData.applySeason('Hiver');
    field.userData.applySeason('???');
    expect(plantedCount(field)).toBe(catalogEntry.crop.perTile ** 2);
  });

  test('Farm-Carrot uses the same assembly: one model, half size while growing', async () => {
    const carrot = ASSET_CATALOG['Farm-Carrot'];
    expect(carrot.source).toBe('kenneyFarmField');
    const field = await adapter.createMesh(2, 3, { catalogEntry: carrot, buildingId: 'Farm-Carrot' });
    field.userData.applyStaffing(true);

    const activeScale = () => {
      const active = instancedMeshesOf(field).find((set) => set.count > 0);
      const matrix = new THREE.Matrix4();
      active.getMatrixAt(0, matrix);
      return matrix.getMaxScaleOnAxis();
    };

    field.userData.applySeason('Printemps');
    const growing = activeScale();
    field.userData.applySeason('Été');
    const ripe = activeScale();
    expect(growing).toBeLessThan(ripe);
    expect(plantedCount(field)).toBe(carrot.crop.perTile ** 2);

    field.userData.applySeason('Hiver');
    expect(plantedCount(field)).toBe(0);
  });

  test('every crop farm is an assembled field with the same season / staffing rules', async () => {
    for (const id of ['Farm-Wheat', 'Farm-Carrot', 'Farm-Cabbage']) {
      const entry = ASSET_CATALOG[id];
      expect(entry.source).toBe('kenneyFarmField');
      expect(entry.crop.requiresStaff).toBe(true);

      const field = await adapter.createMesh(0, 0, { catalogEntry: entry, buildingId: id });
      expect(plantedCount(field)).toBe(0); // placed unstaffed
      field.userData.applyStaffing(true);
      field.userData.applySeason('Été');
      expect(plantedCount(field)).toBe(entry.crop.perTile ** 2);
      field.userData.applySeason('Hiver');
      expect(plantedCount(field)).toBe(0);
    }
  });
});
