import {
  isEditorNatureTool,
  isEditorPlacementTool,
  isEditorTerrainTool,
} from '../../../src/shared/editor-catalog/editorToolIds.js';
import {
  addEditorStackObject,
  getEditorStackObjects,
  removeTopEditorStackObjectAt,
  resetEditorNatureLayout,
  serializeEditorLayout,
} from '../../../src/presentation/three/editor/editorNatureLayout.js';

describe('editorToolIds', () => {
  test('terrain tools are recognized', () => {
    expect(isEditorTerrainTool('nature:ground_grass')).toBe(true);
    expect(isEditorTerrainTool('nature:ground_pathStraight')).toBe(true);
    expect(isEditorTerrainTool('House-Blue')).toBe(false);
  });

  test('nature prop tools are recognized', () => {
    expect(isEditorNatureTool('nature-prop:tree_simple')).toBe(true);
    expect(isEditorNatureTool('nature:ground_grass')).toBe(false);
  });

  test('placement union covers both layers', () => {
    expect(isEditorPlacementTool('nature:cliff_block_stone')).toBe(true);
    expect(isEditorPlacementTool('nature-prop:rock_smallA')).toBe(true);
    expect(isEditorPlacementTool('bulldoze')).toBe(false);
  });
});

describe('editorNatureLayout', () => {
  beforeEach(() => {
    resetEditorNatureLayout();
  });

  test('tracks stacked objects at the same tile', () => {
    const first = addEditorStackObject('nature-prop:rock_smallA', 2, 3, 0, {
      baseLocalY: -0.03,
      parentId: null,
      anchor: 'terrain',
    });
    const second = addEditorStackObject('nature-prop:tree_simple', 2, 3, 0, {
      baseLocalY: 0.2,
      parentId: first.id,
      anchor: 'stack',
    });
    expect(first.parentId).toBeNull();
    expect(second.parentId).toBe(first.id);
    expect(getEditorStackObjects()).toHaveLength(2);

    const removedTop = removeTopEditorStackObjectAt(2, 3);
    expect(removedTop?.id).toBe(second.id);
    expect(getEditorStackObjects()).toHaveLength(1);

    const removedLast = removeTopEditorStackObjectAt(2, 3);
    expect(removedLast?.id).toBe(first.id);
    expect(getEditorStackObjects()).toHaveLength(0);
  });

  test('serializeEditorLayout includes stack metadata', () => {
    const city = {
      size: 2,
      tiles: [
        [{ terrainId: 'grass' }, { terrainId: 'nature:ground_pathStraight' }],
        [{ terrainId: 'grass' }, { terrainId: 'grass' }],
      ],
    };
    addEditorStackObject('nature-prop:rock_smallA', 1, 0, 0, {
      baseLocalY: -0.03,
      parentId: null,
      anchor: 'terrain',
    });

    const json = serializeEditorLayout(city);
    expect(json.version).toBe(3);
    expect(json.citySize).toBe(2);
    expect(json.terrain[0][1]).toBe('nature:ground_pathStraight');
    expect(json.stackObjects).toHaveLength(1);
    expect(json.stackObjects[0].baseLocalY).toBe(-0.03);
    expect(json.stackObjects[0].anchor).toBe('terrain');
  });
});
