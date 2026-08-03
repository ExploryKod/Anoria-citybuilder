import { describe, test, expect } from '@jest/globals';
import {
  cycleStonePathOrientationIndex,
  isStonePathTool,
  stonePathOrientationIndex,
  stonePathOrientationLabel,
  stonePathTypeForIndex,
} from '../../../src/contexts/construction/domain/policies/StonePathOrientationPolicy.js';

describe('StonePathOrientationPolicy', () => {
  test('recognizes stone path tools', () => {
    expect(isStonePathTool('StonePath-001')).toBe(true);
    expect(isStonePathTool('roads')).toBe(false);
  });

  test('cycles between two orientations only', () => {
    expect(cycleStonePathOrientationIndex(0)).toBe(1);
    expect(cycleStonePathOrientationIndex(1)).toBe(0);
    expect(stonePathTypeForIndex(0)).toBe('StonePath-001');
    expect(stonePathTypeForIndex(1)).toBe('StonePath-Right-001');
  });

  test('maps legacy left/right to perpendicular index', () => {
    expect(stonePathOrientationIndex('StonePath-Left-001')).toBe(1);
    expect(stonePathOrientationIndex('StonePath-Cross-001')).toBe(0);
  });

  test('labels orientations', () => {
    expect(stonePathOrientationLabel(0)).toContain('Horizontal');
    expect(stonePathOrientationLabel(1)).toContain('Vertical');
  });
});
