import { describe, test, expect, beforeEach } from '@jest/globals';
import appRegistry from '../../../src/js/game/AppRegistry.js';
import { TimeManager } from '../../../src/js/game/utils/TimeManager.js';
import {
  getGame,
  getTimeManager,
  getTimeInfo,
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

  test('getTimeManager returns registered time manager', () => {
    const mock = { getTimeInfo: () => ({ year: 1, month: 'Janvier' }) };
    appRegistry.register('timeManager', mock);
    expect(getTimeManager()).toBe(mock);
    expect(getTimeInfo(0).year).toBe(1);
    appRegistry.register('timeManager', TimeManager);
  });
});
