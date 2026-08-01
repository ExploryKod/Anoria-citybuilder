import { registerAppService } from '../../js/acl/appRuntime.js';
import { getOrCreateGameSessionContext } from '../../js/acl/gameSession.js';
import { waitForDatabaseReady } from '../../core/persistence/dexie/db.js';
import { createGame } from '../../presentation/three/game.js';
import { showCitySizeSelection } from './CitySizeSelectionModal.js';
import { initTresoreriePopup } from '../compta/tresorerie/TresoreriePanel.js';
import { initBudgetStatesPopup } from '../compta/compte-de-resultat/CompteDeResultatPanel.js';
import { initBilanPopup } from '../compta/bilan/BilanPanel.js';
import { initCarteVillePopup } from '../carte-ville/CarteVillePanel.js';
import { initLoansPopup, initLoanPaymentSystem } from '../compta/prets/PretsPanel.js';
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

  if (
    multiplayerEnabled &&
    playerPseudo &&
    (selectionResult.action === 'create' || selectionResult.action === 'join')
  ) {
    try {
      const { getMultiplayerManager } = await import('../../infrastructure/multiplayer/MultiplayerManager.js');
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

      const getWebSocketUrl = (await import('../../config/websocket.js')).default;
      const wsUrl = getWebSocketUrl();

      await multiplayerManager.enable(wsUrl, playerPseudo, roomIdOrCitySize, action, roomName);
      registerAppService('multiplayerManager', multiplayerManager);
    } catch (error) {
      console.error('[Multiplayer] Erreur d\'activation:', error);
    }
  }

  initTresoreriePopup();
  initBudgetStatesPopup();
  initCarteVillePopup();
  initLoansPopup();
  initLoanPaymentSystem();
  initJournalPopup();
  initFoodTraceabilityPopup();
  initBilanPopup();
}
