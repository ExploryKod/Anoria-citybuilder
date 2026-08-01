import {
  registerAppService,
  registerAppFunction,
} from '../../../composition/sessionShell.js';
import { getOrCreateGameSessionContext } from '../../../composition/createGameSessionContext.js';
import {
  bindSessionRuntime,
  getSessionApi,
  getSessionPopupManager,
} from '../../../composition/sessionRuntime.js';
import { waitForDatabaseReady } from '../../../core/persistence/dexie/db.js';
import { createGame } from '../../three/game.js';
import { showCitySizeSelection } from './CitySizeSelectionModal.js';
import {
  initTresoreriePopup,
} from '../compta/tresorerie/TresoreriePanel.js';
import {
  initBudgetStatesPopup,
  refreshBudgetStatesModal,
} from '../compta/compte-de-resultat/CompteDeResultatPanel.js';
import {
  initBilanPopup,
  updateBudgetDisplay,
} from '../compta/bilan/BilanPanel.js';
import {
  initCarteVillePopup,
  generateCarteVille,
} from '../carte-ville/CarteVillePanel.js';
import {
  initLoansPopup,
  initLoanPaymentSystem,
} from '../compta/prets/PretsPanel.js';
import { initJournalPopup } from '../compta/journal/JournalPanel.js';
import { initFoodTraceabilityPopup } from '../admin/food-traceability/FoodTraceabilityPanel.js';

export async function bootstrapGameSession(assetManager) {
  await waitForDatabaseReady();

  const selectionResult = await showCitySizeSelection();
  const selectedCitySize = selectionResult.size || selectionResult;
  const multiplayerEnabled = selectionResult.multiplayer || false;
  const playerPseudo = selectionResult.pseudo || null;

  const gameSession = getOrCreateGameSessionContext();
  const game = createGame(gameSession, assetManager, selectedCitySize);

  bindSessionRuntime({ game });

  if (
    multiplayerEnabled &&
    playerPseudo &&
    (selectionResult.action === 'create' || selectionResult.action === 'join')
  ) {
    try {
      const { getMultiplayerManager } = await import('../../../infrastructure/multiplayer/MultiplayerManager.js');
      const multiplayerManager = getMultiplayerManager(game, game.scene);

      const action = selectionResult.action;
      let roomIdOrCitySize;
      let roomName = null;
      if (action === 'join' && selectionResult.roomId) {
        roomIdOrCitySize = selectionResult.roomId;
      } else if (action === 'create') {
        roomIdOrCitySize = selectedCitySize;
        roomName = selectionResult.roomName || null;
      }

      const getWebSocketUrl = (await import('../../../config/websocket.js')).default;
      const wsUrl = getWebSocketUrl();

      await multiplayerManager.enable(wsUrl, playerPseudo, roomIdOrCitySize, action, roomName);
      bindSessionRuntime({ multiplayerManager });
      registerAppService('multiplayerManager', multiplayerManager);
    } catch (error) {
      console.error('[Multiplayer] Erreur d\'activation:', error);
    }
  }

  const sessionApi = getSessionApi();
  if (!sessionApi) {
    throw new Error('sessionApi is not bound after createGame');
  }

  const popupManager = getSessionPopupManager();
  const panelDeps = {
    accounting: sessionApi.accounting,
    construction: sessionApi.construction,
    housing: sessionApi.housing,
    supply: sessionApi.supply,
    parcels: sessionApi.parcels,
    popupManager,
    gameStore: gameSession,
    getCity: () => game.city ?? null,
  };

  initTresoreriePopup(panelDeps);
  initBilanPopup(panelDeps);
  initBudgetStatesPopup(panelDeps);
  initJournalPopup(panelDeps);
  initCarteVillePopup(panelDeps);
  initLoansPopup({
    accounting: sessionApi.accounting,
    popupManager,
    updateBudgetDisplay,
  });
  initLoanPaymentSystem({
    bindProcessLoanPayments: (fn) => bindSessionRuntime({ processLoanPayments: fn }),
    registerHandler: registerAppFunction,
  });
  initFoodTraceabilityPopup({ supply: sessionApi.supply });

  registerAppFunction('updateBudgetDisplay', updateBudgetDisplay);
  registerAppFunction('refreshBudgetStatesModal', refreshBudgetStatesModal);
  registerAppFunction('generateCarteVille', generateCarteVille);
}
