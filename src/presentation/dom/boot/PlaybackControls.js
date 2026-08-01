import {
  infoObjectCloseBtn,
  infoObjectOverlay,
  pauseButton,
  pauseOverlay,
  playButton,
  replayButton,
  resetButton,
} from '../shell/nodes.js';
import {
  getPopupManager,
  pauseGame,
  playGame,
  replayGame,
} from '../../../composition/facades/appRuntime.js';
import { getSessionScene } from '../../../composition/sessionRuntime.js';
import { initResetGameFlow } from './ResetGameFlow.js';

export function initPlaybackControls() {
  infoObjectCloseBtn.addEventListener('click', () => {
    if (infoObjectOverlay.classList.contains('active')) {
      infoObjectOverlay.classList.remove('active');

      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.classList.remove('pointer-events-disabled');
      }

      const sceneObj = getSessionScene();
      if (sceneObj?.controls) {
        sceneObj.controls.enabled = true;
      }
      if (sceneObj?.suppressInput) {
        sceneObj.suppressInput(200);
      }

      playGame();
    }
  });

  playButton.addEventListener('click', () => {
    pauseOverlay.classList.remove('active');
    getPopupManager()?.forceClosePopup('pause-overlay');
    playGame();
  });

  pauseButton.addEventListener('click', () => {
    pauseOverlay.classList.add('active');
    getPopupManager()?.forceOpenPopup('pause-overlay');
    pauseGame();
  });

  replayButton.addEventListener('click', () => {
    replayGame();
  });

  resetButton.addEventListener('click', () => {
    initResetGameFlow();
  });
}
