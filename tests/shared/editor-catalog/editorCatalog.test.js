import {
  isEditorNatureTool,
  isEditorPlacementTool,
  isEditorTerrainTool,
} from '../../../src/shared/editor-catalog/editorToolIds.js';
import {
  addEditorNatureObject,
  getEditorNatureObjects,
  removeEditorNatureObjectAt,
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

  test('tracks sparse nature objects', () => {
    const entry = addEditorNatureObject('nature-prop:tree_simple', 2, 3, 0);
    expect(entry.assetId).toBe('nature-prop:tree_simple');
    expect(getEditorNatureObjects()).toHaveLength(1);

    const removed = removeEditorNatureObjectAt(2, 3);
    expect(removed?.id).toBe(entry.id);
    expect(getEditorNatureObjects()).toHaveLength(0);
  });

  test('serializeEditorLayout includes terrain matrix and nature props', () => {
    const city = {
      size: 2,
      tiles: [
        [{ terrainId: 'grass' }, { terrainId: 'nature:ground_pathStraight' }],
        [{ terrainId: 'grass' }, { terrainId: 'grass' }],
      ],
    };
    addEditorNatureObject('nature-prop:rock_smallA', 1, 0);

    const json = serializeEditorLayout(city);
    expect(json.version).toBe(1);
    expect(json.citySize).toBe(2);
    expect(json.terrain[0][1]).toBe('nature:ground_pathStraight');
    expect(json.natureObjects).toHaveLength(1);
    expect(json.natureObjects[0].assetId).toBe('nature-prop:rock_smallA');
  });
});
