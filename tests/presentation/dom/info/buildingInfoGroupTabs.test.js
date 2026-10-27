import { describe, test, expect } from '@jest/globals';
import { BUILDING_INFO_GROUPS } from '../../../../src/presentation/dom/info/resolveBuildingInfoGroup.js';
import { getBuildingInfoGroupDef } from '../../../../src/presentation/dom/info/presenters/buildingInfoGroupRegistry.js';
import { BUILDING_INFO_TAB_IDS } from '../../../../src/presentation/dom/info/buildingInfoTabCatalog.js';

function tabIds(groupId) {
  return getBuildingInfoGroupDef(groupId).tabs.map((t) => t.id);
}

describe('buildingInfoGroupRegistry tabs', () => {
  test('house exposes foyer, resources (stocks), its own business (activity) and common context tabs (no more Régime — see messagesInfoFormat.js)', () => {
    expect(tabIds(BUILDING_INFO_GROUPS.house)).toEqual([
      BUILDING_INFO_TAB_IDS.foyer,
      BUILDING_INFO_TAB_IDS.stocks,
      BUILDING_INFO_TAB_IDS.activity,
      BUILDING_INFO_TAB_IDS.residents,
      BUILDING_INFO_TAB_IDS.services,
      BUILDING_INFO_TAB_IDS.messages,
      BUILDING_INFO_TAB_IDS.finance,
    ]);
  });

  test('every workplace group has its staff and services inside the État tab, never as tabs of their own', () => {
    for (const group of [BUILDING_INFO_GROUPS.hubStorage, BUILDING_INFO_GROUPS.farm, BUILDING_INFO_GROUPS.market, BUILDING_INFO_GROUPS.service]) {
      const ids = tabIds(group);
      expect(ids).toContain(BUILDING_INFO_TAB_IDS.state);
      expect(ids).not.toContain(BUILDING_INFO_TAB_IDS.staff);
      expect(ids).not.toContain(BUILDING_INFO_TAB_IDS.services);
    }
  });

  test('hub storage exposes storage, orders, shelf life, état, context tabs and finance', () => {
    expect(tabIds(BUILDING_INFO_GROUPS.hubStorage)).toEqual([
      BUILDING_INFO_TAB_IDS.foyer,
      BUILDING_INFO_TAB_IDS.orders,
      BUILDING_INFO_TAB_IDS.shelfLife,
      BUILDING_INFO_TAB_IDS.state,
      BUILDING_INFO_TAB_IDS.clients,
      BUILDING_INFO_TAB_IDS.messages,
      BUILDING_INFO_TAB_IDS.finance,
    ]);
  });

  test('service (FireStation, School, Doctor, ...) has no market tabs', () => {
    const ids = tabIds(BUILDING_INFO_GROUPS.service);
    expect(ids).not.toContain(BUILDING_INFO_TAB_IDS.stocks);
    expect(ids).not.toContain(BUILDING_INFO_TAB_IDS.trade);
  });
});
