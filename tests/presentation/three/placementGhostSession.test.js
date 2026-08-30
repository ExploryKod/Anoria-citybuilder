import { describe, expect, test } from '@jest/globals';
import {
  isPlaceableBuildingTool,
  supportsPlacementGhostRotation,
} from '../../../src/presentation/three/placementGhostSession.js';

describe('placementGhostSession helpers', () => {
  const catalog = { 'House-Blue': { gridSize: 1 } };

  test('supportsPlacementGhostRotation for buildings and editor tools', () => {
    expect(supportsPlacementGhostRotation('House-Blue', catalog)).toBe(true);
    expect(supportsPlacementGhostRotation('nature:ground_grass', catalog, {
      isEditorPlacementTool: (id) => id.startsWith('nature:'),
    })).toBe(true);
    expect(supportsPlacementGhostRotation('bulldoze', catalog)).toBe(false);
    expect(supportsPlacementGhostRotation('select-object', catalog)).toBe(false);
  });

  test('isPlaceableBuildingTool excludes utility tools', () => {
    expect(isPlaceableBuildingTool('House-Blue', catalog)).toBe(true);
    expect(isPlaceableBuildingTool('bulldoze', catalog)).toBe(false);
  });
});
