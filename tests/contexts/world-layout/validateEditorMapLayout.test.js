import { describe, expect, test } from '@jest/globals';
import { parseEditorMapLayout } from '../../../src/contexts/world-layout/domain/validateEditorMapLayout.js';
import { applyEditorMapLayoutToCity } from '../../../src/contexts/world-layout/application/services/ApplyEditorMapLayoutToCity.js';

describe('validateEditorMapLayout', () => {
  test('parses v3 layout with uuid and stack objects', () => {
    const layout = parseEditorMapLayout({
      uuid: 'c9dfa044-5c53-4446-b751-423e0e46fa6e',
      name: 'Test map',
      version: 3,
      citySize: 2,
      terrain: [['editor:sea', 'editor:sea'], ['editor:sea', 'editor:sea']],
      stackObjects: [{
        id: 'stack-1',
        assetId: 'nature:cliff_rock',
        x: 0,
        y: 0,
        rotationY: 0,
        baseLocalY: 0,
        parentId: null,
        anchor: 'sea',
      }],
    });

    expect(layout.id).toBe('c9dfa044-5c53-4446-b751-423e0e46fa6e');
    expect(layout.name).toBe('Test map');
    expect(layout.stackObjects).toHaveLength(1);
  });

  test('rejects duplicate-prone invalid uuid', () => {
    expect(() => parseEditorMapLayout({
      uuid: 'not-a-uuid',
      version: 3,
      citySize: 2,
      terrain: [['editor:sea', 'editor:sea'], ['editor:sea', 'editor:sea']],
      stackObjects: [],
    })).toThrow(/uuid/);
  });
});

describe('applyEditorMapLayoutToCity', () => {
  test('applies terrain and stack snapshots via port', () => {
    const city = {
      size: 2,
      tiles: [
        [{ terrainId: 'grass' }, { terrainId: 'grass' }],
        [{ terrainId: 'grass' }, { terrainId: 'grass' }],
      ],
    };

    const imported = [];
    applyEditorMapLayoutToCity(
      city,
      {
        id: 'c9dfa044-5c53-4446-b751-423e0e46fa6e',
        name: 'Test',
        version: 3,
        citySize: 2,
        terrain: [['editor:sea', 'nature:ground_grass'], ['editor:sea', 'editor:sea']],
        stackObjects: [{
          id: 'stack-2',
          assetId: 'nature-prop:tree_simple',
          x: 1,
          y: 0,
          rotationY: 0,
          baseLocalY: 0,
          parentId: null,
          anchor: 'terrain',
        }],
      },
      {
        resetStackObjects: () => {},
        importStackObjects: (objects) => imported.push(...objects),
      }
    );

    expect(city.tiles[0][1].terrainId).toBe('nature:ground_grass');
    expect(imported).toHaveLength(1);
    expect(imported[0].assetId).toBe('nature-prop:tree_simple');
  });
});
