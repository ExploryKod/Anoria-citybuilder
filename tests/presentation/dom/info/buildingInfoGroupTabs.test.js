import { describe, test, expect } from '@jest/globals';
import { BUILDING_INFO_GROUPS } from '../../../../src/presentation/dom/info/resolveBuildingInfoGroup.js';
import { getBuildingInfoGroupDef } from '../../../../src/presentation/dom/info/presenters/buildingInfoGroupRegistry.js';
import { BUILDING_INFO_TAB_IDS } from '../../../../src/presentation/dom/info/buildingInfoTabCatalog.js';

function tabIds(groupId) {
  return getBuildingInfoGroupDef(groupId).tabs.map((t) => t.id);
}

describe('buildingInfoGroupRegistry tabs', () => {
  test('house exposes foyer, diet and common context tabs', () => {
    expect(tabIds(BUILDING_INFO_GROUPS.house)).toEqual([
      BUILDING_INFO_TAB_IDS.foyer,
      BUILDING_INFO_TAB_IDS.diet,
      BUILDING_INFO_TAB_IDS.services,
      BUILDING_INFO_TAB_IDS.neighbors,
      BUILDING_INFO_TAB_IDS.messages,
    ]);
  });

  test('hub storage does not expose house diet tab', () => {
    const ids = tabIds(BUILDING_INFO_GROUPS.hubStorage);
    expect(ids).not.toContain(BUILDING_INFO_TAB_IDS.diet);
    expect(ids).toEqual([
      BUILDING_INFO_TAB_IDS.foyer,
      BUILDING_INFO_TAB_IDS.staff,
      BUILDING_INFO_TAB_IDS.services,
      BUILDING_INFO_TAB_IDS.neighbors,
      BUILDING_INFO_TAB_IDS.messages,
    ]);
  });

  test('farm exposes production-oriented tabs', () => {
    expect(tabIds(BUILDING_INFO_GROUPS.farm)).toEqual([
      BUILDING_INFO_TAB_IDS.foyer,
      BUILDING_INFO_TAB_IDS.stocks,
      BUILDING_INFO_TAB_IDS.trade,
      BUILDING_INFO_TAB_IDS.staff,
      BUILDING_INFO_TAB_IDS.services,
      BUILDING_INFO_TAB_IDS.neighbors,
      BUILDING_INFO_TAB_IDS.messages,
    ]);
  });

  test('nature only exposes resource + neighbors + messages', () => {
    expect(tabIds(BUILDING_INFO_GROUPS.nature)).toEqual([
      BUILDING_INFO_TAB_IDS.foyer,
      BUILDING_INFO_TAB_IDS.neighbors,
      BUILDING_INFO_TAB_IDS.messages,
    ]);
  });
});
