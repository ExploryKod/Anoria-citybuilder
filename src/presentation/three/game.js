/**
 * Game session facade — interaction + GameLoop API.
 * Context / treasury / tick wiring live in composition/.
 */

import { registerAppService, getMultiplayerManager, invokeStartTutorial, getObjectivesManager, getButtonStateManager } from '../../composition/sessionShell.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import { syncEmploymentAfterBuildingChange } from '../../composition/syncEmploymentAfterBuildingChange.js';
import { syncSupplyLinksAfterBuildingChange } from '../../composition/syncSupplyLinksAfterBuildingChange.js';
import { refreshSupplyPlacementIndex } from '../../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';
import { ensureGameRuntimeBootstrapped } from '../../composition/ensureGameRuntimeBootstrapped.js';
import { bootGameContexts } from '../../composition/bootGameContexts.js';
import { bootTreasuryHud } from '../../composition/bootTreasuryHud.js';
import { resolveSelectedCitySize } from '../../composition/resolveCitySize.js';
import { runGameTick } from '../../composition/runGameTick.js';
import { bindSessionRuntime } from '../../composition/sessionRuntime.js';
import { syncSessionHud } from '../../composition/syncSessionHud.js';
import { resetCumulativeDeaths } from '../../composition/gameplayMortalityState.js';
import { notifyBudgetCleanupIfNeeded } from '../dom/compta/tresorerie/CleanupNotificationPresenter.js';
import {
  disableGatedPlacementTools,
  refreshSkillPlacementGating,
} from '../dom/shell/SkillPlacementGating.js';
import { DEFAULT_TICK_MS, snapTickMs } from '../../shared/gameplay/SimulationDefaults.js';
import { GameLoop } from '../../engine/loop/GameLoop.js';
import {
  overOverlay,
  infoObjectOverlay,
  infoObjectCloseBtn,
} from '../dom/shell/nodes.js';
import { closeBuildingInfoOverlay } from '../dom/info/layout/buildingInfoLayout.js';
import { activateSelectToolButton } from '../dom/tools/ToolPanel.js';
import loaderManager from '../dom/shell/LoaderManager.js';
import objectivesTracker, {
  bindObjectivesTrackerDeps,
} from '../dom/onboarding/ObjectivesTracker.js';
import InputManager from './InputManager.js';
import gameUI, {
  bindGameUIDeps,
} from '../dom/shell/GameUI.js';
import { popupManager } from '../dom/shell/PopupManager.js';
import {
  showInsufficientFundsNotification,
  showGenericErrorNotification,
  showWindmillCascadeNotification,
} from '../dom/shell/BuildingNotifications.js';
import { showErrorToast } from '../dom/shell/ToastNotifier.js';
import { presentBuildingInfoSelection } from '../dom/info/presenters/useBuildingInfoSelection.js';
import { assetsPrices } from '../../shared/building-catalog/index.js';
import { isWindmillBuildingType, isMarketBuildingType } from '../../shared/building-catalog/BuildingSupplyTypes.js';
import {
  createPlacementGhostSession,
  isPlaceableBuildingTool,
  resolveGhostVisualAssetId,
} from './placementGhostSession.js';
import {
  isPlacementNudgeArrowKey,
  gridDeltaForArrowKey,
  clampGridTile,
} from './placementKeyboardNudge.js';
import { prefersTouchPlacementFlow } from './touchPlacementInput.js';
import { canPlaceBuildingAtTileWithSupplyRules } from '../../composition/canPlaceBuildingAtTileWithSupplyRules.js';
import { createPlacementRotationHud } from './placementRotationHud.js';

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
      && isPlaceableBuildingTool(toolId, assetsPrices);
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
    const gridSize = assetsPrices[toolId]?.gridSize ?? assetsPrices[buildingType]?.gridSize ?? 1;
    const visualAssetId = resolveGhostVisualAssetId(buildingType);
    touchPendingPlacement = {
      x: placeX,
      y: placeY,
      buildingType,
      toolId,
      rotationStep: 0,
      gridSize,
    };
    scene.placementGhost.anchor(visualAssetId, placeX, placeY, true, gridSize);
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
    commerce,
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
      if (prefersTouchPlacementFlow() && isStonePathTool(activeToolId)) {
        return 'StonePath-001';
      }
      return getEffectiveBuildingToolId();
    },
    assetCatalog: assetsPrices,
    getFocusedObject: () => scene.focusedObject,
    canPlaceBuildingAtTile,
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
    commerce,
    gameplay,
    ecsRuntime: runtime,
    sessionApi,
  });

  scene.initialize(city).then(async () => {
    await refreshPlacementPresentation();
    loaderManager.hide(500);
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

  scene.onEnterSelectMode = () => {
    activateSelectToolButton();
    game.setActiveToolId('select-object');
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

    if (activeToolId === 'bulldoze') {
      const removedInstanceId = selectedObject.userData?.instanceId ?? tile.instanceId ?? null;
      const isWindmill = isWindmillBuildingType(tile.buildingId);
      const isMarket = isMarketBuildingType(tile.buildingId);

      let cascadeOutcome = null;
      if (isWindmill && removedInstanceId) {
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
      } else if (isMarket && removedInstanceId) {
        await syncSupplyLinksAfterBuildingChange({
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

      if (isWindmill && cascadeOutcome?.destroyed?.length) {
        showWindmillCascadeNotification(cascadeOutcome.destroyed);
      }

      await scene.update(city, time);
      await syncEmploymentAfterBuildingChange(scene, city, buildingId);
      await refreshPlacementPresentation();
      await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
    } else if (activeToolId === 'select-object') {
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
          assetCatalog: assetsPrices,
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
          assetCatalog: assetsPrices,
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

      const placed = await finalizeBuildingPlacement(placeX, placeY, activeToolId, 0);
      if (placed) {
        const effectiveType = getEffectiveBuildingToolId();
        const gridSize =
          assetsPrices[activeToolId]?.gridSize ?? assetsPrices[effectiveType]?.gridSize ?? 1;
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
    return isPlaceableBuildingTool(activeToolId, assetsPrices);
  };

  /**
   * R while StonePath tool is active: toggle H/V (does not rotate camera).
   * @returns {boolean} true if handled
   */
  scene.onRotateBuildingTool = () => {
    if (!isStonePathTool(activeToolId)) {
      return false;
    }
    stonePathOrientation = cycleStonePathOrientationIndex(stonePathOrientation);
    updateStonePathToolHint();
    placementGhostSession.sync();
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
    if (!isPlaceableBuildingTool(activeToolId, assetsPrices)) {
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
      resetCumulativeDeaths();

      try {
        sessionApi.commerce.clearCommercePersistence();
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
