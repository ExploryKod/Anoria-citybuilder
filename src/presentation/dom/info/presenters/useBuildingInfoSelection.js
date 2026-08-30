/**
 * Building info presenter — équivalent Anoria de `use-order-page`.
 *
 * Vanilla DOM (pas Next.js) : pas de composant page séparé, le layout HTML
 * existe déjà dans game.html. Ce fichier fait I/O via ports injectés,
 * appelle les formats purs, puis les vues DOM.
 *
 * Tabs: each group declares thematic tabs in the registry; shared tabs
 * (services / neighbors / messages) resolve via buildingInfoSharedTabs.
 */

import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { buildingsObjects } from '../../../../shared/building-catalog/index.js';
import { infoObjectOverlay } from '../../shell/nodes.js';
import { clearHubInfoOverlayMode } from '../views/hub/hubStorageInfoDom.js';
import { createBuildingInfoViewModel } from '../buildingInfoTypes.js';
import { resolveBuildingInfoGroup, BUILDING_INFO_GROUPS } from '../resolveBuildingInfoGroup.js';
import { resolveTerrainDisplay } from '../shared/buildingInfoTerrain.js';
import { getBuildingInfoGroupDef } from './buildingInfoGroupRegistry.js';
import { resolveBuildingInfoTabHandler } from '../buildingInfoSharedTabs.js';
import { BUILDING_INFO_TAB_IDS } from '../buildingInfoTabCatalog.js';
import {
  applyInfoPanelLayoutOptions,
  closeBuildingInfoOverlay,
  getBuildingInfoTabPanel,
  openBuildingInfoOverlay,
  resetBuildingInfoLayout,
  setBuildingInfoGroupAccent,
  setBuildingInfoMeta,
  setBuildingInfoTitle,
  syncBuildingInfoTabs,
} from '../layout/buildingInfoLayout.js';
import { playDoorOpenSound } from '../../../audio/SoundEffects.js';

/**
 * @param {import('../buildingInfoTypes.js').BuildingInfoGroupId} groupId
 * @param {import('../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
async function enrichBuildingInfoViewModel(groupId, vm) {
  /** @type {Record<string, unknown>} */
  const extra = {};

  if (groupId === BUILDING_INFO_GROUPS.nature && vm.uniqueId) {
    if (!vm.stocks && vm.buildingRow?.stocks == null) {
      extra.stocks = await vm.construction.getBuildingField(vm.uniqueId, 'stocks');
    }
  }

  if (groupId === BUILDING_INFO_GROUPS.farm) {
    const budget = await vm.accounting.getTreasurySnapshot();
    if (budget?.turn !== undefined) {
      const timeInfo = TimeManager.getTimeInfo(budget.turn);
      extra.currentYear = timeInfo?.year ?? 0;
    } else {
      extra.currentYear = 0;
    }
  }

  if (groupId === BUILDING_INFO_GROUPS.hubStorage) {
    const hubKind = vm.buildingRow?.type?.includes('Barn')
      ? 'barn'
      : vm.supplyView?.kind === 'windmill'
        ? 'windmill'
        : null;
    if (hubKind) {
      extra.hubKind = hubKind;
      if (hubKind === 'windmill' && !Object.hasOwn(vm.stocks || {}, 'food')) {
        extra.hubView = null;
      } else {
        extra.hubView = vm.supply.getHubStorageInfoView(hubKind, vm.buildingRow, {
          stocks: vm.stocks,
          maxStock: vm.supplyView?.maxStock,
        });
      }
    }
  }

  if (Object.keys(extra).length === 0) return vm;
  return { ...vm, ...extra };
}

/**
 * @param {import('../buildingInfoTypes.js').BuildingInfoGroupDefinition} groupDef
 * @param {import('../buildingInfoTypes.js').BuildingInfoViewModel} vm
 */
async function renderGroupTabs(groupDef, vm) {
  const tabs = groupDef.tabs ?? [];
  syncBuildingInfoTabs(tabs);

  for (const tabSpec of tabs) {
    const handler = resolveBuildingInfoTabHandler(tabSpec);
    if (!handler?.render) continue;

    const panel = getBuildingInfoTabPanel(tabSpec.id);
    if (!panel) continue;

    const model = typeof handler.format === 'function' ? handler.format(vm) : null;
    const alwaysRender = handler.alwaysRender === true
      || tabSpec.id === BUILDING_INFO_TAB_IDS.messages
      || tabSpec.id === BUILDING_INFO_TAB_IDS.neighbors;

    if (model == null && !alwaysRender) continue;
    await handler.render(panel, model);
  }
}

/**
 * @param {{ userData: object }} selectedObject
 * @param {object} ctx
 */
export async function useBuildingInfoSelection(selectedObject, ctx) {
  const {
    city, parcels, supply, scene, game, time, runScenePresentationPass,
    construction, employment, accounting,
  } = ctx;

  const shouldOpenInfo = buildingsObjects.includes(selectedObject.userData.id);

  resetBuildingInfoLayout();
  clearHubInfoOverlayMode();

  if (shouldOpenInfo) {
    playDoorOpenSound();
    openBuildingInfoOverlay(infoObjectOverlay);
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.classList.add('pointer-events-disabled');
    if (scene.controls) scene.controls.enabled = false;
  } else {
    closeBuildingInfoOverlay(infoObjectOverlay);
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.classList.remove('pointer-events-disabled');
  }

  if (shouldOpenInfo) {
    const { x: selX, y: selY } = selectedObject.userData;
    const uniqueId =
      selectedObject.userData.instanceId
      ?? city.tiles?.[selX]?.[selY]?.instanceId
      ?? (await construction.findBuildingAtTile({ x: selX, y: selY }))?.instanceId
      ?? null;

    const buildingRow = uniqueId ? await construction.getBuildingById(uniqueId) : null;
    const { anchorX, anchorY, terrainLabel } = resolveTerrainDisplay(buildingRow, selX, selY);
    const buildingPop = buildingRow?.pop ?? 0;
    const roadAccess = await parcels.getRoadAccess(uniqueId);
    const neighbors = uniqueId ? await parcels.getNeighbors(uniqueId) : [];
    const supplyView = uniqueId ? await supply.getBuildingSupplyView(uniqueId) : null;
    const buildingType = selectedObject.userData.id;

    let vm = createBuildingInfoViewModel({
      buildingType,
      uniqueId,
      buildingRow,
      selectedObject,
      anchorX,
      anchorY,
      terrainLabel,
      buildingPop,
      roadAccess,
      neighbors,
      supplyView,
      stocks: supplyView?.stocks ?? null,
      employment,
      supply,
      accounting,
      construction,
    });

    const groupId = resolveBuildingInfoGroup({ buildingRow, supplyView });
    vm = await enrichBuildingInfoViewModel(groupId, vm);

    const groupDef = getBuildingInfoGroupDef(groupId);
    const layoutHeader = groupDef.formatLayoutHeader(vm);
    const layoutOptions = groupDef.formatLayoutOptions(vm);

    applyInfoPanelLayoutOptions({
      ...layoutOptions,
      accent: layoutHeader?.accent ?? layoutOptions.accent ?? null,
    });

    if (layoutHeader?.title) setBuildingInfoTitle(layoutHeader.title);
    if (layoutHeader?.meta) setBuildingInfoMeta(layoutHeader.meta);
    setBuildingInfoGroupAccent(layoutHeader?.accent ?? null);

    await renderGroupTabs(groupDef, vm);
  }

  if (infoObjectOverlay.classList.contains('active')) {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.classList.add('pointer-events-disabled');
    game.pause();
  } else {
    const canvas = document.querySelector('canvas');
    if (canvas) canvas.classList.remove('pointer-events-disabled');
    game.play();
  }

  await runScenePresentationPass(time);
}

/** Alias pour l'appel depuis game.js (équivalent du mount, sans couche intermédiaire). */
export const presentBuildingInfoSelection = useBuildingInfoSelection;
