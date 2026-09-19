import { describe, expect, test } from '@jest/globals';
import { getSelectableMeshIds, resolveSelectedMeshId } from '../../../src/presentation/three/meshs/resolveBuildingMesh.js';
import { ASSET_CATALOG } from '../../../src/presentation/three/meshs/resolveBuildingMesh.js';

describe('selectableMeshes (S key)', () => {
  test('StonePath-001 declares an ordered choice starting with itself', () => {
    const ids = getSelectableMeshIds('StonePath-001');
    expect(ids[0]).toBe('StonePath-001');
    expect(ids.length).toBeGreaterThan(1);
    ids.forEach((id) => expect(ASSET_CATALOG[id]).toBeDefined());
  });

  test('selection wraps around and index 0 is the default', () => {
    const ids = getSelectableMeshIds('StonePath-001');
    expect(resolveSelectedMeshId('StonePath-001')).toBe(ids[0]);
    expect(resolveSelectedMeshId('StonePath-001', 1)).toBe(ids[1]);
    expect(resolveSelectedMeshId('StonePath-001', ids.length)).toBe(ids[0]);
    expect(resolveSelectedMeshId('StonePath-001', -1)).toBe(ids[ids.length - 1]);
  });

  test('tools without the fact are unchanged and offer no choice', () => {
    expect(getSelectableMeshIds('Farm-Wheat')).toEqual([]);
    expect(resolveSelectedMeshId('Farm-Wheat', 3)).toBe('Farm-Wheat');
    expect(resolveSelectedMeshId('unknown-id', 2)).toBe('unknown-id');
  });
});
