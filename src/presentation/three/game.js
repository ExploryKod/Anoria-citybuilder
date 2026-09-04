/**
 * Game session facade — interaction + GameLoop API.
 * Context / treasury / tick wiring live in composition/.
 */

import {
  registerAppService,
  getMultiplayerManager,
  invokeStartTutorial,
  getObjectivesManager,
  getButtonStateManager,
  isEditorMode,
} from '../../composition/sessionShell.js';
import {
  getMissionMapLayoutId,
  isCustomMapLayoutActive,
  setCustomMapLayoutActive,
} from '../../shared/gameplay/customMapLayout.js';
import { loadEditorMapLayout } from '../../contexts/world-layout/application/queries/LoadEditorMapLayout.js';
import { applyEditorMapLayoutToCity } from '../../contexts/world-layout/application/services/ApplyEditorMapLayoutToCity.js';
import { createEditorNatureStackLayoutPort } from '../../contexts/world-layout/infrastructure/adapters/presentation/EditorNatureStackLayoutAdapter.js';
import { getEditorMapRepository } from '../../composition/editorMapRepository.js';
import { createScene } from './scene.js';
import { createCity, clearCityTiles, initializeEditorCityTiles } from './city.js';
import { syncEmploymentAfterBuildingChange } from '../../composition/syncEmploymentAfterBuildingChange.js';
import { syncSupplyLinksAfterBuildingChange } from '../../composition/syncSupplyLinksAfterBuildingChange.js';
import { refreshSupplyPlacementIndex } from '../../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';
import { ensureGameRuntimeBootstrapped } from '../../composition/ensureGameRuntimeBootstrapped.js';
import { bootGameContexts } from '../../composition/bootGameContexts.js';
import { bootTreasuryHud } from '../../composition/bootTreasuryHud.js';
import { resolveSelectedCitySize } from '../../composition/resolveCitySize.js';
import { hydrateCityTilesFromRows } from '../../contexts/construction/application/services/HydrateCityTilesFromBuildings.js';
import {
  ensureHamletCatalog,
  getActiveHamletId,
  getHamlet,
  markHamletNatureSeeded,
  setActiveHamletId,
} from '../../core/persistence/hamlet/hamletSession.js';
import { HAMLET_ACCESS_CHANGED_EVENT, canTravelToHamlet } from '../../core/persistence/hamlet/hamletAccess.js';
import { runGameTick } from '../../composition/runGameTick.js';
import { presentIncomingNewsEvents } from '../dom/intelligence/NewsEventModal.js';
import { bindSessionRuntime } from '../../composition/sessionRuntime.js';
import { syncSessionHud } from '../../composition/syncSessionHud.js';
import { resetCumulativeDeaths } from '../../composition/gameplayMortalityState.js';
import { notifyBudgetCleanupIfNeeded } from '../dom/compta/tresorerie/CleanupNotificationPresenter.js';
import {
  disableGatedPlacementTools,
  refreshSkillPlacementGating,
} from '../dom/shell/SkillPlacementGating.js';
import {
  BEHAVIOR_MODE,
  resolveBehaviorMode,
  shouldReturnToSelectOnEscape,
} from '../../shared/gameplay/behaviorMode.js';
import { DEFAULT_TICK_MS, snapTickMs } from '../../shared/gameplay/SimulationDefaults.js';
import { GameLoop } from '../../engine/loop/GameLoop.js';
import {
  overOverlay,
  infoObjectOverlay,
  infoObjectCloseBtn,
} from '../dom/shell/nodes.js';
import { closeBuildingInfoOverlay } from '../dom/info/layout/buildingInfoLayout.js';
import { activateSelectToolButton, closeModal } from '../dom/tools/ToolPanel.js';
import { close as closeMobileBuildBar } from '../dom/tools/MobileCompactToolbar.js';
import { close as closeEditorBuildBar } from '../dom/editor/EditorNatureToolbar.js';
import loaderManager from '../dom/shell/LoaderManager.js';
import objectivesTracker, {
  bindObjectivesTrackerDeps,
} from '../dom/onboarding/ObjectivesTracker.js';
import InputManager from './InputManager.js';
import gameUI, {
  bindGameUIDeps,
} from '../dom/shell/GameUI.js';
import {
  playBulldozeSound,
  playPlaceBuildingSound,
} from '../audio/SoundEffects.js';
import { popupManager } from '../dom/shell/PopupManager.js';
import {
  showInsufficientFundsNotification,
  showGenericErrorNotification,
  showWindmillCascadeNotification,
} from '../dom/shell/BuildingNotifications.js';
import { showErrorToast } from '../dom/shell/ToastNotifier.js';
import { presentBuildingInfoSelection } from '../dom/info/presenters/useBuildingInfoSelection.js';
import { buildingPlacementCatalog } from '../../shared/building-catalog/index.js';
import {
  createPlacementGhostSession,
  isPlaceableBuildingTool,
} from './placementGhostSession.js';
import {
  isEditorNatureTool,
  isEditorPlacementTool,
  isEditorTerrainTool,
} from '../../shared/editor-catalog/editorToolIds.js';
import {
  isEditorRiverAsset,
  resolveRiverMountFromRotationStep,
} from '../../shared/editor-catalog/editorKenneyAssetBehavior.js';
import { getKenneyNatureTerrainAdapter } from './adapters/kenney-nature-terrain/KenneyNatureTerrainAdapter.js';
import { getKenneyNaturePropAdapter } from './adapters/kenney-nature-props/KenneyNaturePropAdapter.js';
import {
  isPlacementNudgeArrowKey,
  gridDeltaForArrowKey,
  clampGridTile,
} from './placementKeyboardNudge.js';
import { prefersTouchPlacementFlow } from './touchPlacementInput.js';
import { canPlaceBuildingAtTileWithSupplyRules } from '../../composition/canPlaceBuildingAtTileWithSupplyRules.js';
import { isRoadBuildingType } from '../../composition/constructionCatalog.js';
import { createPlacementRotationHud } from './placementRotationHud.js';

/**
 * @param {object | null | undefined} object
 * @returns {string | null}
 */
function resolveEditorStackIdFromObject(object) {
  let current = object ?? null;
  while (current) {
    const stackId = current.userData?.editorStackId;
    if (typeof stackId === 'string' && stackId.length > 0) {
      return stackId;
    }
    current = current.parent ?? null;
  }
  return null;
}

ensureGameRuntimeBootstrapped();

export function createGame(gameStore, assetManager, citySize = null) {
  resetCumulativeDeaths();

  let activeToolId = '';
  let time = 0;
  let isPause;
  let isOver;
  let infos = {};
  /** @type {GameLoop | null} */
  let gameLoop = null;
  /** @type {ReturnType<typeof createGame> extends infer T ? T : never} */
  let game;

  /** Cesar III road paint session (click + hold). */
  let roadPaint = {
    active: false,
    lastX: null,
    lastY: null,
    placedCount: 0,
    busy: false,
  };

  /** 0 = horizontal (StonePath-001), 1 = vertical (StonePath-Right-001). */
  let stonePathOrientation = 0;

  /** Touch/tablet: anchor ghost + rotation HUD before confirming placement. */
  let touchPendingPlacement = null;

  function usesTouchPlacementRotationFlow(toolId) {
    return prefersTouchPlacementFlow()
      && isPlaceableBuildingTool(toolId, buildingPlacementCatalog);
  }

  /** Touch placement always uses base mesh + placementRotationStep (roads included). */
  function resolveTouchPlacementBuildingType(toolId) {
    if (isStonePathTool(toolId)) {
      return 'StonePath-001';
    }
    return toolId;
  }

  /** @type {ReturnType<typeof createPlacementRotationHud> | null} */
  let placementRotationHud = null;

  function cancelTouchPendingPlacement() {
    if (!touchPendingPlacement) {
      return;
    }
    touchPendingPlacement = null;
    scene.placementGhost.clear();
    placementRotationHud?.hide();
  }

  /** Drop a pending rotate-confirm if Mode tactile was turned off mid-flow. */
  function discardTouchPendingIfDisabled() {
    if (touchPendingPlacement && !prefersTouchPlacementFlow()) {
      cancelTouchPendingPlacement();
    }
  }

  function beginTouchPendingPlacement(placeX, placeY, toolId) {
    const buildingType = resolveTouchPlacementBuildingType(toolId);
    const gridSize = buildingPlacementCatalog[toolId]?.gridSize ?? buildingPlacementCatalog[buildingType]?.gridSize ?? 1;
    const rotationStep = scene.placementGhost?.rotationStep ?? 0;
    touchPendingPlacement = {
      x: placeX,
      y: placeY,
      buildingType,
      toolId,
      rotationStep,
      gridSize,
    };
    scene.placementGhost.anchor(buildingType, placeX, placeY, true, gridSize, {
      rotationStep,
    });
    placementRotationHud?.show({
      x: placeX,
      y: placeY,
      gridSize,
    });
  }

  async function finalizeBuildingPlacement(placeX, placeY, buildingType, rotationStep = 0) {
    const result = await constructionApi.placeBuildingAtTile({
      city,
      x: placeX,
      y: placeY,
      buildingType,
      gameTurn: time,
      placementRotationStep: rotationStep,
    });

    if (!result.success) {
      if (result.reason === 'in_progress') {
        return false;
      }
      if (result.reason === 'insufficient_funds') {
        showInsufficientFundsNotification(buildingType, result.price || 0);
      } else if (result.reason) {
        showGenericErrorNotification(buildingType, result.reason);
      }
      return false;
    }

    if (!isRoadBuildingType(buildingType)) {
      playPlaceBuildingSound();
    }

    await scene.update(city, time);
    await runSimulationPass(time);
    await syncEmploymentAfterBuildingChange(scene, city, buildingType);
    await syncSupplyLinksAfterBuildingChange({
      supply,
      construction: constructionApi,
      city,
      event: 'placed',
      buildingType,
      instanceId: result.instanceId,
      x: placeX,
      y: placeY,
    });
    await refreshPlacementPresentation();
    await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
    const multiplayerManager = getMultiplayerManager();
    if (multiplayerManager?.isMultiplayer) {
      try {
        await multiplayerManager.placeBuilding(buildingType, placeX, placeY);
      } catch (error) {
        console.warn('[Multiplayer] Erreur envoi bâtiment:', error);
      }
    }
    if (game) {
      game.play();
    }
    return true;
  }

  function getTickIntervalMs() {
    const raw = parseInt(localStorage.getItem('speed'), 10);
    return snapTickMs(Number.isFinite(raw) ? raw : DEFAULT_TICK_MS);
  }

  localStorage.setItem('speed', String(DEFAULT_TICK_MS));

  registerAppService('gameUI', gameUI);
  gameUI.updateTimeDisplay(time);
  bootTreasuryHud({ gameUI });

  const {
    parcels,
    supply,
    housing,
    employment,
    gameplay,
    construction,
    accounting,
    sessionApi,
    runtime,
  } = bootGameContexts();
  const { construction: constructionApi } = sessionApi;
  const {
    isRoadBuildingType,
    listRoadPaintCells,
    isStonePathTool,
    stonePathTypeForIndex,
    stonePathOrientationLabel,
    cycleStonePathOrientationIndex,
    stonePathOrientationIndex,
    canPlaceBuildingAtTile,
  } = constructionApi;

  function getEffectiveBuildingToolId() {
    if (isStonePathTool(activeToolId)) {
      return stonePathTypeForIndex(stonePathOrientation);
    }
    return activeToolId;
  }

  function updateStonePathToolHint() {
    const btn = document.querySelector('[data-stone-path-tool="1"]');
    if (!btn) return;
    const label = stonePathOrientationLabel(stonePathOrientation);
    btn.title = `Chemin de pierre (${label}) — touche R pour tourner`;
    btn.dataset.orientation = String(stonePathOrientation);
  }

  function getPlacementRotationStep() {
    return scene.placementGhost?.rotationStep ?? 0;
  }

  function getEditorStackMountOptions() {
    const step = getPlacementRotationStep();
    if (!isEditorRiverAsset(activeToolId)) {
      return { mountMode: 'surface', faceDirection: 'north', rotationStep: step };
    }
    const resolved = resolveRiverMountFromRotationStep(step);
    return {
      mountMode: resolved.mountMode,
      faceDirection: resolved.faceDirection,
      rotationStep: step,
    };
  }

  function getPlacementRotationY() {
    if (isEditorRiverAsset(activeToolId)) {
      const { surfaceRotationStep } = resolveRiverMountFromRotationStep(getPlacementRotationStep());
      return surfaceRotationStep * (Math.PI / 2);
    }
    return getPlacementRotationStep() * (Math.PI / 2);
  }

  /** Build behavior: playable buildings + editor terrain/props (ghost, R rotation, placement). */
  function isActivePlacementTool(toolId = activeToolId) {
    return isEditorPlacementTool(toolId)
      || isPlaceableBuildingTool(toolId, buildingPlacementCatalog);
  }

  const behaviorModeOptions = { isPlacementTool: isActivePlacementTool };

  function resolveActiveBehaviorMode(toolId = activeToolId) {
    return resolveBehaviorMode(toolId, behaviorModeOptions);
  }

  bindObjectivesTrackerDeps({
    accounting: sessionApi.accounting,
    getObjectivesManager,
    getButtonStateManager,
    registerAppService,
  });

  const scene = createScene(gameStore, assetManager, {
    parcels,
    supply,
    housing,
    construction,
    employment,
    resetProcessTurnBudget: () => accounting.resetProcessTurnBudget(),
    gameUI,
    popupManager,
  });
  const city = createCity(resolveSelectedCitySize(citySize));
  let isTraveling = false;
  /** Serializes first boot and later hamlet swaps so two initialize() never overlap. */
  let hamletSceneGate = Promise.resolve();

  async function loadActiveHamletScene() {
    await ensureHamletCatalog();
    const rows = await constructionApi.listAllBuildingRows();
    const mapLayoutId = getMissionMapLayoutId();
    let hydrateEditorLayout = false;

    if (mapLayoutId) {
      setCustomMapLayoutActive(true);
      const layout = await loadEditorMapLayout(getEditorMapRepository(), mapLayoutId);
      if (city.size !== layout.citySize) {
        throw new Error(
          `City size ${city.size} does not match custom map ${layout.citySize}`
        );
      }
      applyEditorMapLayoutToCity(city, layout, createEditorNatureStackLayoutPort());
      hydrateEditorLayout = true;
    } else if (isEditorMode()) {
      initializeEditorCityTiles(city);
    } else {
      hydrateCityTilesFromRows(city, rows, buildingPlacementCatalog);
    }

    const hamlet = await getHamlet(getActiveHamletId());
    const seedNature = !isEditorMode()
      && !hydrateEditorLayout
      && !isCustomMapLayoutActive()
      && !hamlet?.natureSeeded
      && rows.length === 0;
    await scene.initialize(city, { seedNature, hydrateEditorLayout });
    if (seedNature) {
      await markHamletNatureSeeded(getActiveHamletId());
    }
    await scene.update(city, time);
  }

  /**
   * Unload current 3D hamlet and hydrate another from Dexie (same canvas).
   * @param {string} hamletId
   */
  async function travelToHamlet(hamletId) {
    try {
      await hamletSceneGate;
    } catch {
      /* First load failed; still attempt the swap. */
    }
    if (!hamletId || hamletId === getActiveHamletId() || isTraveling) {
      return false;
    }
    if (!(await canTravelToHamlet(hamletId))) {
      return false;
    }
    isTraveling = true;
    const wasPaused = Boolean(isPause);
    try {
      loaderManager.show();
      if (!wasPaused) {
        game?.pause?.();
      }
      closeBuildingInfoOverlay();
      placementRotationHud?.hide();
      scene.placementGhost?.clear?.();
      touchPendingPlacement = null;

      setActiveHamletId(hamletId);
      clearCityTiles(city);
      await loadActiveHamletScene();
      await refreshPlacementPresentation();
      await refreshEmploymentPresentationForCity();
      return true;
    } catch (error) {
      console.error('[Game] travelToHamlet failed:', error);
      showErrorToast(
        'Le voyage vers l’autre hameau a échoué. Merci de réessayer.',
        { timeout: 6000 }
      );
      return false;
    } finally {
      loaderManager.hide(280);
      isTraveling = false;
      if (!wasPaused) {
        await game?.play?.();
      }
    }
  }

  placementRotationHud = createPlacementRotationHud({
    getCamera: () => scene.camera?.camera ?? null,
    getCanvas: () => scene.domElement ?? document.querySelector('canvas'),
    onRotate: () => {
      if (!touchPendingPlacement) {
        return;
      }
      scene.placementGhost.rotateStep();
      touchPendingPlacement.rotationStep = scene.placementGhost.rotationStep;
    },
    onConfirm: async () => {
      if (!touchPendingPlacement) {
        return;
      }
      const { x, y, buildingType, rotationStep, gridSize } = touchPendingPlacement;
      touchPendingPlacement = null;
      placementRotationHud?.hide();
      scene.placementGhost.clear();
      const placed = await finalizeBuildingPlacement(x, y, buildingType, rotationStep);
      if (placed) {
        placementGhostSession.suppressGhostAtFootprint(x, y, gridSize);
      } else {
        placementGhostSession.sync(scene.focusedObject);
      }
    },
  });

  const placementGhostSession = createPlacementGhostSession({
    getGhost: () => scene.placementGhost,
    getCity: () => city,
    getActiveToolId: () => activeToolId,
    getEffectiveAssetId: () => {
      if (isEditorPlacementTool(activeToolId)) {
        return activeToolId;
      }
      if (prefersTouchPlacementFlow() && isStonePathTool(activeToolId)) {
        return 'StonePath-001';
      }
      return getEffectiveBuildingToolId();
    },
    assetCatalog: buildingPlacementCatalog,
    isPlaceableTool: (toolId) => isActivePlacementTool(toolId),
    getFocusedObject: () => scene.focusedObject,
    canPlaceBuildingAtTile: (params) => {
      if (isEditorPlacementTool(params.buildingType)) {
        const preview = scene.resolveEditorGhostPlacementPreview?.(
          params.x,
          params.y,
          scene.focusedObject,
          params.buildingType,
          params.rotationStep ?? 0
        );
        return {
          ok: preview?.ok ?? false,
          gridSize: 1,
          footprintWidth: 1,
          footprintHeight: 1,
        };
      }
      return canPlaceBuildingAtTile(params);
    },
    getPlacementAnchorLocalY: (x, y) => {
      if (!isEditorPlacementTool(activeToolId)) {
        return null;
      }
      return scene.resolveEditorPlacementAnchorLocalY?.(
        x,
        y,
        scene.focusedObject,
        activeToolId
      ) ?? null;
    },
    getEditorGhostPreview: (x, y, rotationStep) => {
      if (!isEditorPlacementTool(activeToolId)) {
        return null;
      }
      return scene.resolveEditorGhostPlacementPreview?.(
        x,
        y,
        scene.focusedObject,
        activeToolId,
        rotationStep
      ) ?? null;
    },
  });

  disableGatedPlacementTools(getButtonStateManager());

  async function refreshPlacementPresentation() {
    const rows = await constructionApi.listAllBuildingRows();
    refreshSupplyPlacementIndex(rows);
    await refreshSkillPlacementGating({
      housing,
      buttonStateManager: getButtonStateManager(),
    });
  }

  bindGameUIDeps({ getScene: () => scene });

  bindSessionRuntime({
    gameUI,
    city,
    scene,
    parcels,
    supply,
    housing,
    employment,
    gameplay,
    ecsRuntime: runtime,
    sessionApi,
  });

  hamletSceneGate = loadActiveHamletScene().then(async () => {
    await refreshPlacementPresentation();
    loaderManager.hide(500);
    scene.onEnterSelectMode?.();
    if (sessionStorage.getItem('anoria.startTutorial') === '1') {
      sessionStorage.removeItem('anoria.startTutorial');
      setTimeout(() => {
        invokeStartTutorial();
      }, 800);
    }
  }).catch((error) => {
    // Sans ce filet, une erreur ici (asset manquant, réseau mobile instable,
    // perte de contexte WebGL...) laissait le loader bloqué
    // bloqué indéfiniment, sans aucun message pour le joueur.
    console.error('[game.js] scene.initialize failed:', error);
    loaderManager.hide(0);
    showErrorToast(
      "Le chargement de la ville a rencontré un problème. Merci de recharger la page.",
      { timeout: 8000 }
    );
  });

  if (typeof window !== 'undefined') {
    window.addEventListener(HAMLET_ACCESS_CHANGED_EVENT, () => {
      void scene.syncNeighborHamletDeco?.(city);
    });
  }

  async function refreshEmploymentPresentationForCity() {
    await scene.refreshEmploymentPresentation(city);
  }

  /** ECS + presentation sync for player interactions (no full turn economy). */
  async function runSimulationPass(tick) {
    if (isPause || isOver) {
      return;
    }

    try {
      await runtime.runSimulation({ city, time: tick });
    } catch (err) {
      console.error('[game.js] ECS simulation error:', {
        error: err?.message || err,
        time: tick,
      });
    }

    if (isPause || isOver) {
      return;
    }

    await scene.update(city, tick);
  }

  async function runScenePresentationPass(tick) {
    await scene.update(city, tick);
    await refreshEmploymentPresentationForCity();
  }

  /**
   * Place one road tile. Visual update only; heavy sync happens when paint ends.
   * @returns {Promise<'placed'|'skip'|'fail'>}
   */
  async function placeRoadTile(x, y) {
    if (!isRoadBuildingType(activeToolId)) {
      return 'skip';
    }
    if (!city?.tiles?.[x]?.[y]) {
      return 'skip';
    }

    const buildingType = getEffectiveBuildingToolId();
    const tile = city.tiles[x][y];
    const canOverwriteRoad = !tile.buildingId || isRoadBuildingType(tile.buildingId);
    if (!canOverwriteRoad) {
      return 'skip';
    }

    const result = await constructionApi.placeBuildingAtTile({
      city,
      x,
      y,
      buildingType,
      gameTurn: time,
    });

    if (!result.success) {
      if (result.reason === 'in_progress' || result.reason === 'building_already_exists') {
        return 'skip';
      }
      if (result.reason === 'insufficient_funds') {
        showInsufficientFundsNotification(buildingType, result.price || 0);
        return 'fail';
      }
      if (result.reason) {
        showGenericErrorNotification(buildingType, result.reason);
      }
      return 'fail';
    }

    roadPaint.placedCount += 1;
    roadPaint.lastX = x;
    roadPaint.lastY = y;

    const multiplayerManager = getMultiplayerManager();
    if (multiplayerManager?.isMultiplayer) {
      try {
        await multiplayerManager.placeBuilding(buildingType, x, y);
      } catch (error) {
        console.warn('[Multiplayer] Erreur envoi route:', error);
      }
    }

    return 'placed';
  }

  async function finalizeRoadPaintSession() {
    if (!roadPaint.active && roadPaint.placedCount === 0) {
      return;
    }
    const placed = roadPaint.placedCount;
    roadPaint.active = false;
    roadPaint.lastX = null;
    roadPaint.lastY = null;
    roadPaint.placedCount = 0;
    roadPaint.busy = false;

    if (placed <= 0) {
      return;
    }

    await scene.update(city, time);
    await runSimulationPass(time);
    await syncEmploymentAfterBuildingChange(scene, city, activeToolId);
    await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
    if (game?.play) {
      game.play();
    }
  }

  /**
   * Paint roads from last painted cell to (x,y), filling gaps (Cesar III drag).
   */
  async function paintRoadToward(x, y) {
    if (!roadPaint.active || roadPaint.busy || !isRoadBuildingType(activeToolId)) {
      return;
    }
    if (roadPaint.lastX === x && roadPaint.lastY === y) {
      return;
    }

    roadPaint.busy = true;
    try {
      const cells =
        roadPaint.lastX == null || roadPaint.lastY == null
          ? [{ x, y }]
          : listRoadPaintCells(roadPaint.lastX, roadPaint.lastY, x, y);

      let placedAny = false;
      for (const cell of cells) {
        if (cell.x < 0 || cell.y < 0 || cell.x >= city.size || cell.y >= city.size) {
          continue;
        }
        const outcome = await placeRoadTile(cell.x, cell.y);
        if (outcome === 'fail') {
          await finalizeRoadPaintSession();
          return;
        }
        if (outcome === 'placed') {
          placedAny = true;
        } else {
          roadPaint.lastX = cell.x;
          roadPaint.lastY = cell.y;
        }
      }

      if (placedAny) {
        await scene.update(city, time);
      }
    } finally {
      roadPaint.busy = false;
    }
  }

  function isModalBlockingEscapeToSelect() {
    if (infoObjectOverlay.classList.contains('active')) return true;
    if ((popupManager?.getActivePopups?.() || []).length > 0) return true;
    if (document.getElementById('parameters-panel')?.classList.contains('visible')) return true;
    if (document.getElementById('tutorial-panel')?.classList.contains('visible')) return true;
    if (document.getElementById('objectives-panel')?.classList.contains('visible')) return true;
    if (loaderManager.isShowing()) return true;
    return false;
  }

  scene.onEnterSelectMode = () => {
    closeMobileBuildBar();
    closeEditorBuildBar();
    closeModal();
    activateSelectToolButton();
    game.setActiveToolId('select-object');
  };

  scene.shouldEscapeToSelectMode = () => {
    if (isModalBlockingEscapeToSelect()) return false;
    return shouldReturnToSelectOnEscape(activeToolId, behaviorModeOptions);
  };

  scene.onObjectSelected = async (selectedObject) => {
    selectedObject.info = '';
    selectedObject.name = activeToolId !== 'select-object' ? activeToolId : selectedObject.name;

    if (!selectedObject || !selectedObject.userData) {
      console.warn('[game.onObjectSelected] Missing userData on selected object');
      return;
    }
    let { x, y } = selectedObject.userData;
    if (typeof x !== 'number' || typeof y !== 'number') {
      console.warn('[game.onObjectSelected] Invalid coordinates on selected object', { x, y });
      return;
    }
    if (!city || typeof city.size !== 'number' || x < 0 || y < 0 || x >= city.size || y >= city.size) {
      console.warn('[game.onObjectSelected] Coordinates out of bounds', { x, y, size: city?.size });
      return;
    }
    const tile = city.tiles?.[x]?.[y];
    if (!tile) {
      console.warn('[game.onObjectSelected] Missing tile at coordinates', { x, y });
      return;
    }

    const behaviorMode = resolveActiveBehaviorMode();

    if (isEditorMode()) {
      if (behaviorMode === BEHAVIOR_MODE.BUILD) {
        if (isEditorPlacementTool(activeToolId)) {
          await scene.placeEditorStackObject(
            x,
            y,
            activeToolId,
            getPlacementRotationY(),
            selectedObject,
            getEditorStackMountOptions()
          );
          placementGhostSession.suppressGhostAtFootprint(x, y, 1);
          return;
        }
        // Playable buildings / roads use the standard build handlers below.
      } else if (behaviorMode === BEHAVIOR_MODE.ERASE) {
        const stackId = resolveEditorStackIdFromObject(selectedObject);
        if (stackId && scene.removeEditorStackById(stackId)) {
          placementGhostSession.sync(selectedObject);
          return;
        }
        if (
          selectedObject?.userData?.isKenneyNatureTerrain
          && !selectedObject?.userData?.editorStackId
        ) {
          if (scene.clearEditorTileBaseToSea(city, x, y)) {
            placementGhostSession.sync(selectedObject);
            return;
          }
        }
        if (scene.removeEditorNaturePropAt(x, y)) {
          placementGhostSession.sync(selectedObject);
          return;
        }
        // Erase behavior does not clear bare terrain (editor is not god mode).
        if (!tile.buildingId && !tile.instanceId) {
          return;
        }
        // Fall through to standard building bulldoze below.
      } else if (behaviorMode === BEHAVIOR_MODE.SELECT) {
        await presentBuildingInfoSelection(selectedObject, {
          city,
          parcels,
          supply,
          housing,
          scene,
          game,
          time,
          runScenePresentationPass,
          construction: constructionApi,
          employment: sessionApi.employment,
          accounting: sessionApi.accounting,
        });
        return;
      }
    }

    if (behaviorMode === BEHAVIOR_MODE.ERASE) {
      const removedInstanceId = selectedObject.userData?.instanceId ?? tile.instanceId ?? null;
      const isHub = supply.hasResourceRole(tile.buildingId, 'hub');
      const hasPlacementRequirements = supply.getPlacementRequirements(tile.buildingId).length > 0;

      let cascadeOutcome = null;
      if ((isHub || hasPlacementRequirements) && removedInstanceId) {
        cascadeOutcome = await syncSupplyLinksAfterBuildingChange({
          supply,
          construction: constructionApi,
          city,
          event: 'bulldozed',
          buildingType: tile.buildingId,
          instanceId: removedInstanceId,
          x,
          y,
        });
      }

      const { buildingId } = await constructionApi.bulldozeBuildingAtTile({
        city,
        x,
        y,
        meshInstanceId: removedInstanceId,
      });

      if (buildingId) {
        playBulldozeSound();
      }

      if (cascadeOutcome?.destroyed?.length) {
        showWindmillCascadeNotification(cascadeOutcome.destroyed);
      }

      await scene.update(city, time);
      await syncEmploymentAfterBuildingChange(scene, city, buildingId);
      await refreshPlacementPresentation();
      await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
    } else if (behaviorMode === BEHAVIOR_MODE.SELECT) {
      await presentBuildingInfoSelection(selectedObject, {
        city,
        parcels,
        supply,
        housing,
        scene,
        game,
        time,
        runScenePresentationPass,
        construction: constructionApi,
        employment: sessionApi.employment,
        accounting: sessionApi.accounting,
      });
    } else if (isRoadBuildingType(activeToolId)) {
      if (infoObjectOverlay.classList.contains('active')) {
        closeBuildingInfoOverlay(infoObjectOverlay);
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.classList.remove('pointer-events-disabled');
        }
        if (game && typeof game.play === 'function') {
          game.play();
        }
      }

      discardTouchPendingIfDisabled();
      if (touchPendingPlacement) {
        return;
      }

      if (usesTouchPlacementRotationFlow(activeToolId)) {
        const tile = city.tiles[x][y];
        const canOverwriteRoad = !tile?.buildingId || isRoadBuildingType(tile.buildingId);
        if (!canOverwriteRoad) {
          showGenericErrorNotification(activeToolId, 'area_not_available');
          return;
        }

        const placementCheck = canPlaceBuildingAtTileWithSupplyRules({
          city,
          x,
          y,
          buildingType: activeToolId,
          assetCatalog: buildingPlacementCatalog,
        });
        if (!placementCheck.ok) {
          if (placementCheck.reason) {
            showGenericErrorNotification(activeToolId, placementCheck.reason);
          }
          return;
        }
        beginTouchPendingPlacement(x, y, activeToolId);
        return;
      }

      // Desktop: Cesar III — first click anchors, hold+drag paints further tiles
      roadPaint.active = true;
      roadPaint.placedCount = 0;
      const outcome = await placeRoadTile(x, y);
      if (outcome === 'fail') {
        roadPaint.active = false;
        return;
      }
      if (outcome === 'placed') {
        await scene.update(city, time);
      } else {
        roadPaint.lastX = x;
        roadPaint.lastY = y;
      }
    } else if (!tile.buildingId) {
      if (infoObjectOverlay.classList.contains('active')) {
        closeBuildingInfoOverlay(infoObjectOverlay);
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.classList.remove('pointer-events-disabled');
        }
        if (game && typeof game.play === 'function') {
          game.play();
        }
      }

      const { x: placeX, y: placeY } = selectedObject.userData;

      discardTouchPendingIfDisabled();
      if (touchPendingPlacement) {
        return;
      }

      if (usesTouchPlacementRotationFlow(activeToolId)) {
        const placementCheck = canPlaceBuildingAtTileWithSupplyRules({
          city,
          x: placeX,
          y: placeY,
          buildingType: activeToolId,
          assetCatalog: buildingPlacementCatalog,
        });
        if (!placementCheck.ok) {
          if (placementCheck.reason) {
            showGenericErrorNotification(activeToolId, placementCheck.reason);
          }
          return;
        }
        beginTouchPendingPlacement(placeX, placeY, activeToolId);
        return;
      }

      const placed = await finalizeBuildingPlacement(
        placeX,
        placeY,
        getEffectiveBuildingToolId(),
        getPlacementRotationStep(),
      );
      if (placed) {
        const effectiveType = getEffectiveBuildingToolId();
        const gridSize =
          buildingPlacementCatalog[activeToolId]?.gridSize ?? buildingPlacementCatalog[effectiveType]?.gridSize ?? 1;
        placementGhostSession.suppressGhostAtFootprint(placeX, placeY, gridSize);
      } else {
        placementGhostSession.sync(selectedObject);
      }
    }
  };

  scene.onRoadPaintMove = async (focusedObject) => {
    if (!roadPaint.active || !isRoadBuildingType(activeToolId)) {
      return;
    }
    const x = focusedObject?.userData?.x;
    const y = focusedObject?.userData?.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return;
    }
    await paintRoadToward(x, y);
    placementGhostSession.sync(focusedObject);
  };

  scene.onRoadPaintEnd = async () => {
    await finalizeRoadPaintSession();
  };

  scene.onPlacementHover = (focusedObject) => {
    discardTouchPendingIfDisabled();
    if (touchPendingPlacement) {
      return;
    }
    placementGhostSession.sync(focusedObject);
  };

  // Build tool + 1 finger: green/red ghost follows the finger (2 fingers still pan/zoom).
  scene.preferPlacementTouchDrag = () => {
    if (touchPendingPlacement) {
      return false;
    }
    return resolveActiveBehaviorMode() === BEHAVIOR_MODE.BUILD;
  };

  /**
   * Build mode: R is reserved for the placement ghost (camera R is blocked).
   * Rotates the ghost mesh when it is visible; otherwise R is consumed but has no effect.
   * @returns {boolean} true if build mode is active (blocks camera rotation)
   */
  scene.onRotateBuildingTool = () => {
    if (resolveActiveBehaviorMode() !== BEHAVIOR_MODE.BUILD) {
      return false;
    }

    if (touchPendingPlacement) {
      if (scene.placementGhost?.active) {
        scene.placementGhost.rotateStep();
        touchPendingPlacement.rotationStep = scene.placementGhost.rotationStep;
      }
      return true;
    }

    if (isStonePathTool(activeToolId)) {
      if (scene.placementGhost?.active) {
        stonePathOrientation = cycleStonePathOrientationIndex(stonePathOrientation);
        updateStonePathToolHint();
        placementGhostSession.sync();
      }
      return true;
    }

    if (scene.placementGhost?.active) {
      placementGhostSession.rotateGhostStep();
    }
    return true;
  };

  /**
   * Keyboard autonomy while a placeable tool is active:
   * - Arrows nudge the ghost one tile (screen-relative to camera; WASD still pans).
   * - Enter places at the current ghost tile.
   * @param {KeyboardEvent} event
   * @returns {boolean}
   */
  scene.onPlacementKeyboard = (event) => {
    if (resolveActiveBehaviorMode() !== BEHAVIOR_MODE.BUILD) {
      return false;
    }
    if (touchPendingPlacement || scene.placementGhost?.anchored) {
      return false;
    }
    if (event.ctrlKey || event.altKey || event.metaKey) {
      return false;
    }

    if (event.key === 'Enter') {
      const tile = scene.placementGhost?.tile;
      if (!tile) {
        return false;
      }
      void scene.onObjectSelected?.({
        userData: { x: tile.x, y: tile.y },
        info: '',
        name: activeToolId,
      });
      return true;
    }

    if (!isPlacementNudgeArrowKey(event)) {
      return false;
    }

    if (!city || typeof city.size !== 'number') {
      return false;
    }

    const cam = scene.camera;
    const azimuth = typeof cam?.azimuth === 'number' ? cam.azimuth : 0;
    const { dx, dy } = gridDeltaForArrowKey(event.key, azimuth);

    const current = scene.placementGhost?.tile;
    let x;
    let y;
    if (current) {
      x = current.x + dx;
      y = current.y + dy;
    } else {
      const origin = cam?.origin;
      const seedX = typeof origin?.x === 'number' ? origin.x : city.size / 2;
      const seedY = typeof origin?.z === 'number' ? origin.z : city.size / 2;
      const seeded = clampGridTile(seedX, seedY, city.size);
      x = seeded.x + dx;
      y = seeded.y + dy;
    }

    const next = clampGridTile(x, y, city.size);
    placementGhostSession.sync({ userData: { x: next.x, y: next.y } });
    return true;
  };

  window.addEventListener('mouseup', (event) => {
    // Release may happen outside the canvas — still end camera drag / road paint
    scene.onMouseUp?.(event);
    if (roadPaint.active) {
      void finalizeRoadPaintSession();
    }
  });

  window.addEventListener('blur', () => {
    scene.camera?.releaseAllMouseButtons?.();
  });

  const canvasEl = scene.domElement || document.querySelector('canvas');
  if (canvasEl) {
    canvasEl.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      // Ensure right-drag ends even if the browser eats mouseup for the menu
      scene.camera?.onMouseUp?.({ button: 2 });
    });
    canvasEl.addEventListener('mousedown', scene.onMouseDown.bind(scene), false);
    canvasEl.addEventListener('mousemove', scene.onMouseMove.bind(scene), false);
    canvasEl.addEventListener('wheel', scene.onMouseWheel.bind(scene), { passive: false });
    canvasEl.addEventListener('touchstart', scene.onTouchStart.bind(scene), { passive: false });
    canvasEl.addEventListener('touchmove', scene.onTouchMove.bind(scene), { passive: false });
    canvasEl.addEventListener('touchend', scene.onTouchEnd.bind(scene), { passive: false });
    document.addEventListener('keydown', scene.onKeyBoardDown.bind(scene), false);
    document.addEventListener('keyup', scene.onKeyBoardUp.bind(scene), false);
  } else {
    document.addEventListener('mousedown', scene.onMouseDown.bind(scene), false);
    document.addEventListener('mousemove', scene.onMouseMove.bind(scene), false);
    document.addEventListener('wheel', scene.onMouseWheel.bind(scene), { passive: false });
    document.addEventListener('touchstart', scene.onTouchStart.bind(scene), { passive: false });
    document.addEventListener('touchmove', scene.onTouchMove.bind(scene), { passive: false });
    document.addEventListener('touchend', scene.onTouchEnd.bind(scene), { passive: false });
    document.addEventListener('keydown', scene.onKeyBoardDown.bind(scene), false);
    document.addEventListener('keyup', scene.onKeyBoardUp.bind(scene), false);
  }

  infoObjectCloseBtn.addEventListener('click', () => {
    if (infoObjectOverlay.classList.contains('active')) {
      closeBuildingInfoOverlay(infoObjectOverlay);
    }
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.classList.remove('pointer-events-disabled');
    }
    if (scene.controls) {
      scene.controls.enabled = true;
    }
    if (scene.suppressInput) {
      scene.suppressInput(200);
    }
    game.play();
  });

  game = {
    scene,
    city,
    runtime,
    travelToHamlet,
    getActiveHamletId,

    async update(tick) {
      await runGameTick({
        time: tick,
        shouldAbort: () => isPause || isOver,
        city,
        scene,
        runtime,
        housing,
        employment,
        gameStore,
        gameUI,
        refreshEmploymentPresentation: refreshEmploymentPresentationForCity,
        objectivesTracker,
        notifyBudgetCleanup: notifyBudgetCleanupIfNeeded,
        refreshPlacementToolGating: ({ housing: housingCtx }) =>
          refreshSkillPlacementGating({
            housing: housingCtx,
            buttonStateManager: getButtonStateManager(),
          }),
        onGameOver: () => {
          isOver = true;
        },
        presentIncomingNewsEvents,
      });
    },

    refreshEmployment: refreshEmploymentPresentationForCity,
    runSimulationPass,
    runScenePresentationPass,

    pause() {
      isPause = true;
      gameUI.setPaused(true);
      if (scene.pauseCitizen) {
        scene.pauseCitizen();
      }
    },

    async play() {
      isPause = false;
      gameUI.setPaused(false);
      if (scene.resumeCitizen) {
        scene.resumeCitizen();
      }
      if (objectivesTracker.enabled) {
        await objectivesTracker.checkObjectives(0);
      }
    },

    replay() {
      isOver = false;
      overOverlay.classList.remove('active');
      overOverlay.setAttribute('inert', '');
      overOverlay.setAttribute('aria-hidden', 'true');
      document.getElementById('play-again-btn')?.setAttribute('tabindex', '-1');
      resetCumulativeDeaths();

      try {
        localStorage.removeItem('journal_year_end_balances');
        localStorage.removeItem('citizen_tax_amount');
        localStorage.removeItem('work_salary_per_month');
        localStorage.removeItem('work_salary_tax_rate');
        localStorage.removeItem('show-performance-stats');
        localStorage.removeItem('hasSeenCleanupNotification');
        localStorage.removeItem('speed');
        localStorage.removeItem('selectedCitySize');
        localStorage.removeItem('multiplayer-enabled');
        localStorage.removeItem('multiplayer-pseudo');
        localStorage.removeItem('multiplayer-room-name');
        localStorage.removeItem('activeLoans');
        console.log('[Game] LocalStorage cleared for replay');
      } catch (error) {
        console.warn('[Game] Error clearing localStorage on replay:', error);
      }

      window.location.href = '/';
    },

    setInfo(key, info) {
      if (!infos.key) {
        infos.assign(...infos, { key: info });
      }
    },

    getInfo(key) {
      if (infos[key]) {
        return infos[key];
      }
    },

    get activeToolId() {
      return activeToolId;
    },

    setActiveToolId(toolId) {
      cancelTouchPendingPlacement();
      activeToolId = toolId;
      gameUI.activeToolId = toolId;
      if (isStonePathTool(toolId)) {
        // Selecting the single StonePath button keeps current orientation;
        // legacy Left/Right ids normalize to the matching index.
        if (toolId !== 'StonePath-001') {
          stonePathOrientation = stonePathOrientationIndex(toolId);
          activeToolId = 'StonePath-001';
          gameUI.activeToolId = 'StonePath-001';
        }
        updateStonePathToolHint();
      }
      placementGhostSession.onToolChanged();
      if (isEditorTerrainTool(toolId)) {
        void getKenneyNatureTerrainAdapter().ensureTerrainTemplate(toolId);
      } else if (isEditorNatureTool(toolId)) {
        void getKenneyNaturePropAdapter().ensurePropLoaded(toolId);
      }
      if (!isRoadBuildingType(toolId) && roadPaint.active) {
        void finalizeRoadPaintSession();
      }
    },

    startInterval() {
      if (!gameLoop) {
        return;
      }
      gameLoop.setIntervalMs(getTickIntervalMs());
    },

    get time() {
      return time;
    },
  };

  gameLoop = new GameLoop({
    intervalMs: getTickIntervalMs(),
    onTick: async () => {
      if (isPause || isOver) {
        return;
      }
      time += 1;
      await game.update(time);
    },
  });
  gameLoop.start();

  scene.start();
  void refreshEmploymentPresentationForCity();

  try {
    const target = document.getElementById('game-window');
    if (target) {
      const inputManager = new InputManager();
      inputManager.attach(target);
      registerAppService('inputManager', inputManager);
    }
  } catch (_) {}

  if (scene && scene.camera) {
    import('../dom/shell/mobile-controls.js')
      .then(({ initMobileControls }) => {
        initMobileControls(scene.camera);
      })
      .catch((error) => {
        console.warn('[Game] Failed to initialize mobile controls:', error);
      });
  }

  registerAppService('game', game);
  bindSessionRuntime({ game, city, scene });

  return game;
}
