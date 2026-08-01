/**
 * Game session facade — interaction + GameLoop API.
 * Context / treasury / tick wiring live in composition/.
 */

import { registerAppService, getMultiplayerManager, invokeStartTutorial } from '../../js/acl/appRuntime.js';
import { createScene } from './scene.js';
import { createCity } from './city.js';
import { syncEmploymentAfterBuildingChange } from '../../js/acl/employment.js';
import { placeBuildingAtTile, bulldozeBuildingAtTile } from '../../js/acl/construction.js';
import { ensureGameRuntimeBootstrapped } from '../../composition/ensureGameRuntimeBootstrapped.js';
import { bootGameContexts } from '../../composition/bootGameContexts.js';
import { bootTreasuryHud } from '../../composition/bootTreasuryHud.js';
import { resolveSelectedCitySize } from '../../composition/resolveCitySize.js';
import { runGameTick } from '../../composition/runGameTick.js';
import { DEFAULT_TICK_MS } from '../../shared/gameplay/SimulationDefaults.js';
import { GameLoop } from '../../engine/loop/GameLoop.js';
import {
  overOverlay,
  infoObjectOverlay,
  infoObjectCloseBtn,
} from '../../ui/shell/nodes.js';
import loaderManager from '../../js/utils/LoaderManager.js';
import objectivesTracker from '../../ui/onboarding/ObjectivesTracker.js';
import InputManager from './InputManager.js';
import gameUI from '../../ui/shell/GameUI.js';
import {
  showInsufficientFundsNotification,
  showGenericErrorNotification,
} from '../../ui/shell/BuildingNotifications.js';
import { presentBuildingInfoSelection } from '../../ui/info/BuildingInfoPanel.js';
import { clearCommercePersistence } from '../../js/acl/commerce.js';

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

  function getTickIntervalMs() {
    return Math.max(500, Math.min(20000, parseInt(localStorage.getItem('speed'), 10) || 4000));
  }

  localStorage.setItem('speed', String(DEFAULT_TICK_MS));

  registerAppService('gameUI', gameUI);
  gameUI.updateTimeDisplay(time);
  bootTreasuryHud({ gameUI });

  const { parcels, supply, housing, runtime } = bootGameContexts();
  const scene = createScene(gameStore, assetManager, parcels, supply, housing);
  const city = createCity(resolveSelectedCitySize(citySize));

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
      const { buildingId } = await bulldozeBuildingAtTile({
        city,
        x,
        y,
        meshInstanceId: selectedObject.userData?.instanceId ?? null,
      });
      await scene.update(city, time);
      await syncEmploymentAfterBuildingChange(scene, city, buildingId);
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
      });
    } else if (
      !tile.buildingId
      || (
        activeToolId
        && (activeToolId === 'roads' || activeToolId === 'Road' || activeToolId.startsWith('StonePath-'))
        && (
          tile.buildingId === 'roads'
          || tile.buildingId === 'Road'
          || (tile.buildingId && tile.buildingId.startsWith('StonePath-'))
        )
      )
    ) {
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
      const result = await placeBuildingAtTile({
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
        gameStore,
        gameUI,
        refreshEmploymentPresentation: refreshEmploymentPresentationForCity,
        objectivesTracker,
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
        clearCommercePersistence();
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
    import('../../ui/shell/mobile-controls.js')
      .then(({ initMobileControls }) => {
        initMobileControls(scene.camera);
      })
      .catch((error) => {
        console.warn('[Game] Failed to initialize mobile controls:', error);
      });
  }

  registerAppService('game', game);

  return game;
}
