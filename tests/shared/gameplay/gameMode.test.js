/**
 * @jest-environment jsdom
 */

import { describe, expect, test, beforeEach } from '@jest/globals';
import {
  GAME_MODES,
  clearGameMode,
  gameModeFromBootAction,
  gameModeFromBootMode,
  getGameMode,
  hasStoredGameMode,
  isEditorMode,
  setGameMode,
} from '../../../src/shared/gameplay/gameMode.js';
import {
  clearBootMode,
  consumeBootMode,
  getBootMode,
  isGameEntryAllowed,
  isWorldEntryAllowed,
  setBootMode,
} from '../../../src/presentation/pages/site/bootSession.js';

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

  test('maps boot mode to game mode', () => {
    expect(gameModeFromBootMode('editor')).toBe(GAME_MODES.EDITOR);
    expect(gameModeFromBootMode('mission')).toBe(GAME_MODES.MISSION);
    expect(gameModeFromBootMode('tutorial')).toBe(GAME_MODES.TUTORIAL);
    expect(gameModeFromBootMode('new')).toBe(GAME_MODES.SOLO);
    expect(gameModeFromBootMode('load')).toBe(GAME_MODES.SOLO);
  });
});

describe('bootSession map mode entry', () => {
  beforeEach(() => {
    clearGameMode();
    clearBootMode();
  });

  test('menu sets pending boot mode', () => {
    setBootMode('editor');
    expect(getBootMode()).toBe('editor');
  });

  test('consumeBootMode clears intent and returns null when none pending', () => {
    expect(consumeBootMode()).toBe(null);
    expect(getBootMode()).toBe(null);
  });

  test('refresh does not reset editor session when no boot intent', () => {
    setGameMode(GAME_MODES.EDITOR);
    const bootMode = consumeBootMode();
    expect(bootMode).toBe(null);
    expect(getGameMode()).toBe(GAME_MODES.EDITOR);
  });

  test('explicit menu entry overwrites session game mode', () => {
    setGameMode(GAME_MODES.EDITOR);
    setBootMode('new');
    const bootMode = consumeBootMode();
    expect(bootMode).toBe('new');
    if (bootMode !== null) {
      setGameMode(gameModeFromBootMode(bootMode));
    }
    expect(getGameMode()).toBe(GAME_MODES.SOLO);
  });

  test('editor enters through the same boot path as tutorial', () => {
    setBootMode('editor');
    expect(isGameEntryAllowed()).toBe(true);
    const bootMode = consumeBootMode();
    expect(bootMode).toBe('editor');
    if (bootMode !== null) {
      setGameMode(gameModeFromBootMode(bootMode));
    }
    expect(getGameMode()).toBe(GAME_MODES.EDITOR);
  });

  test('hasStoredGameMode reflects session key', () => {
    expect(hasStoredGameMode()).toBe(false);
    setGameMode(GAME_MODES.SOLO);
    expect(hasStoredGameMode()).toBe(true);
  });

  test('direct /game access is not allowed without entry intent', () => {
    window.history.replaceState(null, '', '/game');
    expect(isGameEntryAllowed()).toBe(false);
  });

  test('refresh stays allowed when session has a map mode', () => {
    setGameMode(GAME_MODES.EDITOR);
    window.history.replaceState(null, '', '/game');
    expect(isGameEntryAllowed()).toBe(true);
  });

  test('query string does not grant entry', () => {
    window.history.replaceState(null, '', '/game?mode=editor');
    expect(isGameEntryAllowed()).toBe(false);
    expect(getBootMode()).toBe(null);
  });
});

describe('bootSession world map entry', () => {
  beforeEach(() => {
    clearGameMode();
    clearBootMode();
  });

  test('direct /world access is not allowed without a game session', () => {
    window.history.replaceState(null, '', '/world');
    expect(isWorldEntryAllowed()).toBe(false);
  });

  test('world map is allowed after entering the game', () => {
    setGameMode(GAME_MODES.EDITOR);
    expect(isWorldEntryAllowed()).toBe(true);
  });

  test('world map is allowed for tutorial and solo sessions', () => {
    setGameMode(GAME_MODES.TUTORIAL);
    expect(isWorldEntryAllowed()).toBe(true);
    setGameMode(GAME_MODES.SOLO);
    expect(isWorldEntryAllowed()).toBe(true);
  });
});
