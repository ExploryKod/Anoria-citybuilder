import { describe, test, expect } from '@jest/globals';
import { WearBuildings } from '../../../src/contexts/gameplay/application/services/WearBuildings.js';

// A building whose upkeep is not paid wears; a worn-out one collapses, killing part of the people inside (docs/gameplay/PLAN_COLLAPSE.md).
const row = (id, solidity, kind = 'other') => ({ instanceId: id, type: id, kind, solidity, x: 1, y: 1 });

function service({ rows, random = () => 0.99, refuse = null, inside = {} }) {
  const written = [];
  const deaths = [];
  const announced = [];
  const bulldozed = [];
  const wear = new WearBuildings({
    listAllBuildingRows: async () => rows,
    instanceIdFromHouseRow: (r) => r.instanceId,
    updateBuildingFields: async (id, fields) => written.push({ id, ...fields }),
    citizensInside: async (r) => inside[r.instanceId] ?? [],
    killCitizens: async (dead) => deaths.push(...dead.map((citizen) => citizen.id)),
    recordAccidentDeaths: () => {},
    bulldozeBuildingAtTile: async ({ meshInstanceId }) => { bulldozed.push(meshInstanceId); return refuse ? { refused: refuse } : { buildingId: meshInstanceId }; },
    getGameCity: () => ({}),
    nameOfRow: (r) => r.type,
    random,
    announce: (event) => announced.push(event),
    reportFailure: () => {},
  });
  return { wear, written, deaths, announced, bulldozed };
}

describe('the buildings wear and collapse', () => {
  test('only the buildings whose upkeep was not paid wear; a road has no bar', async () => {
    const { wear, written } = service({ rows: [row('paid', 80), row('neglected', 80), row('road', undefined, 'road')] });
    await wear.execute({ neglected: ['neglected'] });
    expect(written).toEqual([{ id: 'neglected', solidity: 76 }]);
  });

  test('a worn-out building collapses: the people hit die, the building is demolished', async () => {
    const { wear, deaths, announced, bulldozed } = service({
      rows: [row('worn', 0)],
      random: () => 0, // the collapse is drawn, and everyone inside is hit
      inside: { worn: [{ id: 'a' }, { id: 'b' }] },
    });
    await wear.execute({ neglected: ['worn'] });
    expect(bulldozed).toEqual(['worn']);
    expect(deaths).toEqual(['a', 'b']);
    expect(announced).toEqual([expect.objectContaining({ instanceId: 'worn', deaths: 2 })]);
  });

  test('a refused demolition kills nobody and is tried again next month', async () => {
    const { wear, deaths, announced } = service({ rows: [row('mayor', 0)], random: () => 0, refuse: 'mayor', inside: { mayor: [{ id: 'a' }] } });
    const outcome = await wear.execute({ neglected: ['mayor'] });
    expect(deaths).toEqual([]);
    expect(announced).toEqual([]);
    expect(outcome.failed).toHaveLength(1);
  });
});
