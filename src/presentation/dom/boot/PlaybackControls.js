import {
  exportAllButton,
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
import { exportCityToJSON } from '../carte-ville/CarteVillePanel.js';
import { exportJournalToJSON } from '../compta/journal/JournalPanel.js';
import { exportTransactionsToJSON } from '../admin/supply-traceability/SupplyTraceabilityPanel.js';
import { exportRelationsToJSON } from '../admin/commerce/CommerceSectionPresenter.js';
import { getSessionGameTime, getSessionService } from '../../../composition/sessionRuntime.js';

/**
 * Downloads, one after the other, the five files a starter city is made of (the city, the journal of the hamlet, the flux of the companies and
 * the houses, the supply transactions, the trade relations), all read at the turn the game is paused on. If the turn moves while they are
 * written (a day that was still running when the pause was pressed), the files do not belong together: the player is told, nothing is passed off as a set.
 */
async function downloadEveryExport() {
  const trade = getSessionService('trade');
  if (!trade) throw new Error('[export] the trade service is not bound: the relations cannot be exported');
  const turnAtStart = getSessionGameTime();
  await exportCityToJSON();
  await exportJournalToJSON('city');
  await exportJournalToJSON('private');
  await exportTransactionsToJSON();
  await exportRelationsToJSON(trade);
  const turnAtEnd = getSessionGameTime();
  if (turnAtEnd !== turnAtStart) {
    throw new Error(`[export] the turn moved from ${turnAtStart} to ${turnAtEnd} while the files were written: they are not one moment of the game, download them again`);
  }
}

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
    pauseOverlay.setAttribute('inert', '');
    pauseOverlay.setAttribute('aria-hidden', 'true');
    popupManager?.forceClosePopup?.('pause-overlay');
    playGame();
  });

  pauseButton.addEventListener('click', () => {
    pauseOverlay.classList.add('active');
    pauseOverlay.removeAttribute('inert');
    pauseOverlay.setAttribute('aria-hidden', 'false');
    popupManager?.forceOpenPopup?.('pause-overlay');
    pauseGame();
  });

  exportAllButton.addEventListener('click', () => {
    exportAllButton.disabled = true;
    downloadEveryExport()
      .catch((error) => {
        console.error('[export] the files could not all be downloaded:', error);
        alert(error.message);
      })
      .finally(() => {
        exportAllButton.disabled = false;
      });
  });

  replayButton.addEventListener('click', () => {
    replayGame();
  });

  resetButton.addEventListener('click', () => {
    performReset();
  });
}
