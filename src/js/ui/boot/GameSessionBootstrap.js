import { registerAppService } from '../../acl/appRuntime.js';
import { getOrCreateGameSessionContext } from '../../acl/gameSession.js';
import { createGame } from '../../../presentation/three/game.js';
import { showCitySizeSelection } from './CitySizeSelectionModal.js';
import { initRealtimeBudgetPopup } from '../budget/RealtimeBudgetManager.js';
import { initBudgetStatesPopup } from '../budget/BudgetStatesManager.js';
import { initBalanceSheetPopup } from '../budget/BalanceSheetPanel.js';
import { initCityMapPopup } from '../city-map/CityMapPanel.js';
import { initLoansPopup, initLoanPaymentSystem } from '../loans/LoansManager.js';
import { initJournalPopup } from '../journal/JournalManager.js';
import { initFoodTraceabilityPopup } from '../food-traceability/FoodTraceabilityManager.js';
import { initUrbanAdviceCenter } from '../urban-advice/UrbanAdviceManager.js';

export async function bootstrapGameSession(assetManager) {
  const selectionResult = await showCitySizeSelection();
  const selectedCitySize = selectionResult.size || selectionResult;
  const multiplayerEnabled = selectionResult.multiplayer || false;
  const playerPseudo = selectionResult.pseudo || null;

  const gameSession = getOrCreateGameSessionContext();
  const game = createGame(gameSession, assetManager, selectedCitySize);

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
      registerAppService('multiplayerManager', multiplayerManager);
    } catch (error) {
      console.error('[Multiplayer] Erreur d\'activation:', error);
    }
  }

  initRealtimeBudgetPopup();
  initUrbanAdviceCenter();
  initBudgetStatesPopup();
  initCityMapPopup();
  initLoansPopup();
  initLoanPaymentSystem();
  initJournalPopup();
  initFoodTraceabilityPopup();
  initBalanceSheetPopup();

  if (typeof initAdministratorPanel === 'function') {
    initAdministratorPanel();
  }
}
