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
  getSessionService,
  updateSessionDisplayedFunds,
} from '../../../composition/sessionRuntime.js';
import { clearGameTablesForNewGame, waitForDatabaseReady } from '../../../core/persistence/dexie/db.js';
import { importPrefab } from '../../../core/persistence/prefab/importPrefab.js';
import { getPrefab, START_PREFAB_ID } from '../../../shared/prefabs/prefabCatalog.js';
import { ensureHamletCatalog, listHamlets, parseGameHamletPath } from '../../../core/persistence/hamlet/hamletSession.js';
import { initGameCalendar } from '../../../config/events.js';
import { createGame } from '../../three/game.js';
import { DEFAULT_CITY_SIZE } from '../../../shared/gameplay/SimulationDefaults.js';
import {
  clearMissionId,
  clearProfileName,
  consumeBootMode,
  isFreshGameIntent,
  getMissionId,
  getProfileName,
  redirectToLandingUnlessEntryAllowed,
} from '../../pages/site/bootSession.js';
import { getMissionById } from '../../pages/missions/missionCatalog.js';
import { loadEditorMapLayout } from '../../../contexts/world-layout/application/queries/LoadEditorMapLayout.js';
import { getEditorMapRepository } from '../../../composition/editorMapRepository.js';
import { setMissionMapLayoutId, getMissionMapLayoutId, clearMissionMapLayout } from '../../../shared/gameplay/customMapLayout.js';
import {
  gameModeFromBootMode,
  isEditorMode,
  setGameMode,
} from '../../../shared/gameplay/gameMode.js';
import { applyEditorModeUi } from '../editor/applyEditorModeUi.js';
import {
  initCarteVillePopup,
  generateCarteVille,
} from '../carte-ville/CarteVillePanel.js';
import {
  initLoansPopup,
  initLoanPaymentSystem,
} from '../compta/prets/PretsPanel.js';
import { initJournalPopup } from '../compta/journal/JournalPanel.js';
import { initSupplyTraceabilityPopup } from '../admin/supply-traceability/SupplyTraceabilityPanel.js';
import { initAdminSections } from '../admin/initAdminSections.js';
import { initNewsEventModal } from '../intelligence/NewsEventModal.js';
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
    clearMissionMapLayout();
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
    const mapLayoutId = getMissionMapLayoutId();
    clearMissionId();
    clearProfileName();
    return {
      size: mission.citySize,
      multiplayer: false,
      pseudo: profileName || null,
      roomId: null,
      action: 'mission',
      missionId: mission.id,
      mapLayoutId,
    };
  }

  if (bootMode === 'prefab') {
    clearMissionMapLayout();
    return {
      size: getPrefab(START_PREFAB_ID).citySize,
      multiplayer: false,
      pseudo: null,
      roomId: null,
      action: 'prefab',
    };
  }

  if (bootMode === 'editor') {
    clearMissionMapLayout();
    return {
      size: DEFAULT_CITY_SIZE,
      multiplayer: false,
      pseudo: null,
      roomId: null,
      action: 'editor',
    };
  }

  if (bootMode === 'new' || bootMode === 'load') {
    clearMissionMapLayout();
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
  if (redirectToLandingUnlessEntryAllowed()) {
    return;
  }

  // Shown until the game is ready: the database reset, the hamlets and the scene all happen under it.
  loaderManager.show('Préparation de la partie…');
  await waitForDatabaseReady();

  // Map mode: session is runtime SoT. Write only on explicit menu entry (consumeBootMode).
  const bootMode = consumeBootMode();
  // Any menu choice but a reload of a saved game starts from an empty database.
  const startsFromScratch = bootMode !== null && bootMode !== 'load';
  if (bootMode !== null) {
    setGameMode(gameModeFromBootMode(bootMode));
  }
  // A menu choice of a new game (new, tutorial, mission, editor, prefab) starts from an empty database.
  if (startsFromScratch) {
    loaderManager.setStep('Remise à zéro de la partie…');
    await clearGameTablesForNewGame();
  }
  if (bootMode === 'prefab') {
    loaderManager.setStep('Chargement de la sauvegarde…');
    await importPrefab(getPrefab(START_PREFAB_ID));
  }

  // Before any context is built: the game's calendar is loaded here (frozen from the pre-game choice on a new game).
  loaderManager.setStep('Chargement du calendrier…');
  await initGameCalendar();
  // The hamlets exist before any reader runs (the treasury and the panels file their rows under the active hamlet).
  // A new game starts at the starting hamlet; a reload keeps the hamlet its URL names.
  const isNewGame = isFreshGameIntent();
  loaderManager.setStep('Création des hameaux…');
  const activeHamletId = await ensureHamletCatalog({
    requestedId: isNewGame ? null : parseGameHamletPath(window.location.pathname),
  });
  // The address names the active hamlet before the game exists: the game never starts on a bare /game.
  if (parseGameHamletPath(window.location.pathname) !== activeHamletId) {
    window.history.replaceState(null, '', `/game/${activeHamletId}`);
  }
  if (parseGameHamletPath(window.location.pathname) !== activeHamletId) {
    throw new Error(`[bootstrap] the address does not name the active hamlet ${activeHamletId}: the game does not start`);
  }

  const selectionResult = resolveBootSelection(bootMode ?? 'new');
  if (!Number.isInteger(selectionResult.size) || selectionResult.size <= 0) {
    throw new Error(`[bootstrap] the boot selection "${selectionResult.action}" gives no city size`);
  }
  let selectedCitySize = selectionResult.size;

  if (selectionResult.mapLayoutId) {
    setMissionMapLayoutId(selectionResult.mapLayoutId);
    try {
      const layout = await loadEditorMapLayout(
        getEditorMapRepository(),
        selectionResult.mapLayoutId
      );
      selectedCitySize = layout.citySize;
    } catch (error) {
      console.error('[Bootstrap] Failed to resolve custom map size:', error);
    }
  }

  persistCitySize(selectedCitySize);
  const multiplayerEnabled = selectionResult.multiplayer || false;
  const playerPseudo = selectionResult.pseudo || null;

  loaderManager.setStep('Mise en place de la ville…');
  const gameSession = getOrCreateGameSessionContext();
  const game = createGame(gameSession, assetManager, selectedCitySize);

  bindSessionRuntime({ game });

  // Dev only: console commands that hand a diagnostic to the dev server (see composition/devDiagnostics.js).
  if (import.meta.env.DEV) {
    import('../../../composition/devDiagnostics.js').then(({ registerDevDiagnostics }) =>
      registerDevDiagnostics({ getScene: () => game.scene })
    );
  }

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
  sessionApi.accounting.ensureCustomsRate();
  // Every hamlet carries its fiscal rates (written once, at creation): a hamlet unlocked later already has them.
  for (const hamlet of await listHamlets()) {
    await sessionApi.accounting.ensureHamletFiscalRates(hamlet.id);
  }

  const popupManager = getSessionPopupManager();
  const panelDeps = {
    accounting: sessionApi.accounting,
    construction: sessionApi.construction,
    housing: sessionApi.housing,
    supply: sessionApi.supply,
    parcels: sessionApi.parcels,
    employment: sessionApi.employment,
    intelligence: sessionApi.intelligence,
    trade: getSessionService('trade') ?? null,
    popupManager,
    gameStore: gameSession,
    getCity: () => game.city ?? null,
  };

  initJournalPopup(panelDeps);
  initCarteVillePopup(panelDeps);
  initLoansPopup({
    accounting: sessionApi.accounting,
    popupManager,
    updateTreasuryDisplay: async () => {
      const { funds } = await sessionApi.accounting.getTreasurySnapshot();
      updateSessionDisplayedFunds(funds);
    },
  });
  initLoanPaymentSystem({
    bindProcessLoanPayments: (fn) => bindSessionRuntime({ processLoanPayments: fn }),
    registerHandler: registerAppFunction,
  });
  initSupplyTraceabilityPopup({ supply: sessionApi.supply });

  if (sessionApi.intelligence) {
    initNewsEventModal({
      intelligence: sessionApi.intelligence,
      getGameTime,
      popupManager,
      registerAppService,
    });
  }

  await initAdminSections({
    ...panelDeps,
    employment: sessionApi.employment,
    intelligence: sessionApi.intelligence,
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

  if (isEditorMode()) {
    applyEditorModeUi();
    pauseGame();
  }

  registerAppFunction('generateCarteVille', generateCarteVille);
}
