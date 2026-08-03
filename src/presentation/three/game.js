/**
 * Game session facade — interaction + GameLoop API.
 * Context / treasury / tick wiring live in composition/.
 */

import { registerAppService, getMultiplayerManager, invokeStartTutorial, getObjectivesManager, getButtonStateManager } from '../../composition/sessionShell.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import { syncEmploymentAfterBuildingChange } from '../../composition/syncEmploymentAfterBuildingChange.js';
import { ensureGameRuntimeBootstrapped } from '../../composition/ensureGameRuntimeBootstrapped.js';
import { bootGameContexts } from '../../composition/bootGameContexts.js';
import { bootTreasuryHud } from '../../composition/bootTreasuryHud.js';
import { resolveSelectedCitySize } from '../../composition/resolveCitySize.js';
import { runGameTick } from '../../composition/runGameTick.js';
import { bindSessionRuntime } from '../../composition/sessionRuntime.js';
import { syncSessionHud } from '../../composition/syncSessionHud.js';
import { notifyBudgetCleanupIfNeeded } from '../dom/compta/tresorerie/CleanupNotificationPresenter.js';
import { DEFAULT_TICK_MS } from '../../shared/gameplay/SimulationDefaults.js';
import { GameLoop } from '../../engine/loop/GameLoop.js';
import {
  overOverlay,
  infoObjectOverlay,
  infoObjectCloseBtn,
} from '../dom/shell/nodes.js';
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
} from '../dom/shell/BuildingNotifications.js';
import { presentBuildingInfoSelection } from '../dom/info/BuildingInfoPanel.js';
import { isRoadBuildingType } from '../../contexts/construction/domain/policies/FootprintAvailabilityPolicy.js';
import { listRoadPaintCells } from '../../contexts/construction/domain/policies/RoadPaintPolicy.js';
import {
  cycleStonePathOrientationIndex,
  isStonePathTool,
  stonePathOrientationIndex,
  stonePathOrientationLabel,
  stonePathTypeForIndex,
} from '../../contexts/construction/domain/policies/StonePathOrientationPolicy.js';

ensureGameRuntimeBootstrapped();

export function createGame(gameStore, assetManager, citySize = null) {
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

  function getTickIntervalMs() {
    return Math.max(500, Math.min(20000, parseInt(localStorage.getItem('speed'), 10) || 4000));
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

  scene.initialize(city).then(() => {
    loaderManager.hide(500);
    setTimeout(() => {
      invokeStartTutorial();
    }, 800);
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
      const { buildingId } = await constructionApi.bulldozeBuildingAtTile({
        city,
        x,
        y,
        meshInstanceId: selectedObject.userData?.instanceId ?? null,
      });
      await scene.update(city, time);
      await syncEmploymentAfterBuildingChange(scene, city, buildingId);
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
        infoObjectOverlay.classList.remove('active');
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.classList.remove('pointer-events-disabled');
        }
        if (game && typeof game.play === 'function') {
          game.play();
        }
      }

      // Cesar III: first click anchors, hold+drag paints further tiles
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
        infoObjectOverlay.classList.remove('active');
        const canvas = document.querySelector('canvas');
        if (canvas) {
          canvas.classList.remove('pointer-events-disabled');
        }
        if (game && typeof game.play === 'function') {
          game.play();
        }
      }

      const { x: placeX, y: placeY } = selectedObject.userData;
      const result = await constructionApi.placeBuildingAtTile({
        city,
        x: placeX,
        y: placeY,
        buildingType: activeToolId,
        gameTurn: time,
      });

      if (!result.success) {
        if (result.reason === 'in_progress') {
          return;
        }
        if (result.reason === 'insufficient_funds') {
          showInsufficientFundsNotification(activeToolId, result.price || 0);
        } else if (result.reason) {
          showGenericErrorNotification(activeToolId, result.reason);
        }
        return;
      }

      await scene.update(city, time);
      await runSimulationPass(time);
      await syncEmploymentAfterBuildingChange(scene, city, activeToolId);
      await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
      const multiplayerManager = getMultiplayerManager();
      if (multiplayerManager?.isMultiplayer) {
        try {
          await multiplayerManager.placeBuilding(activeToolId, placeX, placeY);
        } catch (error) {
          console.warn('[Multiplayer] Erreur envoi bâtiment:', error);
        }
      }
      if (game) {
        game.play();
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
  };

  scene.onRoadPaintEnd = async () => {
    await finalizeRoadPaintSession();
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
    return true;
  };

  window.addEventListener('mouseup', () => {
    if (roadPaint.active) {
      void finalizeRoadPaintSession();
    }
  });

  const canvasEl = scene.domElement || document.querySelector('canvas');
  if (canvasEl) {
    canvasEl.addEventListener('mousedown', scene.onMouseDown.bind(scene), false);
    canvasEl.addEventListener('mouseup', scene.onMouseUp.bind(scene), false);
    canvasEl.addEventListener('mousemove', scene.onMouseMove.bind(scene), false);
    canvasEl.addEventListener('wheel', scene.onMouseWheel.bind(scene), { passive: false });
    canvasEl.addEventListener('touchstart', scene.onTouchStart.bind(scene), { passive: false });
    canvasEl.addEventListener('touchmove', scene.onTouchMove.bind(scene), { passive: false });
    canvasEl.addEventListener('touchend', scene.onTouchEnd.bind(scene), { passive: false });
    document.addEventListener('keydown', scene.onKeyBoardDown.bind(scene), false);
    document.addEventListener('keyup', scene.onKeyBoardUp.bind(scene), false);
  } else {
    document.addEventListener('mousedown', scene.onMouseDown.bind(scene), false);
    document.addEventListener('mouseup', scene.onMouseUp.bind(scene), false);
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
      infoObjectOverlay.classList.remove('active');
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
