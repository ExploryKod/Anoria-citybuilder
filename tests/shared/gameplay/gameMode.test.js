/**
 * @jest-environment jsdom
 */

import { describe, expect, test, beforeEach } from '@jest/globals';
import {
  GAME_MODES,
  clearGameMode,
  gameModeFromBootAction,
  getGameMode,
  isEditorMode,
  setGameMode,
} from '../../../src/shared/gameplay/gameMode.js';
import { getBootMode, setBootMode, clearBootMode } from '../../../src/presentation/pages/site/bootSession.js';

describe('gameMode', () => {
  beforeEach(() => {
    clearGameMode();
    clearBootMode();
  });

  test('persists editor mode in session', () => {
    setGameMode(GAME_MODES.EDITOR);
    expect(getGameMode()).toBe(GAME_MODES.EDITOR);
    expect(isEditorMode()).toBe(true);
  });

  test('maps boot action to game mode', () => {
    expect(gameModeFromBootAction('editor')).toBe(GAME_MODES.EDITOR);
    expect(gameModeFromBootAction('mission')).toBe(GAME_MODES.MISSION);
    expect(gameModeFromBootAction('tutorial')).toBe(GAME_MODES.TUTORIAL);
    expect(gameModeFromBootAction('solo')).toBe(GAME_MODES.SOLO);
  });
});

describe('bootSession editor mode', () => {
  beforeEach(() => {
    clearBootMode();
  });

  test('accepts editor boot mode from menu', () => {
    setBootMode('editor');
    expect(getBootMode()).toBe('editor');
  });
});
