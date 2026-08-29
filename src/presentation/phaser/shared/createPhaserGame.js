import Phaser from 'phaser';

/**
 * @param {HTMLElement} parent
 * @param {{
 *   backgroundColor?: string,
 *   scenes: typeof Phaser.Scene | Array<typeof Phaser.Scene>,
 * }} options
 * @returns {Phaser.Game}
 */
export function createPhaserGame(parent, { backgroundColor = '#1a3a5c', scenes }) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor,
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: '100%',
      height: '100%',
      autoCenter: Phaser.Scale.NO_CENTER,
    },
    scene: scenes,
    audio: {
      noAudio: true,
    },
  });
}
