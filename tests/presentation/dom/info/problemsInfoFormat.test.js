import { describe, test, expect } from '@jest/globals';
import { asksPublicAid, formatProblemsModel, PUBLIC_AID_REQUEST_EMOJI } from '../../../../src/presentation/dom/info/presenters/formats/problemsInfoFormat.js';

const hubRow = (extra = {}) => ({ type: 'Windmill-001', kind: 'windmill', solidity: 100, roads: 1, ...extra });
const vmOf = (buildingRow) => ({ buildingRow, buildingType: buildingRow.type });

describe('the Problèmes tab: what stands in the way of a building, grouped, each line with its emoji', () => {
  test('a purchase refused for lack of money names the cause and asks for a public aid', () => {
    const row = hubRow({ collectionRefusals: { hubReason: null, goods: { wheat: { waiting: 10, limits: { no_budget: 6 } } } } });
    const { groups } = formatProblemsModel(vmOf(row));

    expect(groups.map((group) => group.title)).toEqual(['Achats']);
    expect(groups[0].lines[0].emoji).toBe('💰');
    expect(groups[0].lines.at(-1)).toEqual({ emoji: PUBLIC_AID_REQUEST_EMOJI, text: 'Une aide publique est demandée', kind: 'request' });
    expect(groups[0].lines[0].kind).toBe('problem');
    expect(asksPublicAid(row)).toBe(true);
  });

  test('a refusal that is not about money asks for no aid, and a building with no road says so under Infrastructure', () => {
    const row = hubRow({ roads: 0, collectionRefusals: { hubReason: 'hub_full', goods: {} } });

    expect(asksPublicAid(row)).toBe(false);
    expect(formatProblemsModel(vmOf(row)).groups.map((group) => group.title)).toEqual(['Infrastructure', 'Achats']);
  });

  test('a worn-out building says so under Solidité, the same alert as the map\'s icon', () => {
    const { groups } = formatProblemsModel(vmOf(hubRow({ solidity: 10 })));
    expect(groups.map((group) => group.title)).toEqual(['Solidité']);
    expect(groups[0].lines[0].emoji).toBe('🏚️');
  });

  test('each alert icon of the map has its line: no worker, no resource, an input missing, a full hub', () => {
    const row = hubRow({ employees: { worker_need: 2, worker: 0 } });
    const vm = { ...vmOf(row), noResource: true, turn: 0, supplyView: { type: 'Windmill-001', activityShortfall: { wheat: true }, stocks: {}, maxStock: 0 } };
    expect(formatProblemsModel(vm).groups.map((group) => group.title)).toEqual(['Personnel', 'Ressources', 'Production', 'Stockage']);
  });

  test('nothing in the way: no group at all', () => {
    expect(formatProblemsModel(vmOf(hubRow())).groups).toEqual([]);
  });
});
