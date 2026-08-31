/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  setMissionMapLayoutId,
  getMissionMapLayoutId,
  isCustomMapLayoutActive,
  clearMissionMapLayout,
} from '../../../src/shared/gameplay/customMapLayout.js';

describe('customMapLayout session', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  test('persists mission map id for the session', () => {
    setMissionMapLayoutId('c9dfa044-5c53-4446-b751-423e0e46fa6e');
    expect(getMissionMapLayoutId()).toBe('c9dfa044-5c53-4446-b751-423e0e46fa6e');
    expect(isCustomMapLayoutActive()).toBe(true);
  });

  test('clearMissionMapLayout resets custom map flags', () => {
    setMissionMapLayoutId('map-a');
    clearMissionMapLayout();
    expect(getMissionMapLayoutId()).toBeNull();
    expect(isCustomMapLayoutActive()).toBe(false);
  });
});
