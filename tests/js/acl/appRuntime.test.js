import { describe, test, expect, beforeEach } from '@jest/globals';
import appRegistry from '../../../src/js/game/AppRegistry.js';
import {
  getGame,
  registerAppService,
  pauseGame,
  playGame,
} from '../../../src/js/acl/appRuntime.js';

describe('appRuntime ACL', () => {
  beforeEach(() => {
    appRegistry.game = null;
    appRegistry.gameUI = null;
  });

  test('registerAppService stores instances on appRegistry', () => {
    const game = { pause: () => {}, play: () => {} };
    registerAppService('game', game);
    expect(getGame()).toBe(game);
  });

  test('pauseGame and playGame delegate to registered game', () => {
    const calls = [];
    registerAppService('game', {
      pause: () => calls.push('pause'),
      play: () => calls.push('play'),
    });
    pauseGame();
    playGame();
    expect(calls).toEqual(['pause', 'play']);
  });
});
