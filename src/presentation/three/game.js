/**
 * Game session facade — interaction + GameLoop API.
 * Context / treasury / tick wiring live in composition/.
 */

import {
  registerAppService,
  getMultiplayerManager,
  getObjectivesManager,
  getButtonStateManager,
  isEditorMode,
} from '../../composition/sessionShell.js';
import {
  getMissionMapLayoutId,
  takePendingEditorMap,
  setCustomMapLayoutActive,
} from '../../shared/gameplay/customMapLayout.js';
import { loadEditorMapLayout } from '../../contexts/world-layout/application/queries/LoadEditorMapLayout.js';
import { generateNaturePieces, markDepositTiles } from './managers/ResourceManager.js';
import { getGroundSurface } from '../../shared/editor-catalog/kenneyPlacementProfile.js';
import { propRecordSpec, propsHoldingRecord } from '../../shared/editor-catalog/naturePropCatalog.js';
import { plotMarkRefusal } from '../../shared/land-catalog/plotLayout.js';
import { PLOT_SQUARE_MAX_SIDE, parsePlotTool } from '../../shared/land-catalog/plotTools.js';
import { readEditorMapDocument } from '../../contexts/world-layout/application/queries/EditorMapDocument.js';
import { applyEditorMapLayoutToCity } from '../../contexts/world-layout/application/services/ApplyEditorMapLayoutToCity.js';
import { createEditorNatureStackLayoutPort } from '../../contexts/world-layout/infrastructure/adapters/presentation/EditorNatureStackLayoutAdapter.js';
import { getEditorMapRepository } from '../../composition/editorMapRepository.js';
import { createScene } from './scene.js';
import { createCity, clearCityTiles, initializeEditorCityTiles } from './city.js';
import { syncEmploymentAfterBuildingChange } from '../../composition/syncEmploymentAfterBuildingChange.js';
import { syncSupplyLinksAfterBuildingChange } from '../../composition/syncSupplyLinksAfterBuildingChange.js';
import { isConfirmedBeforeDemolition, previewDemolitionLiquidation } from '../../composition/constructionTreasuryBridge.js';
import { resolveGetTimeInfo } from '../../composition/gameTimeBridge.js';
import { getSharedEventBus } from '../../composition/sharedEventBus.js';
import { PLOTS_CHANGED_EVENT } from '../../composition/createLandContext.js';
import { refreshSupplyPlacementIndex } from '../../contexts/supply/infrastructure/presentation/SupplyPlacementIndex.js';
import { ensureGameRuntimeBootstrapped } from '../../composition/ensureGameRuntimeBootstrapped.js';
import { bootGameContexts } from '../../composition/bootGameContexts.js';
import { bootTreasuryHud } from '../../composition/bootTreasuryHud.js';
import { awaitBudgetReady } from '../../composition/budgetReadyGate.js';
import { isFreshGameIntent } from '../pages/site/bootSession.js';
import { performReset } from '../dom/boot/ResetGameFlow.js';
import { resolveSelectedCitySize } from '../../composition/resolveCitySize.js';
import { hydrateCityTilesFromRows } from '../../contexts/construction/application/services/HydrateCityTilesFromBuildings.js';
import {
  ensureHamletCatalog,
  getActiveHamletId,
  listHamlets,
  parseGameHamletPath,
  getHamlet,
  markHamletNatureSeeded,
  getHamletPlots,
  saveHamletPlots,
  requireActiveHamletId,
  setActiveHamletId,
} from '../../core/persistence/hamlet/hamletSession.js';
import { HAMLET_ACCESS_CHANGED_EVENT, canTravelToHamlet } from '../../core/persistence/hamlet/hamletAccess.js';
import { runGameTick } from '../../composition/runGameTick.js';
import { onNewsModalClosed, presentIncomingNewsEvents, waitForNewsModalClosed } from '../dom/intelligence/NewsEventModal.js';
import { createHudTicker } from '../dom/shell/HudTicker.js';
import { gatherReminderFacts, readRentDebts } from '../../composition/reminderFacts.js';
import { remindersFor } from '../../shared/gameplay/reminderCatalog.js';
import { TimeManager } from '../../shared/time/TimeManager.js';
import { formatEuro } from '../../contexts/accounting/presentation/formatMoney.js';
import { bindSessionRuntime } from '../../composition/sessionRuntime.js';
import { syncSessionHud } from '../../composition/syncSessionHud.js';
import { resetCumulativeDeaths } from '../../composition/gameplayMortalityState.js';
import { computeBuildingReach, listPlacedBuildings } from '../../shared/building-catalog/buildingReach.js';
import { buildingCatalog, getBuildingDefinition, isUndemolishable } from '../../shared/building-catalog/buildingCatalog.js';
import { BUILDING_ASSETS } from './assets/buildingAssets.js';
import { planRoadPaint, plotsAlongPath, roadLevelsMeet, roadPathBetween, roadPiecesFrom, slopeAxisSides, turnedSides } from './placement/roadPaintPlanner.js';
import { resolveFootprint } from '../../shared/asset-footprint/resolveFootprint.js';
import {
  BEHAVIOR_MODE,
  ERASE_SQUARE_MAX_SIDE,
  resolveBehaviorMode,
  shouldReturnToSelectOnEscape,
} from '../../shared/gameplay/behaviorMode.js';
import {
  DEFAULT_TICK_MS,
  clampTickMs,
  msToSpeedLevel,
  speedLevelToDays,
} from '../../shared/gameplay/SimulationDefaults.js';
import { GameLoop } from '../../engine/loop/GameLoop.js';
import {
  overOverlay,
  infoObjectOverlay,
  infoObjectCloseBtn,
} from '../dom/shell/nodes.js';
import { closeBuildingInfoOverlay } from '../dom/info/layout/buildingInfoLayout.js';
import { activateSelectToolButton, closeModal } from '../dom/tools/ToolPanel.js';
import { close as closeMobileBuildBar } from '../dom/tools/CompactToolbar.js';
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
  showHubCascadeNotification,
  confirmDemolition,
  showDemolitionRefusedNotification,
  showClientPriorityNotification,
  showPlacementNeedsNotification,
  showPopulationDepartureNotification,
} from '../dom/shell/BuildingNotifications.js';
import { hideToast, showErrorToast, showToast } from '../dom/shell/ToastNotifier.js';
import { presentBuildingInfoSelection } from '../dom/info/presenters/useBuildingInfoSelection.js';
import { buildingPlacementCatalog } from '../../shared/building-catalog/index.js';
import {
  createPlacementGhostSession,
  isPlaceableBuildingTool,
} from './placement/placementGhostSession.js';
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
} from './placement/placementKeyboardNudge.js';
import { prefersTouchPlacementFlow } from './touchPlacementInput.js';
import { canPlaceBuildingAtTileWithSupplyRules } from '../../composition/canPlaceBuildingAtTileWithSupplyRules.js';
import { isRoadBuildingType } from '../../composition/constructionCatalog.js';
import { createPlacementRotationHud } from './placement/placementRotationHud.js';
import { getSelectableMeshIds, resolveSelectedMeshId } from './meshs/resolveBuildingMesh.js';
import { readGameClock, writeGameClock } from '../../core/persistence/game-clock/gameClock.js';
import { showTutorialObjective } from '../dom/onboarding/TutorialObjective.js';
import { clearHighlight, highlightTarget, keepPointingAt } from '../dom/onboarding/tutorialHighlight.js';
import { updateStatusIconTooltip } from '../dom/tools/StatusIconTooltip.js';

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

/** Stops the previous game's listener when a new game is created in the same page. */
let stopPopulationDepartureToasts = null;
let stopCompanyLiquidationToasts = null;
let stopBuildingCollapseToasts = null;
let stopBuildingCollapseFailureToasts = null;
let stopCompanyLiquidationFailureToasts = null;
let stopPlotsChanged = null;

export function createGame(gameStore, assetManager, citySize = null) {
  resetCumulativeDeaths();

  let activeToolId = '';
  /** How many times S was pressed for the active tool — see resolveSelectedMeshId. */
  let selectedMeshIndex = 0;

  /** Catalog id actually previewed/placed for the active tool (S-selected mesh). */
  function resolvePlacementBuildingId(toolId = activeToolId) {
    return toolId === activeToolId ? resolveSelectedMeshId(toolId, selectedMeshIndex) : toolId;
  }
  let time = 0;
  let isPause;
  /** @type {{ resumeOnExit: boolean } | null} set while the construction mode pauses the game */
  let constructionPause = null;
  let isOver;
  let infos = {};
  /** @type {GameLoop | null} */
  let gameLoop = null;
  /** @type {ReturnType<typeof createGame> extends infer T ? T : never} */
  let game;

  /**
   * Cesar III road drag (click + hold): the road is an L from where the player pressed to the cursor, shown before
   * it is laid and laid on release, each tile with the piece and turn that fit its neighbours.
   */
  let roadPaint = {
    active: false,
    anchor: null,
    axis: null,
    path: [],
    placedCount: 0,
    busy: false,
  };
  const roadPieces = roadPiecesFrom(BUILDING_ASSETS);

  /**
   * The placement gate (footprint, ground, the catalog's limits and requirements) plus the one thing only the road pieces know: on a slope a road goes
   * straight up or down it, never across (a bend, a tee or a side road would leave the ramp over its flank).
   */
  function canPlaceHere(params) {
    const result = canPlaceBuildingAtTileWithSupplyRules(params);
    if (!result.ok || !isRoadBuildingType(params.buildingType)) {
      return result;
    }
    const { tiles } = params.city;
    const here = { x: params.x, y: params.y };
    const slope = tiles[params.x]?.[params.y]?.relief?.slope;
    if (slope) {
      const piece = roadPieces.find((candidate) => candidate.id === params.buildingType);
      if (!piece) {
        throw new Error(`[game] the road "${params.buildingType}" has no roadSides: cannot tell whether it follows a slope`);
      }
      const axis = slopeAxisSides(slope);
      const follows = turnedSides(piece.sides, params.rotationStep ?? 0).every((side) => axis.includes(side));
      if (!follows) {
        return { ...result, ok: false, reason: 'ground_slope_direction' };
      }
    }
    // A road only changes level along a slope: it may not touch a road standing at another height
    const stepsUp = [[0, -1], [1, 0], [0, 1], [-1, 0]].some(([dx, dy]) => {
      const next = { x: params.x + dx, y: params.y + dy };
      const neighbour = tiles[next.x]?.[next.y];
      return neighbour?.buildingId
        && isRoadBuildingType(neighbour.buildingId)
        && !roadLevelsMeet(here, next, tiles[params.x]?.[params.y]?.relief, neighbour.relief);
    });
    return stepsUp ? { ...result, ok: false, reason: 'ground_road_level' } : result;
  }

  /**
   * The same press-and-drag for a house: from where the player pressed to the cursor, as many plots as fit along
   * the L, shown before they are placed and placed on release (a plain click places the one plot).
   */
  let housePaint = {
    active: false,
    anchor: null,
    axis: null,
    path: [],
    busy: false,
  };

  /** Demolition, also Cesar III style: a square from where the player pressed to the cursor, demolished on release. */
  let erasePaint = {
    active: false,
    anchor: null,
    end: null,
    busy: false,
  };

  /** The town hall's land tools (Terrains tab): a square from where the player pressed to the cursor, marked or cleared on release. */
  let plotPaint = {
    active: false,
    anchor: null,
    end: null,
    busy: false,
  };
  /** The tiles the town hall holds for sale, with the use each is reserved for: { x, y, use }. */
  let plots = [];

  /** Touch/tablet: anchor ghost + rotation HUD before confirming placement. */
  let touchPendingPlacement = null;

  /**
   * Touch/tablet: a road or a row of houses / fields was dragged out and the finger has lifted. The plan stays previewed, and the button of the bar below
   * (confirm only: the pieces and their turn are chosen by the plan, there is nothing to turn or to change) lays it. A new drag replaces it.
   */
  let touchPaintPending = false;

  /** The plan waiting to be confirmed is given up (a new drag, another tool, Escape, or it was laid): the bar goes. */
  function dropTouchPaintPending() {
    if (!touchPaintPending) {
      return;
    }
    touchPaintPending = false;
    placementRotationHud?.hide();
  }

  function usesTouchPlacementRotationFlow(toolId) {
    return prefersTouchPlacementFlow()
      && isPlaceableBuildingTool(toolId, buildingPlacementCatalog);
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
    const buildingType = resolvePlacementBuildingId(toolId);
    const gridSize = buildingPlacementCatalog[buildingType]?.gridSize ?? 1;
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
      groundElevation: scene.resolveGroundElevation(placeX, placeY, gridSize, gridSize),
      groundSlope: scene.resolveGroundSlope(placeX, placeY),
    });
    placementRotationHud?.show({
      x: placeX,
      y: placeY,
      gridSize,
      canSelectMesh: getSelectableMeshIds(toolId).length > 0,
    });
  }

  /** Keep a placement / demolition in the city's history; history must never break the game. */
  async function recordBuildingHistory(event, building) {
    try {
      await supply.recordBuildingEvent({ timeInfo: resolveGetTimeInfo()(time), event, building });
    } catch (error) {
      console.warn('[game] Could not record the building event:', error);
    }
  }

  /** The first time a building the catalog says so is built, a dépêche tells the player what it is for. A failure shows, it never stops the game. */
  async function announceFirstBuiltNews(buildingType) {
    const milestoneId = getBuildingDefinition(buildingType)?.firstBuiltNews;
    if (!milestoneId) return;
    try {
      const announced = await sessionApi.intelligence.announceMilestone({ milestoneId, turn: time });
      if (announced) await presentIncomingNewsEvents();
    } catch (error) {
      console.error(`[game] The dépêche "${milestoneId}" could not be announced:`, error);
    }
  }

  /**
   * A tutorial toast: short and non-blocking; it stays as long as the catalog says. A dépêche's modal dims the screen, so a toast waits for it to
   * close (callers present the dépêche first), and its timer only starts then.
   */
  async function showTutorialToast(toast) {
    const { id, duration } = toast;
    waitingTutorialToasts.add(id);
    await waitForNewsModalClosed();
    // Taken off while it waited (the player already did what it points at): it never shows.
    if (!waitingTutorialToasts.has(id)) return;
    queuedTutorialToasts.push(toast);
    // A toast that has waited as long as it would have stayed on screen is stale (a "Bravo" for something done long ago): it is dropped.
    setTimeout(() => {
      const at = queuedTutorialToasts.indexOf(toast);
      if (at === -1) return;
      queuedTutorialToasts.splice(at, 1);
      waitingTutorialToasts.delete(id);
    }, duration);
    pumpTutorialToasts();
  }

  /** Fills the free places of the screen with the queued toasts: the highest priority first, the first come first within a priority. */
  function pumpTutorialToasts() {
    while (tutorialToastsOnScreen.size < MAX_TUTORIAL_TOASTS_ON_SCREEN && queuedTutorialToasts.length > 0) {
      let best = 0;
      queuedTutorialToasts.forEach((queued, at) => {
        if (queued.priority > queuedTutorialToasts[best].priority) best = at;
      });
      const { id, kind, text, duration, highlight } = queuedTutorialToasts.splice(best, 1)[0];
      if (!waitingTutorialToasts.delete(id)) continue;
      shownTutorialToasts.set(id, { shown: showToast(kind, text, { timeout: duration }), highlight });
      tutorialToastsOnScreen.add(id);
      if (highlight) highlightTarget(highlight);
      setTimeout(() => releaseTutorialToastPlace(id), duration);
    }
  }

  /** A toast has left the screen (its time is over, or it was taken off): its place goes to the next in the queue. */
  function releaseTutorialToastPlace(id) {
    if (tutorialToastsOnScreen.delete(id)) pumpTutorialToasts();
  }

  /**
   * The construction buttons the tutorial's current step lets work: the other construction buttons are greyed out (null: nothing is restricted). Every
   * button the build bar creates later takes the same state.
   */
  function applyTutorialAllowedTools(allowed) {
    getButtonStateManager().restrict(allowed, (buttonId) => Boolean(getBuildingDefinition(buttonId)));
  }

  /** Whether the catalog limits how many of that building a hamlet can hold (`maxPerHamlet`). */
  function isLimitedBuilding(buildingType) {
    return getBuildingDefinition(buildingType)?.maxPerHamlet !== undefined;
  }

  /**
   * A building the catalog limits per hamlet (`maxPerHamlet`, the mayor's house: one) has its construction button greyed once the hamlet holds as many as it
   * can, and lit again only when one is destroyed or the hamlet has none (another hamlet, a new game). This reads the city's tiles, every building counted
   * once (a building covers several tiles): it runs only when one of those buildings is placed or demolished, and when the hamlet changes — never every turn.
   */
  function syncLimitedBuildingButtons() {
    const limited = Object.entries(buildingCatalog).filter(([, definition]) => definition.maxPerHamlet !== undefined);
    if (limited.length === 0) return;
    const standing = new Map(limited.map(([type]) => [type, new Set()]));
    for (const column of city?.tiles ?? []) {
      for (const tile of column ?? []) {
        const instances = standing.get(tile?.buildingId);
        if (!instances) continue;
        if (!tile.instanceId) throw new Error(`[game] a "${tile.buildingId}" stands on a tile with no instanceId: it cannot be counted against maxPerHamlet`);
        instances.add(tile.instanceId);
      }
    }
    const manager = getButtonStateManager();
    for (const [type, definition] of limited) {
      if (standing.get(type).size >= definition.maxPerHamlet) manager.disable(type);
      else manager.enable(type);
    }
  }

  let limitedButtonsHamletId = null;

  /** A hamlet other than the one the buttons were last set for (the first look, a hamlet switch, a load): read what it holds. Otherwise one id comparison. */
  function syncLimitedBuildingButtonsOnHamletChange() {
    const hamletId = requireActiveHamletId();
    if (hamletId === limitedButtonsHamletId) return;
    limitedButtonsHamletId = hamletId;
    syncLimitedBuildingButtons();
  }

  /** The tutorial toasts waiting (for a dépêche to be closed, or for a free place on the screen), and the ones on screen (to take them off early). */
  const waitingTutorialToasts = new Set();
  const shownTutorialToasts = new Map();
  /** How many tutorial toasts the screen holds at once: the others queue, the higher priority first (see TOAST_PRIORITIES). */
  const MAX_TUTORIAL_TOASTS_ON_SCREEN = 2;
  const queuedTutorialToasts = [];
  const tutorialToastsOnScreen = new Set();

  /** The player did what a toast points at (or its moment is over): it leaves the screen, and its highlight with it. */
  function hideTutorialToast(id) {
    waitingTutorialToasts.delete(id);
    const entry = shownTutorialToasts.get(id);
    if (!entry) return;
    shownTutorialToasts.delete(id);
    void hideToast(entry.shown);
    if (entry.highlight) clearHighlight();
    releaseTutorialToastPlace(id);
  }

  /**
   * After a placement, the tutorial gives its next instruction if the city has reached it (nothing outside a tutorial game). It is called once employment
   * has been redistributed and the no-work sprites refreshed: it then reads the city as the player sees it, not a new building before it was staffed.
   * It waits for the dépêche already open to be read, so two never stack, and it is not awaited by the placement. A failure shows, it never stops the game.
   */
  async function advanceTutorialAfterPlacement() {
    try {
      await waitForNewsModalClosed();
      const { news, toasts, dismissed, allowed, progress, justCompleted } = await sessionApi.gameplay.advanceTutorial();
      applyTutorialAllowedTools(allowed);
      showTutorialObjective({ progress, justCompleted });
      dismissed.forEach(hideTutorialToast);
      if (news) await presentIncomingNewsEvents();
      toasts.forEach(showTutorialToast);
      // The step's button keeps pulsing until its objective is reached (the road button while roads are still to be laid)
      keepPointingAt(progress && progress.highlight && progress.have < progress.target ? progress.highlight : null);
    } catch (error) {
      console.error('[game] The tutorial could not advance:', error);
    }
  }

  // Getting past a dépêche is itself progress (the step's counter shows from then on): look at the tutorial as soon as the modal has closed.
  onNewsModalClosed('tutorial', () => {
    void advanceTutorialAfterPlacement();
  });

  async function finalizeBuildingPlacement(placeX, placeY, buildingType, rotationStep = 0) {
    // A road on a slope goes straight up or down it: the player's own turn (R) may not (the drag picks its own pieces, see `canPlaceHere`)
    if (isRoadBuildingType(buildingType)) {
      const check = canPlaceHere({ city, x: placeX, y: placeY, buildingType, assetCatalog: buildingPlacementCatalog, rotationStep });
      if (!check.ok) {
        showGenericErrorNotification(buildingType, check.reason);
        return false;
      }
    }
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
    await recordBuildingHistory('placed', { id: result.instanceId, type: buildingType, x: placeX, y: placeY });
    await announceFirstBuiltNews(buildingType);

    await scene.update(city, time);
    if (isLimitedBuilding(buildingType)) syncLimitedBuildingButtons();
    await runSimulationPass(time);
    await syncEmploymentAfterBuildingChange(scene, city, buildingType);
    void advanceTutorialAfterPlacement();
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
    // Clamped to the sane range, not snapped to one of the 13 ladder steps: the Settings panel's
    // "secondes entre chaque tour" field wants a precise value, not the nearest preset.
    const raw = parseFloat(localStorage.getItem('speed'));
    return clampTickMs(Number.isFinite(raw) ? raw : DEFAULT_TICK_MS);
  }

  /** Simulated days to batch-advance on the next tick fire — see SPEED_LEVELS_DAYS. */
  function getDaysPerTick() {
    return speedLevelToDays(msToSpeedLevel(getTickIntervalMs()));
  }

  localStorage.setItem('speed', String(DEFAULT_TICK_MS));

  registerAppService('gameUI', gameUI);
  // Inhabitants who leave because a house's standing changed: say so, with the reason
  stopPopulationDepartureToasts?.();
  stopPopulationDepartureToasts = getSharedEventBus().subscribe(
    'housing.populationDeparted',
    showPopulationDepartureNotification
  );
  // A company liquidated for its debts: the map follows (see onCompanyLiquidated)
  stopCompanyLiquidationToasts?.();
  stopCompanyLiquidationToasts = getSharedEventBus().subscribe('gameplay.companyLiquidated', (event) => {
    onCompanyLiquidated(event).catch((error) => console.error('[game] The screen could not follow a liquidated company:', error));
  });
  // A building that collapsed for want of upkeep: the map follows, and the player is told who died (see onBuildingCollapsed)
  stopBuildingCollapseToasts?.();
  stopBuildingCollapseToasts = getSharedEventBus().subscribe('gameplay.buildingCollapsed', (event) => {
    onBuildingCollapsed(event).catch((error) => console.error('[game] The screen could not follow a collapsed building:', error));
  });
  stopBuildingCollapseFailureToasts?.();
  stopBuildingCollapseFailureToasts = getSharedEventBus().subscribe('gameplay.buildingCollapseFailed', (failure) => {
    showErrorToast(`🏚️ ${failure.name} menace de s'effondrer mais n'a pas pu être démoli : ${failure.reason}. Nouvel essai le mois prochain.`, { timeout: 8000 });
  });
  // A company that could not be liquidated stays, and the player is told (it is tried again next month)
  stopCompanyLiquidationFailureToasts?.();
  stopCompanyLiquidationFailureToasts = getSharedEventBus().subscribe('gameplay.companyLiquidationFailed', (failure) => {
    showErrorToast(`🏦 ${failure.name} est en faillite mais n'a pas pu être liquidée : ${failure.reason}. Nouvel essai le mois prochain.`, { timeout: 8000 });
  });
  gameUI.updateTimeDisplay(time);
  const freshGame = isFreshGameIntent();

  // The contexts first: the accounting is a singleton wired (labour market, selling prices) by this call, so nothing
  // may ask for it before.
  const {
    parcels,
    supply,
    housing,
    employment,
    gameplay,
    construction,
    accounting,
    trade,
    land,
    sessionApi,
    runtime,
  } = bootGameContexts();
  bootTreasuryHud({
    gameUI,
    freshGame,
    // Returning to a save resumes its day counter; only a new game starts at day 0.
    restoreClock: async () => {
      time = freshGame ? 0 : await readGameClock();
      if (freshGame) await writeGameClock(0);
    },
  });
  const { construction: constructionApi } = sessionApi;
  // A company bought some of the land for sale: the map takes the plots as the hamlet keeps them now (the owned ones turn dark green)
  stopPlotsChanged?.();
  stopPlotsChanged = getSharedEventBus().subscribe(PLOTS_CHANGED_EVENT, () => {
    loadPlots().catch((error) => console.error('[game] The plots could not be drawn again:', error));
  });  const {
    isRoadBuildingType,
    listRoadPaintCells,
    canPlaceBuildingAtTile,
  } = constructionApi;

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
  /** Why the first load of the hamlet's scene failed (null while it loads or once it has loaded): no day may be simulated on a scene that does not exist. */
  let sceneLoadError = null;

  async function loadActiveHamletScene() {
    loaderManager.setStep('Chargement du hameau…');
    if (!getActiveHamletId()) {
      await ensureHamletCatalog({ requestedId: parseGameHamletPath(window.location.pathname) });
    }
    // The skill priorities are the hamlet's own (set from the work panel while in it): read them in as the hamlet becomes the active one, boot or travel.
    await employment.loadSkillPriorities(requireActiveHamletId());
    const activeChip = document.getElementById('game-active-hamlet');
    const activeHamlet = (await listHamlets()).find((h) => h.id === getActiveHamletId());
    if (activeChip && activeHamlet) {
      activeChip.textContent = activeHamlet.name;
      activeChip.title = `Hameau actif : ${activeHamlet.name}`;
      activeChip.hidden = false;
    }
    for (const link of document.querySelectorAll('a[href="/world"]')) {
      link.href = `/world?hamlet=${getActiveHamletId()}`;
    }
    const rows = await constructionApi.listAllBuildingRows();
    loaderManager.setStep('Lecture des bâtiments…');
    const mapLayoutId = getMissionMapLayoutId();
    const hamlet = await getHamlet(getActiveHamletId());
    // Nothing on the grid is decor: every tree, rock or flower is a piece of the map (a prop with its coordinates) AND a record of the hamlet that says what it
    // holds. The records are what the hamlet keeps: a piece stands while its record does (one cleared is gone for good, with what it held). The first load of a
    // hamlet gives each piece its record: those of the map file, or the pieces generated at random for a new hamlet.
    const isNatureRecord = (row) => row.category === 'nature';
    const pieceOfRecord = (row) => {
      if (!row.piece) {
        throw new Error(`[game] the record "${row.name}" of nature at (${row.x}, ${row.y}) has no piece of the map: it cannot stand on the grid`);
      }
      return {
        id: `nature-${row.instanceId ?? row.id}`,
        assetId: row.piece.assetId,
        x: row.x,
        y: row.y,
        rotationY: row.piece.rotationY,
        baseLocalY: row.piece.baseLocalY,
        parentId: null,
        anchor: 'terrain',
      };
    };
    /** The pieces that have no record yet: { piece, type, stocks } */
    let natureToSeed = [];
    /** Whether this hamlet is a new one whose nature is generated at random. */
    let generatesNature = false;
    let hydrateEditorLayout = false;

    if (mapLayoutId) {
      setCustomMapLayoutActive(true);
      const layout = await loadEditorMapLayout(getEditorMapRepository(), mapLayoutId);
      if (city.size !== layout.citySize) {
        throw new Error(
          `City size ${city.size} does not match custom map ${layout.citySize}`
        );
      }
      const groundPieces = layout.stackObjects.filter((piece) => propRecordSpec(piece.assetId) === null);
      let naturePieces;
      if (hamlet?.natureSeeded) {
        naturePieces = rows.filter(isNatureRecord).map(pieceOfRecord);
      } else {
        natureToSeed = propsHoldingRecord(layout.stackObjects);
        naturePieces = natureToSeed.map(({ piece }) => piece);
      }
      applyEditorMapLayoutToCity(city, { ...layout, stackObjects: [...groundPieces, ...naturePieces] }, createEditorNatureStackLayoutPort());
      hydrateEditorLayout = true;
    } else if (isEditorMode()) {
      const editorMap = takePendingEditorMap();
      if (editorMap) {
        // The map the player chose in the editor menu: the editor opens on it, as on a mission's map
        applyEditorMapLayoutToCity(city, readEditorMapDocument(editorMap), createEditorNatureStackLayoutPort());
        hydrateEditorLayout = true;
      } else {
        initializeEditorCityTiles(city);
      }
    } else {
      // What the game holds must stand on the map it is drawn on: said by name here, not found later as a hole in the grid.
      for (const row of rows) {
        const x = row.anchorX ?? row.x;
        const y = row.anchorY ?? row.y;
        // (a row with no position is not on the map: hydrateCityTilesFromRows leaves it out too)
        if (typeof x === 'number' && typeof y === 'number' && !city.tiles[x]?.[y]) {
          throw new Error(`[game] "${row.name ?? row.type}" (${row.type}) is at (${x}, ${y}), outside the ${city.size} x ${city.size} map of this game`);
        }
      }
      // Buildings stamp the grid; the nature does not (it is pieces of the map, below)
      hydrateCityTilesFromRows(city, rows.filter((row) => !isNatureRecord(row)), buildingPlacementCatalog);
      let naturePieces;
      if (hamlet?.natureSeeded) {
        naturePieces = rows.filter(isNatureRecord).map(pieceOfRecord);
      } else if (rows.length === 0) {
        generatesNature = true;
        natureToSeed = generateNaturePieces(city);
        naturePieces = natureToSeed.map(({ piece }) => piece);
      } else {
        naturePieces = [];
      }
      const stackPort = createEditorNatureStackLayoutPort();
      stackPort.resetStackObjects();
      stackPort.importStackObjects(naturePieces);
      // What stands on a tile is read once, here: a tree or a rock is in the way of a building
      for (const { x, y, assetId } of naturePieces) {
        if (!city.tiles[x]?.[y]) {
          throw new Error(`[game] the piece of nature "${assetId}" is at (${x}, ${y}), outside the ${city.size} x ${city.size} map of this game`);
        }
        city.tiles[x][y].relief = getGroundSurface(naturePieces, x, y, city.tiles[x][y].terrainId);
      }
    }
    // The records of the pieces: what each is and what it holds (the kind the lumberjacks or the quarries look for); the picture is the piece itself
    for (const { piece, type, stocks } of natureToSeed) {
      const placed = await constructionApi.placeBuildingRecord({
        name: `${piece.assetId}-${piece.x}-${piece.y}`,
        type,
        category: 'nature',
        x: piece.x,
        y: piece.y,
        pop: 0,
        stocks: { ...stocks },
        maxStocks: { ...stocks },
        roads: 0,
        price: 0,
        isBuilding: false,
        piece: { assetId: piece.assetId, rotationY: piece.rotationY, baseLocalY: piece.baseLocalY },
      });
      if (!placed?.success) {
        throw new Error(`[game] the piece of the map "${piece.assetId}" at (${piece.x}, ${piece.y}) could not be given its record: ${placed?.error ?? 'refused'}`);
      }
    }
    if (generatesNature) {
      markDepositTiles(city);
    }
    // (the tag reaches the dev log: `pnpm console:tag seed`)
    const recordsAfter = (await constructionApi.listAllBuildingRows()).filter(isNatureRecord);
    console.info(`[seed] hamlet ${getActiveHamletId()}: seeded=${Boolean(hamlet?.natureSeeded)} generated=${generatesNature} toSeed=${natureToSeed.length} natureRecords=${recordsAfter.length} rows=${rows.length}`);

    loaderManager.setStep('Construction de la scène 3D…');
    await scene.initialize(city, { hydrateEditorLayout });
    if (import.meta.env.DEV) Object.assign(window, { __scene: scene, __city: city });
    if (generatesNature || (mapLayoutId && !hamlet?.natureSeeded)) {
      await markHamletNatureSeeded(getActiveHamletId());
    }
    await scene.update(city, time);
    // The editor draws a map, it holds no land for sale
    if (!isEditorMode()) await loadPlots();
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
      window.history.replaceState(null, '', `/game/${hamletId}`);
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

  /** S / HUD button while a touch placement is pending: re-anchor the ghost on the next mesh. */
  function selectMeshForPendingPlacement() {
    if (!touchPendingPlacement) {
      return;
    }
    const { x, y, toolId, rotationStep } = touchPendingPlacement;
    if (getSelectableMeshIds(toolId).length === 0) {
      return;
    }
    selectedMeshIndex += 1;
    const buildingType = resolvePlacementBuildingId(toolId);
    const gridSize = buildingPlacementCatalog[buildingType]?.gridSize ?? 1;
    touchPendingPlacement.buildingType = buildingType;
    touchPendingPlacement.gridSize = gridSize;
    scene.placementGhost.anchor(buildingType, x, y, true, gridSize, {
      rotationStep,
      groundElevation: scene.resolveGroundElevation(x, y, gridSize, gridSize),
      groundSlope: scene.resolveGroundSlope(x, y),
    });
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
    onSelectMesh: () => selectMeshForPendingPlacement(),
    // Nothing is built: the ghost, or the dragged plan, goes, and so does the tool (back to the hand, as Escape does), or the next touch on the map would
    // put the same building in front of the player again
    onCancel: () => {
      cancelRoadPaint();
      cancelHousePaint();
      cancelTouchPendingPlacement();
      scene.onEnterSelectMode?.();
    },
    onConfirm: async () => {
      if (touchPaintPending) {
        // The dragged plan is laid (the commit puts the bar away)
        await commitRoadPaint();
        await commitHousePaint();
        return;
      }
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

  /**
   * Before placing: what the building under the ghost WOULD reach, lit as in range mode — so the
   * spot is judged before paying. Recomputed only when the ghost's type, spot or footprint changes.
   */
  let lastReachPreviewKey = null;
  function showReachOfGhost(preview) {
    if (!preview || isEditorMode() || !getBuildingDefinition(preview.type)?.resourceRoles?.length) {
      if (lastReachPreviewKey !== null) scene.reachOverlay.clear();
      lastReachPreviewKey = null;
      return;
    }
    const key = `${preview.type}|${preview.x}|${preview.y}|${preview.width}|${preview.height}`;
    if (key === lastReachPreviewKey) return;
    lastReachPreviewKey = key;
    const { buildings, roadTiles } = listPlacedBuildings(city);
    const tiles = [];
    for (let dx = 0; dx < preview.width; dx += 1) {
      for (let dy = 0; dy < preview.height; dy += 1) tiles.push({ x: preview.x + dx, y: preview.y + dy });
    }
    const origin = { instanceId: '__ghost__', type: preview.type, x: preview.x, y: preview.y, tiles };
    scene.reachOverlay.show(computeBuildingReach(origin, buildings, roadTiles));
  }

  const placementGhostSession = createPlacementGhostSession({
    getGhost: () => scene.placementGhost,
    getCity: () => city,
    getActiveToolId: () => activeToolId,
    getEffectiveAssetId: () => resolvePlacementBuildingId(),
    assetCatalog: buildingPlacementCatalog,
    isPlaceableTool: (toolId) => isActivePlacementTool(toolId),
    getFocusedObject: () => scene.focusedObject,
    onReachPreview: (preview) => showReachOfGhost(preview),
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
      // The same gate as the placement itself (footprint, then the catalog's limits and requirements): blue says the click will place, red that it will not
      return canPlaceHere(params);
    },
    getGroundElevation: (x, y, width, depth) => scene.resolveGroundElevation(x, y, width, depth),
    getGroundSlope: (x, y) => scene.resolveGroundSlope(x, y),
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

  // The bar of reminders under the HUD: the rules of the catalog, read against the hamlet each time it changes (a placement, a demolition, a day).
  const hudTicker = createHudTicker(document.getElementById('hud-ticker'));
  /** The rents owed change once a month, with the settlement: read once a month, not at every refresh. */
  let rentDebtsReading = { month: null, debts: { debtors: 0, total: 0 } };
  /** The game's opening (the dépêches that guide the player) is over: until then the bar says nothing, the dépêches do the talking. */
  let openingOver = false;

  async function refreshHudReminders() {
    if (isEditorMode()) return;
    const month = Math.floor(time / TimeManager.DAYS_PER_MONTH);
    if (rentDebtsReading.month !== month) {
      rentDebtsReading = { month, debts: await readRentDebts() };
    }
    const facts = await gatherReminderFacts({ city, rentDebts: rentDebtsReading.debts, activeToolId, openingOver });
    hudTicker.show(remindersFor(facts, { euro: formatEuro }));
  }
  awaitBudgetReady().then(() => {
    openingOver = true;
    return refreshHudReminders();
  }).catch((error) => console.error('[game] The opening did not end, the reminders stay silent:', error));

  async function refreshPlacementPresentation() {
    const rows = await constructionApi.listAllBuildingRows();
    refreshSupplyPlacementIndex(rows);
    await refreshHudReminders();
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
    trade,
    ecsRuntime: runtime,
    sessionApi,
  });

  hamletSceneGate = loadActiveHamletScene().then(async () => {
    await refreshPlacementPresentation();
    await refreshEmploymentPresentationForCity();
    loaderManager.hide(500);
    scene.onEnterSelectMode?.();
  }).catch((error) => {
    // Sans ce filet, une erreur ici (asset manquant, réseau mobile instable,
    // perte de contexte WebGL...) laissait le loader bloqué
    // bloqué indéfiniment, sans aucun message pour le joueur.
    // Tagged `[game]` so that it reaches the dev log (`pnpm console:tag game`): a tag with a dot is not relayed.
    console.error('[game] the hamlet scene could not be loaded:', error);
    sceneLoadError = error;
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
  async function placeRoadTile(x, y, piece = null) {
    if (!isRoadBuildingType(activeToolId)) {
      return 'skip';
    }
    if (!city?.tiles?.[x]?.[y]) {
      return 'skip';
    }

    // The drag says which piece and turn this tile takes; a single click uses the player's own (S, R).
    const buildingType = piece?.buildingId ?? resolvePlacementBuildingId();
    const rotationStep = piece?.rotationStep ?? getPlacementRotationStep();
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
      placementRotationStep: rotationStep,
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

  /** The sides the road already on a tile reaches, from its piece and its turn (none when it holds no road). */
  function existingRoadSides(x, y) {
    const tile = city.tiles?.[x]?.[y];
    if (!tile?.buildingId || !isRoadBuildingType(tile.buildingId)) return [];
    const piece = roadPieces.find((candidate) => candidate.id === tile.buildingId);
    return piece ? turnedSides(piece.sides, tile.placementRotationStep ?? 0) : [];
  }

  /**
   * What the drag would lay: each tile of the L with its piece and turn, cut at the first tile that cannot take a
   * road (a road does not jump an obstacle). `valid` is what would be laid, `blocked` the rest of the path.
   */
  function planRoadDrag() {
    const plan = planRoadPaint({ path: roadPaint.path, pieces: roadPieces, existingSides: existingRoadSides })
      .map((step) => (step.single
        ? { x: step.x, y: step.y, buildingId: resolvePlacementBuildingId(), rotationStep: getPlacementRotationStep() }
        : step));

    const valid = [];
    const blocked = [];
    for (const step of plan) {
      const inCity = step.x >= 0 && step.y >= 0 && step.x < city.size && step.y < city.size;
      const fits = blocked.length === 0 && inCity && canPlaceHere({
        city,
        x: step.x,
        y: step.y,
        buildingType: step.buildingId,
        assetCatalog: buildingPlacementCatalog,
        rotationStep: step.rotationStep,
      }).ok;
      // The tile before it is not built yet: the two must meet at the same height all the same
      const before = valid[valid.length - 1];
      const meets = !fits || !before
        || roadLevelsMeet(before, step, city.tiles[before.x]?.[before.y]?.relief, city.tiles[step.x]?.[step.y]?.relief);
      (fits && meets ? valid : blocked).push(step);
    }
    return { valid, blocked };
  }

  function showRoadDragPreview() {
    const { valid, blocked } = planRoadDrag();
    scene.roadPaintPreview.show({ valid, blocked });
  }

  /** The player let go of the road tool, or of Escape: nothing is laid. */
  function cancelRoadPaint() {
    dropTouchPaintPending();
    roadPaint.active = false;
    roadPaint.anchor = null;
    roadPaint.axis = null;
    roadPaint.path = [];
    scene.roadPaintPreview.clear();
  }

  /** The button is released: lay the road that was previewed, then bring the city up to date once. */
  async function commitRoadPaint() {
    if (!roadPaint.active || roadPaint.busy) {
      return;
    }
    roadPaint.busy = true;
    try {
      const { valid, blocked } = planRoadDrag();
      cancelRoadPaint();
      roadPaint.placedCount = 0;

      // Not one tile could take a road (where the drag began, something is in the way): say so.
      if (valid.length === 0 && blocked.length > 0) {
        showGenericErrorNotification(activeToolId, 'area_not_available');
        return;
      }

      for (const step of valid) {
        const tile = city.tiles[step.x][step.y];
        // A tile that already is that piece, turned that way, is left alone (and not paid twice).
        if (tile.buildingId === step.buildingId && (tile.placementRotationStep ?? 0) === ((step.rotationStep % 4) + 4) % 4) {
          continue;
        }
        if ((await placeRoadTile(step.x, step.y, step)) === 'fail') {
          break;
        }
      }

      const placed = roadPaint.placedCount;
      roadPaint.placedCount = 0;
      if (placed <= 0) {
        return;
      }
      await scene.update(city, time);
      await runSimulationPass(time);
      await syncEmploymentAfterBuildingChange(scene, city, activeToolId);
      void advanceTutorialAfterPlacement();
      await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
      if (game?.play) {
        game.play();
      }
    } finally {
      roadPaint.busy = false;
    }
  }

  /** The cursor moved: the L is redrawn from where the player pressed. */
  function dragRoadToward(x, y) {
    if (!roadPaint.active || !isRoadBuildingType(activeToolId)) {
      return;
    }
    const { cells, axis } = roadPathBetween(roadPaint.anchor, { x, y }, roadPaint.axis);
    roadPaint.path = cells;
    roadPaint.axis = axis;
    showRoadDragPreview();
  }

  /** A tool whose building takes a plot of the player's land (a house, a field): it can be dragged out like a road. */
  function isPlotDragTool(toolId) {
    const definition = getBuildingDefinition(resolvePlacementBuildingId(toolId));
    // A house the hamlet holds only so many of (the mayor's) is placed one at a time: a dragged row of them could not all be built.
    const isPlot = Boolean(definition?.residentialGroup) || definition?.construction?.category === 'farms';
    return isPlot && definition.maxPerHamlet === undefined;
  }

  /**
   * What the house drag would place: the plots along the path, cut at the first one that cannot take the house
   * (a drag does not jump an obstacle). `valid` is what would be placed, `blocked` the rest; both as plots.
   */
  function planHouseDrag() {
    const buildingType = resolvePlacementBuildingId();
    const rotationStep = getPlacementRotationStep();
    let { width, depth } = resolveFootprint(buildingType);
    if (rotationStep % 2 === 1) [width, depth] = [depth, width];

    const valid = [];
    const blocked = [];
    // Why the first plot that cannot take the house cannot: the player is told that reason, not a guessed one.
    let blockedReason = null;
    for (const plot of plotsAlongPath({ path: housePaint.path, width, depth })) {
      const inCity = plot.x >= 0 && plot.y >= 0 && plot.x + width <= city.size && plot.y + depth <= city.size;
      let fits = false;
      if (blocked.length === 0) {
        if (inCity) {
          const check = canPlaceBuildingAtTileWithSupplyRules({
            city,
            x: plot.x,
            y: plot.y,
            buildingType,
            assetCatalog: buildingPlacementCatalog,
            rotationStep,
          });
          fits = check.ok;
          if (!fits) blockedReason = check.reason;
        } else {
          blockedReason = 'area_not_available';
        }
      }
      (fits ? valid : blocked).push(plot);
    }
    return { valid, blocked, blockedReason, buildingType, rotationStep, width, depth };
  }

  function showHouseDragPreview() {
    const { valid, blocked, width, depth } = planHouseDrag();
    const tilesOf = (plots) => plots.flatMap((plot) => {
      const tiles = [];
      for (let dx = 0; dx < width; dx += 1) {
        for (let dy = 0; dy < depth; dy += 1) tiles.push({ x: plot.x + dx, y: plot.y + dy });
      }
      return tiles;
    });
    scene.roadPaintPreview.show({ valid: tilesOf(valid), blocked: tilesOf(blocked) });
  }

  function cancelHousePaint() {
    dropTouchPaintPending();
    housePaint.active = false;
    housePaint.anchor = null;
    housePaint.axis = null;
    housePaint.path = [];
    scene.roadPaintPreview.clear();
  }

  /** The cursor moved: the houses are replanned from where the player pressed. */
  function dragHousesToward(x, y) {
    if (!housePaint.active || !isPlotDragTool(activeToolId)) {
      return;
    }
    const { cells, axis } = roadPathBetween(housePaint.anchor, { x, y }, housePaint.axis);
    housePaint.path = cells;
    housePaint.axis = axis;
    showHouseDragPreview();
  }

  /** Dev only: how long each step of a placement takes, logged once it is over, to see what makes a house appear late. */
  function createStepTimer(label) {
    const steps = [];
    const start = performance.now();
    let last = start;
    return {
      step(name) {
        const now = performance.now();
        steps.push(`${name} ${Math.round(now - last)}ms`);
        last = now;
      },
      done() {
        if (import.meta.env.DEV) console.info(`[perf] ${label}: ${steps.join(' | ')} | total ${Math.round(performance.now() - start)}ms`);
      },
    };
  }

  /** The placements of released drags, one after the other: a drag released while the previous one is still being placed waits its turn, never lost. */
  let housePlacementQueue = Promise.resolve();

  /** The button is released: the plan is taken now (and the preview cleared), the houses are placed when the ones before are done. */
  async function commitHousePaint() {
    if (!housePaint.active) {
      return;
    }
    const plan = planHouseDrag();
    cancelHousePaint();
    housePlacementQueue = housePlacementQueue.catch(() => {}).then(() => placeHousePlan(plan));
    await housePlacementQueue;
  }

  /** Place the houses that were previewed, then bring the city up to date once. */
  async function placeHousePlan({ valid, blocked, blockedReason, buildingType, rotationStep }) {
    const timer = createStepTimer(`${valid.length} house(s)`);
    housePaint.busy = true;
    try {
      // Not one plot could take the house (where the drag began, something is in the way, or the mayor's house is not built): say why.
      if (valid.length === 0 && blocked.length > 0) {
        showGenericErrorNotification(activeToolId, blockedReason);
        return;
      }

      const placed = [];
      for (const plot of valid) {
        const result = await constructionApi.placeBuildingAtTile({
          city,
          x: plot.x,
          y: plot.y,
          buildingType,
          gameTurn: time,
          placementRotationStep: rotationStep,
        });
        if (!result.success) {
          if (result.reason === 'insufficient_funds') {
            showInsufficientFundsNotification(buildingType, result.price || 0);
          } else if (result.reason && result.reason !== 'in_progress') {
            showGenericErrorNotification(buildingType, result.reason);
          }
          break;
        }
        placed.push({ plot, instanceId: result.instanceId });
        await recordBuildingHistory('placed', { id: result.instanceId, type: buildingType, x: plot.x, y: plot.y });
        const multiplayerManager = getMultiplayerManager();
        if (multiplayerManager?.isMultiplayer) {
          try {
            await multiplayerManager.placeBuilding(buildingType, plot.x, plot.y);
          } catch (error) {
            console.warn('[Multiplayer] Erreur envoi bâtiment:', error);
          }
        }
      }

      timer.step('payment + save + history');
      if (placed.length === 0) {
        return;
      }
      playPlaceBuildingSound();
      await scene.update(city, time);
      timer.step('scene.update (the houses appear)');
      await runSimulationPass(time);
      timer.step('simulation pass');
      await syncEmploymentAfterBuildingChange(scene, city, buildingType);
      timer.step('employment');
      void advanceTutorialAfterPlacement();
      for (const { plot, instanceId } of placed) {
        await syncSupplyLinksAfterBuildingChange({
          supply,
          construction: constructionApi,
          city,
          event: 'placed',
          buildingType,
          instanceId,
          x: plot.x,
          y: plot.y,
        });
      }
      timer.step('supply links');
      await refreshPlacementPresentation();
      timer.step('placement refresh + reminders');
      await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
      timer.step('HUD');
      placementGhostSession.sync(scene.focusedObject);
      if (game?.play) {
        game.play();
      }
    } finally {
      housePaint.busy = false;
      timer.done();
    }
  }

  /** A building collapsed for want of upkeep (WearBuildings.js, `gameplay.buildingCollapsed`): the player is told, and the map and the HUD follow as after a demolition. */
  async function onBuildingCollapsed(event) {
    const victims = event.deaths > 0 ? ` : ${event.deaths} mort${event.deaths > 1 ? 's' : ''}` : ', sans victime';
    showErrorToast(`🏚️ ${event.name} s'est effondré${victims}.`, { timeout: 8000 });
    await scene.update(city, time);
    if (isLimitedBuilding(event.buildingType)) syncLimitedBuildingButtons();
    await syncEmploymentAfterBuildingChange(scene, city, event.buildingType);
    await refreshPlacementPresentation();
    await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
  }

  /** The tiles of the square from where the player pressed to the cursor (inside the city). */
  function eraseSquareTiles() {
    const { anchor, end } = erasePaint;
    const tiles = [];
    for (let x = Math.min(anchor.x, end.x); x <= Math.max(anchor.x, end.x); x += 1) {
      for (let y = Math.min(anchor.y, end.y); y <= Math.max(anchor.y, end.y); y += 1) {
        if (x >= 0 && y >= 0 && x < city.size && y < city.size) tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /** Every tile the building on this one covers (the tiles of its instance); a tile with no instance covers only itself. */
  function tilesOfBuildingAt(x, y) {
    const instanceId = city.tiles[x]?.[y]?.instanceId;
    if (!instanceId) {
      return [{ x, y }];
    }
    const covered = [];
    for (let cx = 0; cx < city.size; cx += 1) {
      for (let cy = 0; cy < city.size; cy += 1) {
        if (city.tiles[cx]?.[cy]?.instanceId === instanceId) covered.push({ x: cx, y: cy });
      }
    }
    return covered;
  }

  /**
   * The eraser's plan: red is what it will take (the WHOLE of each building the square touches: a building goes down whole, not by the part under the square), amber
   * the area drawn where there is nothing to take. A building the catalog forbids to demolish is not tinted: it stays.
   * @param {Array<{ x: number, y: number }>} squareTiles
   * @returns {{ blocked: Array<{ x: number, y: number }>, area: Array<{ x: number, y: number }> }}
   */
  function eraserPlanOf(squareTiles) {
    const taken = new Map();
    const area = [];
    for (const { x, y } of squareTiles) {
      const buildingId = city.tiles[x]?.[y]?.buildingId;
      if (!buildingId) {
        area.push({ x, y });
      } else if (!isUndemolishable(buildingId)) {
        for (const tile of tilesOfBuildingAt(x, y)) taken.set(`${tile.x},${tile.y}`, tile);
      }
    }
    return { blocked: [...taken.values()], area };
  }

  function showEraseDragPreview() {
    const { blocked, area } = eraserPlanOf(eraseSquareTiles());
    scene.roadPaintPreview.show({ valid: [], blocked, area });
  }

  /** The eraser is over a tile, not pressed: the building under it is lit whole, so the player sees what a click would take. */
  function showEraseHoverPreview(focusedObject) {
    const x = focusedObject?.userData?.x;
    const y = focusedObject?.userData?.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      scene.roadPaintPreview.clear();
      return;
    }
    const { blocked } = eraserPlanOf([{ x, y }]);
    if (blocked.length === 0) {
      scene.roadPaintPreview.clear();
      return;
    }
    scene.roadPaintPreview.show({ valid: [], blocked });
  }

  function cancelErasePaint() {
    erasePaint.active = false;
    erasePaint.anchor = null;
    erasePaint.end = null;
    scene.roadPaintPreview.clear();
  }

  /** The cursor moved: the square is redrawn from where the player pressed, and stops growing at the longest side the eraser allows (the preview shows it). */
  function dragEraseToward(x, y) {
    const { anchor } = erasePaint;
    const reach = ERASE_SQUARE_MAX_SIDE - 1;
    erasePaint.end = {
      x: Math.max(anchor.x - reach, Math.min(anchor.x + reach, x)),
      y: Math.max(anchor.y - reach, Math.min(anchor.y + reach, y)),
    };
    showEraseDragPreview();
  }

  /**
   * What demolishing this building brings down, for the question the player is asked first: the people who leave or lose their place, the buildings that cannot work
   * without it, the debts released and the ones nothing pays. Read, nothing is changed.
   * @param {{ type: string, instanceId: string | null }} building
   * @returns {Promise<import('../dom/shell/BuildingNotifications.js').DemolitionConsequences>}
   */
  async function consequencesOfDemolition({ type, instanceId }) {
    if (!instanceId) {
      return { residents: 0, workers: 0, dependents: [], abandoned: [], accounts: [] };
    }
    const row = await constructionApi.getBuildingById(instanceId);
    const isHouse = Boolean(getBuildingDefinition(type)?.residentialGroup);
    const dependents = supply.hasResourceRole(type, 'hub') ? await supply.previewHubCascade({ hubId: instanceId }) : [];
    const books = await previewDemolitionLiquidation({ instanceId, buildingType: type });
    const placed = listPlacedBuildings(city).buildings;
    return {
      residents: isHouse ? (row?.pop ?? 0) : 0,
      workers: row?.employees?.worker ?? 0,
      dependents: dependents.map(({ type: dependentType, x, y }) => ({ type: dependentType, x, y })),
      abandoned: books.abandoned.map((debt) => ({
        debtorType: placed.find((candidate) => candidate.instanceId === debt.debtorId)?.type ?? null,
        label: debt.label,
        amount: debt.amount,
      })),
      accounts: books.accounts,
    };
  }

  /**
   * Demolish the building on each tile (one that already went down with a neighbour is skipped), then bring the city
   * up to date once. Before anything goes, the player is asked once for the whole selection, with what each building brings
   * down (or that it brings down nothing); the roads and the nature, which bring down nothing, are not asked about. "No"
   * spares the whole selection.
   * @param {Array<{ x: number, y: number, instanceId?: string | null }>} targets
   */
  async function demolishTiles(targets) {
    // What the map set on the grid (trees, rocks, bushes...) is cleared too: it costs nothing and brings nothing down. Each piece is a record of the hamlet:
    // the record goes with it, so what it held (the wood of a tree...) goes down in the figures the game counts.
    let clearedProps = 0;
    let clearedRecords = 0;
    for (const target of targets) {
      const removed = scene.removeNaturePropsAt(target.x, target.y);
      clearedProps += removed.length;
      // (the editor has no hamlet records: its pieces are only pieces of the map)
      if (!isEditorMode() && removed.length > 0) {
        const record = await constructionApi.findBuildingAtTile({ x: target.x, y: target.y });
        if (!record) {
          throw new Error(`[game] the piece of nature cleared at (${target.x}, ${target.y}) has no record in the hamlet`);
        }
        await constructionApi.removeBuildingRecord(record.instanceId ?? record.id);
        clearedRecords += 1;
      }
    }
    if (clearedProps > 0) {
      playBulldozeSound();
      await refreshPlacementPresentation();
    }
    if (clearedRecords > 0) {
      // includeEmployment also redraws the pop-details resources (the nature tab counts what the records hold)
      await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
    }

    // The buildings the targets stand for, each once (a large one covers several tiles); the ones the catalog forbids to demolish are refused here, before anything is touched.
    const buildings = [];
    const seen = new Set();
    for (const target of targets) {
      const tile = city.tiles[target.x][target.y];
      if (!tile?.buildingId) {
        continue;
      }
      const instanceId = target.instanceId ?? tile.instanceId ?? null;
      const key = instanceId ?? `${target.x},${target.y}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      if (isUndemolishable(tile.buildingId)) {
        showDemolitionRefusedNotification(tile.buildingId);
        continue;
      }
      buildings.push({ x: target.x, y: target.y, instanceId, type: tile.buildingId });
    }

    const asked = buildings.filter((building) => isConfirmedBeforeDemolition(building.type));
    if (asked.length > 0) {
      const entries = [];
      for (const building of asked) {
        entries.push({ type: building.type, x: building.x, y: building.y, ...(await consequencesOfDemolition(building)) });
      }
      if (!(await confirmDemolition(entries))) {
        return;
      }
    }

    let lastBuildingId = null;
    let demolished = 0;
    let limitedDemolished = false;
    for (const { x, y, instanceId: removedInstanceId } of buildings) {
      const tile = city.tiles[x][y];
      if (!tile?.buildingId) {
        // It already went down with a neighbour.
        continue;
      }
      const isHub = supply.hasResourceRole(tile.buildingId, 'hub');
      const hasPlacementRequirements = supply.getPlacementRequirements(tile.buildingId).length > 0;

      const removedType = tile.buildingId;
      let cascadeOutcome = null;
      if ((isHub || hasPlacementRequirements) && removedInstanceId) {
        cascadeOutcome = await syncSupplyLinksAfterBuildingChange({
          supply,
          construction: constructionApi,
          city,
          event: 'bulldozed',
          buildingType: removedType,
          instanceId: removedInstanceId,
          x,
          y,
        });
      }

      let outcome;
      try {
        outcome = await constructionApi.bulldozeBuildingAtTile({
          city,
          x,
          y,
          meshInstanceId: removedInstanceId,
        });
      } catch (error) {
        // The accounts of the building could not be closed: it stays, and the player is told why (the tag reaches the dev log).
        console.error('[Construction] The demolition failed, the building stays:', error);
        // The tag in front of the message ("[treasury]") is for the console; the player reads the sentence.
        showErrorToast(`Démolition impossible : ${error.message.replace(/^\[[a-z-]+\]\s*/i, '')}`);
        continue;
      }
      if (outcome.refused) {
        showDemolitionRefusedNotification(removedType);
        continue;
      }
      const { buildingId } = outcome;

      if (buildingId) {
        demolished += 1;
        lastBuildingId = buildingId;
        if (isLimitedBuilding(buildingId)) limitedDemolished = true;
        await recordBuildingHistory('demolished', { id: removedInstanceId, type: buildingId, x, y });
      }
      if (cascadeOutcome?.destroyed?.length) {
        showHubCascadeNotification(removedType, cascadeOutcome.destroyed);
      }
    }

    if (demolished === 0) {
      return;
    }
    playBulldozeSound();
    await scene.update(city, time);
    if (limitedDemolished) syncLimitedBuildingButtons();
    await syncEmploymentAfterBuildingChange(scene, city, lastBuildingId);
    await refreshPlacementPresentation();
    await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
  }

  /**
   * A company that could not pay its debts was liquidated and demolished (LiquidateInsolventCompanies.js, announced as `gameplay.companyLiquidated`): the player is told,
   * and the map, the construction buttons (its place is free again) and the HUD follow, as after the player's own demolition.
   */
  async function onCompanyLiquidated(event) {
    showErrorToast(`🏦 ${event.name} est en faillite : ses comptes sont liquidés et le bâtiment est démoli.`, { timeout: 6000 });
    await scene.update(city, time);
    if (isLimitedBuilding(event.buildingType)) syncLimitedBuildingButtons();
    await syncEmploymentAfterBuildingChange(scene, city, event.buildingType);
    await refreshPlacementPresentation();
    await syncSessionHud({ housing, employment, gameUI, includeEmployment: true });
  }

  /** The tiles of the square from where the player pressed to the cursor (inside the city). */
  function plotSquareTiles() {
    const { anchor, end } = plotPaint;
    const tiles = [];
    for (let x = Math.min(anchor.x, end.x); x <= Math.max(anchor.x, end.x); x += 1) {
      for (let y = Math.min(anchor.y, end.y); y <= Math.max(anchor.y, end.y); y += 1) {
        if (x >= 0 && y >= 0 && x < city.size && y < city.size) tiles.push({ x, y });
      }
    }
    return tiles;
  }

  /**
   * What the land tool would do with the square: marking, green is what goes up for sale and red what cannot (a building, a tree, a slope, land already for sale);
   * clearing, red is the land taken off sale (of the tool's use) and amber the rest of the square.
   */
  function plotPlanOf(squareTiles, { use, action }) {
    const valid = [];
    const blocked = [];
    const area = [];
    for (const { x, y } of squareTiles) {
      const tile = city.tiles[x]?.[y];
      if (action === 'mark') {
        (plotMarkRefusal(tile) === null ? valid : blocked).push({ x, y });
      } else {
        // Only land still for sale can be taken off sale: what a company has bought is its own
        (tile?.plot?.use === use && tile.plot.owner === null ? blocked : area).push({ x, y });
      }
    }
    return { valid, blocked, area };
  }

  function showPlotDragPreview() {
    scene.roadPaintPreview.show(plotPlanOf(plotSquareTiles(), parsePlotTool(activeToolId)));
  }

  function cancelPlotPaint() {
    plotPaint.active = false;
    plotPaint.anchor = null;
    plotPaint.end = null;
    scene.roadPaintPreview.clear();
  }

  /** The cursor moved: the square is redrawn from where the player pressed, and stops growing at the longest side the town hall can mark at once. */
  function dragPlotToward(x, y) {
    const { anchor } = plotPaint;
    const reach = PLOT_SQUARE_MAX_SIDE - 1;
    plotPaint.end = {
      x: Math.max(anchor.x - reach, Math.min(anchor.x + reach, x)),
      y: Math.max(anchor.y - reach, Math.min(anchor.y + reach, y)),
    };
    showPlotDragPreview();
  }

  /** The land for sale becomes `next`: the tiles, the list the hamlet keeps, and the fences around it. */
  async function applyPlots(next) {
    for (const { x, y } of plots) delete city.tiles[x][y].plot;
    for (const { x, y, use, owner } of next) city.tiles[x][y].plot = { use, owner };
    plots = next;
    await saveHamletPlots(requireActiveHamletId(), plots);
    await scene.setPlotFences(plots);
    await refreshPlacementPresentation();
  }

  /** The land for sale a hamlet kept is put back on its tiles as it loads. */
  async function loadPlots() {
    // The city's tiles were laid again for this hamlet: what the previous one had for sale is no longer on them
    plots = [];
    const saved = await getHamletPlots(requireActiveHamletId());
    for (const { x, y } of saved) {
      if (!city.tiles[x]?.[y]) throw new Error(`[game] a plot of the hamlet at (${x}, ${y}) is outside the city`);
    }
    await applyPlots(saved);
  }

  /** The button is released: the square is put up for sale, or taken off sale. */
  async function commitPlotPaint() {
    if (!plotPaint.active || plotPaint.busy) {
      return;
    }
    plotPaint.busy = true;
    try {
      const tool = parsePlotTool(activeToolId);
      const { valid } = plotPlanOf(plotSquareTiles(), tool);
      const square = plotSquareTiles();
      cancelPlotPaint();
      if (tool.action === 'mark') {
        if (valid.length === 0) return;
        await applyPlots([...plots, ...valid.map(({ x, y }) => ({ x, y, use: tool.use, owner: null, crop: null, groundY: scene.resolveGroundElevation(x, y, 1, 1) }))]);
      } else {
        const covered = new Set(square.map(({ x, y }) => `${x},${y}`));
        const kept = plots.filter((plot) => plot.owner !== null || plot.use !== tool.use || !covered.has(`${plot.x},${plot.y}`));
        if (kept.length === plots.length) return;
        await applyPlots(kept);
      }
    } finally {
      plotPaint.busy = false;
    }
  }

  /** The button is released: demolish what the square covers. */
  async function commitErasePaint() {
    if (!erasePaint.active || erasePaint.busy) {
      return;
    }
    erasePaint.busy = true;
    try {
      const targets = eraseSquareTiles();
      cancelErasePaint();
      await demolishTiles(targets);
    } finally {
      erasePaint.busy = false;
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

  /** Range mode: what the building on this tile reaches, lit on the map until the mode or the click changes. */
  function showReachOfTile(tile) {
    const { buildings, roadTiles } = listPlacedBuildings(city);
    const origin = buildings.find((b) => b.instanceId === tile.instanceId);
    if (!origin) {
      // A click on bare ground or on a road: nothing is reached from there.
      scene.reachOverlay.clear();
      return;
    }
    scene.reachOverlay.show(computeBuildingReach(origin, buildings, roadTiles));
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

  scene.onObjectSelected = async (selectedObject, { touchPaint = false } = {}) => {
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

    // A finger that starts a new drag gives up the plan that was waiting, whatever the tile it presses (a red one included): the ghost follows again
    if (touchPaint && (touchPaintPending || roadPaint.active || housePaint.active)) {
      cancelRoadPaint();
      cancelHousePaint();
    }

    const behaviorMode = resolveActiveBehaviorMode();

    if (behaviorMode === BEHAVIOR_MODE.PLOT) {
      // The town hall's land tools: the press anchors a square, dragging stretches it, letting go marks or clears it
      plotPaint.active = true;
      plotPaint.anchor = { x, y };
      plotPaint.end = { x, y };
      showPlotDragPreview();
      return;
    }

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
          land,
        });
        return;
      }
    }

    if (behaviorMode === BEHAVIOR_MODE.RANGE) {
      showReachOfTile(tile);
      return;
    }

    if (behaviorMode === BEHAVIOR_MODE.ERASE) {
      // Playing (not the editor): Cesar III — the press anchors a square, dragging stretches it, letting go demolishes it.
      if (!isEditorMode()) {
        erasePaint.active = true;
        erasePaint.anchor = { x, y };
        erasePaint.end = { x, y };
        showEraseDragPreview();
        return;
      }
      await demolishTiles([{ x, y, instanceId: selectedObject.userData?.instanceId ?? tile.instanceId ?? null }]);
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
        land,
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

      // A tap elsewhere while a ghost waits moves it there: the waiting one is given up, this tile takes its place
      cancelTouchPendingPlacement();

      // A finger that drags out a road (touchPaint) takes the paint path below, like the mouse; a plain tap keeps the touch flow (shape and turn to choose)
      if (usesTouchPlacementRotationFlow(activeToolId) && !touchPaint) {
        const tile = city.tiles[x][y];
        const canOverwriteRoad = !tile?.buildingId || isRoadBuildingType(tile.buildingId);
        if (!canOverwriteRoad) {
          showGenericErrorNotification(activeToolId, 'area_not_available');
          return;
        }

        const placementCheck = canPlaceHere({
          city,
          x,
          y,
          buildingType: resolvePlacementBuildingId(),
          assetCatalog: buildingPlacementCatalog,
          rotationStep: getPlacementRotationStep(),
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

      // Desktop: Cesar III — the press anchors, dragging draws the L, letting go lays it (touch: letting go keeps it, the button of the bar lays it).
      dropTouchPaintPending();
      roadPaint.active = true;
      roadPaint.anchor = { x, y };
      roadPaint.axis = null;
      roadPaint.path = [{ x, y }];
      showRoadDragPreview();
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

      // A tap elsewhere while a ghost waits moves it there: the waiting one is given up, this tile takes its place
      cancelTouchPendingPlacement();

      if (usesTouchPlacementRotationFlow(activeToolId) && !(touchPaint && isPlotDragTool(activeToolId))) {
        const placementCheck = canPlaceBuildingAtTileWithSupplyRules({
          city,
          x: placeX,
          y: placeY,
          buildingType: resolvePlacementBuildingId(),
          assetCatalog: buildingPlacementCatalog,
          rotationStep: getPlacementRotationStep(),
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

      // Desktop: a house is dragged out like a road — the press anchors, dragging plans the plots, letting go places them.
      if (isPlotDragTool(activeToolId)) {
        dropTouchPaintPending();
        housePaint.active = true;
        housePaint.anchor = { x: placeX, y: placeY };
        housePaint.axis = null;
        housePaint.path = [{ x: placeX, y: placeY }];
        showHouseDragPreview();
        return;
      }

      const placed = await finalizeBuildingPlacement(
        placeX,
        placeY,
        resolvePlacementBuildingId(),
        getPlacementRotationStep(),
      );
      if (placed) {
        const gridSize = buildingPlacementCatalog[resolvePlacementBuildingId()]?.gridSize ?? 1;
        placementGhostSession.suppressGhostAtFootprint(placeX, placeY, gridSize);
      } else {
        placementGhostSession.sync(selectedObject);
      }
    } else if (isActivePlacementTool(activeToolId)) {
      // A building tool on a tile that is taken: the ghost is red there, and pressing it says why instead of doing nothing.
      showGenericErrorNotification(activeToolId, 'building_already_exists');
    }
  };

  scene.onStatusHover = updateStatusIconTooltip;

  scene.onRoadPaintMove = async (focusedObject) => {
    if (plotPaint.active) {
      const px = focusedObject?.userData?.x;
      const py = focusedObject?.userData?.y;
      if (typeof px === 'number' && typeof py === 'number') {
        dragPlotToward(px, py);
      }
      return;
    }
    if (erasePaint.active) {
      const ex = focusedObject?.userData?.x;
      const ey = focusedObject?.userData?.y;
      if (typeof ex === 'number' && typeof ey === 'number') {
        dragEraseToward(ex, ey);
      }
      return;
    }
    const dragsHouses = housePaint.active && isPlotDragTool(activeToolId);
    const dragsRoad = roadPaint.active && isRoadBuildingType(activeToolId);
    if (!dragsHouses && !dragsRoad) {
      return;
    }
    const x = focusedObject?.userData?.x;
    const y = focusedObject?.userData?.y;
    if (typeof x !== 'number' || typeof y !== 'number') {
      return;
    }
    if (dragsHouses) {
      dragHousesToward(x, y);
    } else {
      dragRoadToward(x, y);
    }
    placementGhostSession.sync(focusedObject);
  };

  scene.onRoadPaintEnd = async () => {
    await commitRoadPaint();
    await commitHousePaint();
    await commitErasePaint();
    await commitPlotPaint();
  };

  // Touch (Mode tactile): one finger on a road tool, or on a house / field, drags the plan out like the mouse does (it replaces a plan or a ghost waiting).
  scene.preferPlacementPaintDrag = () => usesTouchPlacementRotationFlow(activeToolId)
    && resolveActiveBehaviorMode() === BEHAVIOR_MODE.BUILD
    && (isRoadBuildingType(activeToolId) || isPlotDragTool(activeToolId));

  /**
   * The finger lifted after a drag. A single tile is the ordinary touch flow ('single': it has its shape and its turn to choose). Several tiles are kept as a
   * plan ('pending'): previewed as dragged, to be laid by the confirm button, which has nothing to turn here since each piece fits its neighbours by itself.
   * @returns {'single' | 'pending' | 'none'}
   */
  scene.onTouchPaintEnd = async () => {
    const paint = roadPaint.active ? roadPaint : (housePaint.active ? housePaint : null);
    if (!paint) {
      return 'none';
    }
    if (paint.path.length <= 1) {
      cancelRoadPaint();
      cancelHousePaint();
      return 'single';
    }
    // Nothing of the plan can be laid (all red): there is nothing to confirm, the player is told why and the ghost stays free to move
    const layable = roadPaint.active ? planRoadDrag().valid.length : planHouseDrag().valid.length;
    if (layable === 0) {
      await commitRoadPaint();
      await commitHousePaint();
      return 'none';
    }
    touchPaintPending = true;
    const last = paint.path[paint.path.length - 1];
    placementRotationHud?.show({ x: last.x, y: last.y, gridSize: 1, canSelectMesh: false, canRotate: false });
    return 'pending';
  };

  scene.onPlacementHover = (focusedObject) => {
    // The eraser (playing): the building under the cursor is lit whole before any click. While the square is being drawn, its own preview is shown instead.
    if (resolveActiveBehaviorMode() === BEHAVIOR_MODE.ERASE && !isEditorMode() && !erasePaint.active) {
      showEraseHoverPreview(focusedObject);
    }
    discardTouchPendingIfDisabled();
    if (touchPendingPlacement || touchPaintPending) {
      return;
    }
    placementGhostSession.sync(focusedObject);
  };

  // Build tool + 1 finger: green/red ghost follows the finger (2 fingers still pan/zoom).
  // A ghost waiting for its confirmation does not take the finger away from the placement: dragging moves it again (see `onPlacementTouchDrag`).
  scene.preferPlacementTouchDrag = () => resolveActiveBehaviorMode() === BEHAVIOR_MODE.BUILD;

  // The finger drags: the ghost that was anchored (with its bar) is picked up and follows it, green or red as before it was anchored; letting go anchors it again.
  scene.onPlacementTouchDrag = () => cancelTouchPendingPlacement();

  /**
   * Build mode: R is reserved for the placement ghost (camera R is blocked).
   * Rotates the ghost mesh when it is visible; otherwise R is consumed but has no effect.
   * @returns {boolean} true if build mode is active (blocks camera rotation)
   */
  /**
   * Build mode: S selects the next mesh of the active tool's `selectableMeshes`.
   * Only consumed (blocking camera S) when the tool actually offers a choice.
   * @returns {boolean}
   */
  function cycleMeshSelection() {
    if (resolveActiveBehaviorMode() !== BEHAVIOR_MODE.BUILD) {
      return false;
    }
    if (getSelectableMeshIds(activeToolId).length === 0) {
      return false;
    }
    if (touchPendingPlacement) {
      selectMeshForPendingPlacement();
      return true;
    }
    selectedMeshIndex += 1;
    placementGhostSession.sync();
    return true;
  }
  scene.onCycleMeshSelection = cycleMeshSelection;

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
      void commitRoadPaint();
    }
    if (housePaint.active) {
      void commitHousePaint();
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

    async update(tick, { silent = false } = {}) {
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
        onGameOver: () => {
          isOver = true;
        },
        presentIncomingNewsEvents,
        showTutorialToast,
        hideTutorialToast,
        applyTutorialAllowedTools,
        showTutorialObjective,
        syncLimitedBuildingButtonsOnHamletChange,
        silent,
      });
      if (!silent) {
        // Felled trees are gone: the placement gate must not count them anymore.
        await refreshPlacementPresentation();
      }
    },

    /** Resolves when the hamlet's scene is loaded and the loader is gone: what a new game's opening waits for. */
    whenSceneReady: () => hamletSceneGate,

    refreshEmployment: refreshEmploymentPresentationForCity,
    runSimulationPass,
    runScenePresentationPass,

    pause() {
      isPause = true;
      gameUI.setPaused(true);
    },

    /**
     * Construction mode: the game is paused (without the pause overlay) and stays paused while the player builds; the many `play()` calls that end a
     * placement do nothing until the mode ends. Whether the game ran before is remembered, so a game the player had paused stays paused.
     */
    enterConstructionPause() {
      if (constructionPause) {
        return;
      }
      constructionPause = { resumeOnExit: !isPause };
      isPause = true;
      gameUI.setPaused(true);
      gameUI.setConstructionPause(true);
    },

    async leaveConstructionPause() {
      if (!constructionPause) {
        return;
      }
      const { resumeOnExit } = constructionPause;
      constructionPause = null;
      gameUI.setConstructionPause(false);
      if (resumeOnExit) {
        await game.play();
      }
    },

    async play() {
      if (constructionPause) {
        return;
      }
      isPause = false;
      gameUI.setPaused(false);
      if (objectivesTracker.enabled) {
        await objectivesTracker.checkObjectives(0);
      }
    },

    replay() {
      performReset();
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
      const toolChanged = toolId !== activeToolId;
      activeToolId = toolId;
      scene.reachOverlay.clear();
      selectedMeshIndex = 0;
      gameUI.activeToolId = toolId;
      placementGhostSession.onToolChanged();
      // The reminders depend on the tool in hand (picking the mayor's house to place it is the guided way: nothing to remind).
      void refreshHudReminders().catch((error) => console.error('[game] The reminders could not be refreshed:', error));
      // What a building needs (a hub in reach, a natural resource, a supplier) is said when it is picked.
      if (toolChanged && isActivePlacementTool(toolId)) {
        const placingType = resolvePlacementBuildingId(toolId);
        showPlacementNeedsNotification(placingType);
        // A producer whose goods have clients says where the player sets who it serves first, once placed.
        showClientPriorityNotification(placingType);
      }
      if (isEditorTerrainTool(toolId)) {
        void getKenneyNatureTerrainAdapter().ensureTerrainTemplate(toolId);
      } else if (isEditorNatureTool(toolId)) {
        void getKenneyNaturePropAdapter().ensurePropLoaded(toolId);
      }
      if (!isRoadBuildingType(toolId) && roadPaint.active) {
        cancelRoadPaint();
      }
      // A plan waiting for its confirmation does not outlive the tool it was dragged with
      if (touchPaintPending && toolChanged) {
        cancelRoadPaint();
        cancelHousePaint();
      }
      if (housePaint.active && !isPlotDragTool(toolId)) {
        cancelHousePaint();
      }
      if (erasePaint.active) {
        cancelErasePaint();
      }
      if (plotPaint.active) {
        cancelPlotPaint();
      }
      // The eraser's hover light must not stay on the map once another tool is in hand (a paint in progress keeps its own preview).
      if (!roadPaint.active && !housePaint.active && !erasePaint.active && !plotPaint.active) {
        scene.roadPaintPreview.clear();
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
    // The error is the real message (what failed), not a generic sentence: the cause has to be visible right away.
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      showErrorToast(`Un jour a échoué et n'a pas été terminé : ${message}`, { timeout: 10000 });
      // The books say it too: a failed day may leave them incomplete. If the journal itself is what is broken, that is logged (tagged), never hidden.
      accounting.recordDayFailure({ turn: time, message }).catch((journalError) => {
        console.error('[GameLoop] The failed day could not be written in the journal:', journalError);
      });
    },
    onTick: async () => {
      await awaitBudgetReady();
      // The loop starts with the page, the scene a moment later: a day waits for it. A scene that failed to load never gets days
      // (they would fail on its empty grid, every tick): the loop stops and the cause is said once, with its error.
      await hamletSceneGate;
      if (sceneLoadError) {
        gameLoop.stop();
        console.error('[game] no day is simulated: the hamlet scene was not loaded, see the error above:', sceneLoadError);
        return;
      }
      if (isPause || isOver) {
        return;
      }
      // Fast-forward (speed levels 10-13): batch several simulated days into this one
      // tick fire, rendering only the batch's last day — see SPEED_LEVELS_DAYS.
      const days = getDaysPerTick();
      for (let day = 0; day < days; day += 1) {
        time += 1;
        await writeGameClock(time);
        await game.update(time, { silent: day < days - 1 });
        getSharedEventBus().publish({ type: 'game.turnAdvanced', turn: time });
        if (isPause || isOver) {
          break;
        }
      }
    },
  });
  gameLoop.start();

  scene.start();

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
  if (import.meta.env.DEV) window.__game = game;

  return game;
}
