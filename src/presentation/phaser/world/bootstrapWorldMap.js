import { createPhaserGame } from '../shared/createPhaserGame.js';
import { WORLD_HEX_SCENE_KEY, WorldHexScene } from './WorldHexScene.js';

import { setPendingWorldBootstrap } from './worldMapBootstrapState.js';

/**
 * @param {HTMLElement} parent
 * @param {{
 *   view: object,
 *   selectedCityId?: string | null,
 *   selectedHamletId?: string | null,
 *   onCitySelected?: (cityId: string) => void,
 *   onHamletSelected?: (hamletId: string) => void,
 * }} options
 */
export function bootstrapWorldMap(parent, options) {
  setPendingWorldBootstrap(options);

  const game = createPhaserGame(parent, {
    scenes: WorldHexScene,
  });

  return {
    game,
    getScene: () => game.scene.getScene(WORLD_HEX_SCENE_KEY),
    refresh(view, selection) {
      const scene = game.scene.getScene(WORLD_HEX_SCENE_KEY);
      scene?.refresh?.(view, selection);
    },
    destroy() {
      game.destroy(true);
    },
  };
}
