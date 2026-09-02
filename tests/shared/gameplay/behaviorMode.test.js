import { describe, expect, test } from '@jest/globals';
import {
  BEHAVIOR_MODE,
  ERASE_TOOL_ID,
  SELECT_TOOL_ID,
  isBuildBehaviorMode,
  isEraseBehaviorMode,
  isSelectBehaviorMode,
  resolveBehaviorMode,
  shouldReturnToSelectOnEscape,
} from '../../../src/shared/gameplay/behaviorMode.js';

const isPlacementTool = (toolId) =>
  toolId === 'House-Blue'
  || toolId === 'nature:ground_grass'
  || toolId === 'nature-prop:tree_oak';

describe('behaviorMode', () => {
  test('maps toolbar ids to behavior modes', () => {
    expect(resolveBehaviorMode(SELECT_TOOL_ID, { isPlacementTool })).toBe(BEHAVIOR_MODE.SELECT);
    expect(resolveBehaviorMode(ERASE_TOOL_ID, { isPlacementTool })).toBe(BEHAVIOR_MODE.ERASE);
    expect(resolveBehaviorMode('House-Blue', { isPlacementTool })).toBe(BEHAVIOR_MODE.BUILD);
    expect(resolveBehaviorMode('nature:ground_grass', { isPlacementTool })).toBe(BEHAVIOR_MODE.BUILD);
    expect(resolveBehaviorMode('nature-prop:tree_oak', { isPlacementTool })).toBe(BEHAVIOR_MODE.BUILD);
  });

  test('unknown tool ids default to select behavior', () => {
    expect(resolveBehaviorMode('bilan', { isPlacementTool })).toBe(BEHAVIOR_MODE.SELECT);
    expect(resolveBehaviorMode('', { isPlacementTool })).toBe(BEHAVIOR_MODE.SELECT);
  });

  test('escape returns to select from build or erase only', () => {
    expect(shouldReturnToSelectOnEscape(SELECT_TOOL_ID, { isPlacementTool })).toBe(false);
    expect(shouldReturnToSelectOnEscape(ERASE_TOOL_ID, { isPlacementTool })).toBe(true);
    expect(shouldReturnToSelectOnEscape('House-Blue', { isPlacementTool })).toBe(true);
    expect(shouldReturnToSelectOnEscape('nature:ground_grass', { isPlacementTool })).toBe(true);
    expect(shouldReturnToSelectOnEscape('bilan', { isPlacementTool })).toBe(false);
  });

  test('predicate helpers', () => {
    expect(isSelectBehaviorMode(SELECT_TOOL_ID, { isPlacementTool })).toBe(true);
    expect(isBuildBehaviorMode('House-Blue', { isPlacementTool })).toBe(true);
    expect(isEraseBehaviorMode(ERASE_TOOL_ID, { isPlacementTool })).toBe(true);
  });
});
