import { jest, describe, test, expect } from '@jest/globals';
import * as THREE from 'three';
import { HamletResourceRegistry } from '../../../../src/presentation/three/hamlet/HamletResourceRegistry.js';

function makeBuilding(name, geometry, material) {
  const group = new THREE.Group();
  group.name = name;
  group.add(new THREE.Mesh(geometry, material));
  return group;
}

describe('HamletResourceRegistry', () => {
  test('disposeAll removes tracked roots from the scene and frees their geometry and material', () => {
    const scene = new THREE.Scene();
    const registry = new HamletResourceRegistry({ scene });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    const geometryDispose = jest.spyOn(geometry, 'dispose');
    const materialDispose = jest.spyOn(material, 'dispose');

    const building = registry.track(makeBuilding('house', geometry, material));
    scene.add(building);

    const freed = registry.disposeAll();

    expect(scene.children).not.toContain(building);
    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
    expect(freed).toEqual({ geometries: 1, materials: 1, textures: 0 });
    expect(registry.rootCount).toBe(0);
  });

  test('a texture on a material is disposed too, once', () => {
    const scene = new THREE.Scene();
    const registry = new HamletResourceRegistry({ scene });
    const texture = new THREE.Texture();
    const material = new THREE.MeshBasicMaterial({ map: texture, alphaMap: texture });
    const textureDispose = jest.spyOn(texture, 'dispose');

    scene.add(registry.track(makeBuilding('tile', new THREE.PlaneGeometry(1, 1), material)));
    const freed = registry.disposeAll();

    expect(textureDispose).toHaveBeenCalledTimes(1);
    expect(freed.textures).toBe(1);
  });

  test('a geometry shared by two buildings of the hamlet is disposed once', () => {
    const scene = new THREE.Scene();
    const registry = new HamletResourceRegistry({ scene });
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const geometryDispose = jest.spyOn(geometry, 'dispose');

    scene.add(registry.track(makeBuilding('a', geometry, new THREE.MeshBasicMaterial())));
    scene.add(registry.track(makeBuilding('b', geometry, new THREE.MeshBasicMaterial())));
    const freed = registry.disposeAll();

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(freed.geometries).toBe(1);
  });

  test('shared resources from the asset pool are never disposed', () => {
    const scene = new THREE.Scene();
    const pooledGeometry = new THREE.BoxGeometry(1, 1, 1);
    const pooledMaterial = new THREE.MeshBasicMaterial();
    const pooledGeometryDispose = jest.spyOn(pooledGeometry, 'dispose');
    const pooledMaterialDispose = jest.spyOn(pooledMaterial, 'dispose');
    const registry = new HamletResourceRegistry({ scene, sharedResources: () => [pooledGeometry, pooledMaterial] });

    scene.add(registry.track(makeBuilding('pooled', pooledGeometry, pooledMaterial)));
    registry.disposeAll();

    expect(pooledGeometryDispose).not.toHaveBeenCalled();
    expect(pooledMaterialDispose).not.toHaveBeenCalled();
  });

  test('markShared protects a resource created later', () => {
    const scene = new THREE.Scene();
    const registry = new HamletResourceRegistry({ scene });
    const material = registry.markShared(new THREE.MeshBasicMaterial());
    const materialDispose = jest.spyOn(material, 'dispose');

    scene.add(registry.track(makeBuilding('x', new THREE.BoxGeometry(1, 1, 1), material)));
    registry.disposeAll();

    expect(materialDispose).not.toHaveBeenCalled();
  });

  test('a second disposeAll after a rebuild only frees what the rebuild tracked', () => {
    const scene = new THREE.Scene();
    const registry = new HamletResourceRegistry({ scene });

    scene.add(registry.track(makeBuilding('first', new THREE.BoxGeometry(), new THREE.MeshBasicMaterial())));
    registry.disposeAll();
    expect(scene.children).toHaveLength(0);

    const secondGeometry = new THREE.BoxGeometry();
    const secondDispose = jest.spyOn(secondGeometry, 'dispose');
    scene.add(registry.track(makeBuilding('second', secondGeometry, new THREE.MeshBasicMaterial())));
    const freed = registry.disposeAll();

    expect(secondDispose).toHaveBeenCalledTimes(1);
    expect(freed.geometries).toBe(1);
    expect(scene.children).toHaveLength(0);
  });

  test('track refuses a missing object instead of silently registering nothing', () => {
    const registry = new HamletResourceRegistry({ scene: new THREE.Scene() });
    expect(() => registry.track(null)).toThrow('track() needs an object');
  });
});
