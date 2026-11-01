import { describe, test, expect } from '@jest/globals';
import { asksPublicAid, formatProblemsModel, PUBLIC_AID_REQUEST_EMOJI } from '../../../../src/presentation/dom/info/presenters/formats/problemsInfoFormat.js';

const hubRow = (extra = {}) => ({ type: 'Windmill-001', roads: 1, ...extra });
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

  test('nothing in the way: no group at all', () => {
    expect(formatProblemsModel(vmOf(hubRow())).groups).toEqual([]);
  });
});
