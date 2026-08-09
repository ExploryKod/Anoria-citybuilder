import {
  registerAppService,
  registerAppFunction,
  updateDisplayedFunds,
  getGameTime,
  getObjectivesManager,
  getObjectivesTracker,
  getObjectivesHistory,
  getTutorialManager,
  pauseGame,
  playGame,
  invokeStartObjectives,
  invokeStartTutorial,
} from '../../../composition/sessionShell.js';
import { getOrCreateGameSessionContext } from '../../../composition/createGameSessionContext.js';
import {
  bindSessionRuntime,
  getSessionApi,
  getSessionPopupManager,
} from '../../../composition/sessionRuntime.js';
import { waitForDatabaseReady } from '../../../core/persistence/dexie/db.js';
import { createGame } from '../../three/game.js';
import { DEFAULT_CITY_SIZE } from '../../../shared/gameplay/SimulationDefaults.js';
import {
  clearBootMode,
  clearMissionId,
  clearProfileName,
  getBootMode,
  getMissionId,
  getProfileName,
} from '../../pages/site/bootSession.js';
import { getMissionById } from '../../pages/missions/missionCatalog.js';
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
import { initAdminSections } from '../admin/initAdminSections.js';
import { bindObjectivesHistoryDeps } from '../onboarding/objectives-history.js';
import { initObjectivesPanel } from '../onboarding/ObjectivesPanel.js';
import loaderManager from '../shell/LoaderManager.js';
import { initTutorialPanel } from '../onboarding/TutorialPanel.js';

function persistCitySize(size) {
  try {
    localStorage.setItem('selectedCitySize', String(size));
    localStorage.setItem('multiplayer-enabled', 'false');
  } catch {
    /* ignore */
  }
}

function resolveBootSelection(bootMode) {
  if (bootMode === 'tutorial') {
    try {
      sessionStorage.setItem('anoria.startTutorial', '1');
    } catch {
      /* ignore */
    }
    return {
      size: DEFAULT_CITY_SIZE,
      multiplayer: false,
      pseudo: null,
      roomId: null,
      action: 'tutorial',
    };
  }

  if (bootMode === 'mission') {
    const mission = getMissionById(getMissionId() ?? '');
    const profileName = getProfileName();
    clearMissionId();
    clearProfileName();
    return {
      size: mission.citySize,
      multiplayer: false,
      pseudo: profileName || null,
      roomId: null,
      action: 'mission',
      missionId: mission.id,
    };
  }

  return {
    size: DEFAULT_CITY_SIZE,
    multiplayer: false,
    pseudo: null,
    roomId: null,
    action: 'solo',
  };
}

export async function bootstrapGameSession(assetManager) {
  await waitForDatabaseReady();

  loaderManager.show();

  const bootMode = getBootMode();
  const selectionResult = resolveBootSelection(bootMode);
  persistCitySize(selectionResult.size);

  clearBootMode();
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

  await initAdminSections({
    ...panelDeps,
    commerce: sessionApi.commerce,
    employment: sessionApi.employment,
    registerAppService,
    registerAppFunction,
    updateDisplayedFunds,
    getGameTime,
  });

  bindObjectivesHistoryDeps({
    accounting: sessionApi.accounting,
    getObjectivesManager,
    registerAppService,
  });
  initObjectivesPanel({
    accounting: sessionApi.accounting,
    pauseGame,
    playGame,
    registerAppService,
    registerAppFunction,
    getObjectivesTracker,
    getObjectivesHistory,
    getObjectivesManager,
    invokeStartObjectives,
  });
  initTutorialPanel({
    pauseGame,
    playGame,
    registerAppService,
    registerAppFunction,
    getTutorialManager,
    invokeStartTutorial,
  });

  registerAppFunction('updateBudgetDisplay', updateBudgetDisplay);
  registerAppFunction('refreshBudgetStatesModal', refreshBudgetStatesModal);
  registerAppFunction('generateCarteVille', generateCarteVille);
}
