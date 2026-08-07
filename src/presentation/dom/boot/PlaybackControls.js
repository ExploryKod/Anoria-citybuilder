import {
  infoObjectCloseBtn,
  infoObjectOverlay,
  pauseButton,
  pauseOverlay,
  playButton,
  replayButton,
  resetButton,
} from '../shell/nodes.js';
import { closeBuildingInfoOverlay } from '../info/layout/buildingInfoLayout.js';
import { performReset } from './ResetGameFlow.js';

/**
 * @param {{
 *   popupManager?: { forceClosePopup?: (id: string) => void, forceOpenPopup?: (id: string) => void } | null,
 *   pauseGame?: () => void,
 *   playGame?: () => void,
 *   replayGame?: () => void,
 *   getScene?: () => { controls?: { enabled: boolean }, suppressInput?: (ms: number) => void } | null,
 * }} [controlDeps]
 */
export function initPlaybackControls(controlDeps = {}) {
  const {
    popupManager = null,
    pauseGame = () => {},
    playGame = () => {},
    replayGame = () => {},
    getScene = () => null,
  } = controlDeps;

  infoObjectCloseBtn.addEventListener('click', () => {
    if (infoObjectOverlay.classList.contains('active')) {
      closeBuildingInfoOverlay(infoObjectOverlay);

      const canvas = document.querySelector('canvas');
      if (canvas) {
        canvas.classList.remove('pointer-events-disabled');
      }

      const sceneObj = getScene();
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
    popupManager?.forceClosePopup?.('pause-overlay');
    playGame();
  });

  pauseButton.addEventListener('click', () => {
    pauseOverlay.classList.add('active');
    popupManager?.forceOpenPopup?.('pause-overlay');
    pauseGame();
  });

  replayButton.addEventListener('click', () => {
    replayGame();
  });

  resetButton.addEventListener('click', () => {
    performReset();
  });
}
