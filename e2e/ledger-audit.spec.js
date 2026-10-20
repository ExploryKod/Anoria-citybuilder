/**
 * Ledger audit, run in the page against the real accounting code.
 *
 * The 3D scene cannot render in the headless sandbox (no WebGL), so no buildings reach the tick. The monthly
 * charges are therefore driven through the real ProcessTurnBudget with an explicit building list, while the game
 * is paused. Everything that is checked (labels, rates, journal, treasury, export, hamlet scoping) is the real code.
 */
import { test, expect } from '@playwright/test';


const STARTER_BUILDINGS = ['Road', 'Road', 'Road', 'House-Blue', 'House-Red', 'Farm-Cabbage'];

async function openTutorialGame(page) {
  await page.goto('/');
  await page.getByRole('link', { name: 'Tutoriel' }).click();
  await page.waitForURL(/\/game\/[0-9a-f-]{36}\/?$/i);
  await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
  await page.evaluate(() => window.__game.pause());
}

/** Charge the monthly maintenance (and salaries/taxes) of the active hamlet at `time`, through the real service. */
async function processMonth(page, time, buildingTypes = STARTER_BUILDINGS) {
  return page.evaluate(async ({ time, buildingTypes }) => {
    const { processTurnBudget } = await import('/src/composition/accountingOps.js');
    const { buildTurnBudgetMaintenanceSnapshot } = await import('/src/contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js');
    const { buildingCounts, maintenanceBreakdown } = buildTurnBudgetMaintenanceSnapshot(buildingTypes);
    await processTurnBudget({ time, totalPop: 0, buildingCounts, maintenanceBreakdown });
    return true;
  }, { time, buildingTypes });
}

const sum = (values) => Object.values(values).reduce((total, value) => total + value, 0);

async function snapshot(page) {
  return page.evaluate(async () => {
    const { default: db } = await import('/src/core/persistence/dexie/db.js');
    const accounting = await import('/src/composition/accountingOps.js');
    const { buildingCatalog } = await import('/src/shared/building-catalog/buildingCatalog.js');
    const { primaryRoadType } = await import('/src/shared/building-catalog/roadQueries.js');
    const budget = await accounting.getTreasurySnapshot();
    await accounting.flushJournalSessionToDexie();
    const journal = await db.journal.toArray();
    return {
      funds: budget.funds,
      journal,
      hamletFunds: await (async () => {
        const session = await import('/src/core/persistence/hamlet/hamletSession.js');
        const balances = {};
        for (const hamlet of await session.listHamlets()) {
          balances[hamlet.id] = (await accounting.getTreasurySnapshot({ hamletId: hamlet.id })).funds;
        }
        return balances;
      })(),
      roadRate: buildingCatalog[primaryRoadType()].accounting.maintenance,
      exported: JSON.parse(await accounting.exportJournalJson()),
    };
  });
}

async function switchActiveHamlet(page, hamletId) {
  return page.evaluate(async (hamletId) => {
    const session = await import('/src/core/persistence/hamlet/hamletSession.js');
    session.setActiveHamletId(hamletId);
    return session.getActiveHamletId();
  }, hamletId);
}

async function hamletIdsOf(page) {
  return page.evaluate(async () => {
    const session = await import('/src/core/persistence/hamlet/hamletSession.js');
    const access = await import('/src/core/persistence/hamlet/hamletAccess.js');
    const hamlets = await session.listHamlets();
    for (const hamlet of hamlets) await access.unlockHamlet(hamlet.id);
    return { ids: hamlets.map((hamlet) => hamlet.id), active: session.getActiveHamletId() };
  });
}

test('monthly charges: labels show the stamped year, lines are priced at the catalogue rate, export keeps every field', async ({ page }) => {
  test.setTimeout(300000);
  const journalErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /journal|ProcessTurnBudget|Budget operations/i.test(message.text())) {
      journalErrors.push(message.text());
    }
  });

  await openTutorialGame(page);
  for (const time of [5, 10]) await processMonth(page, time);

  const snap = await snapshot(page);
  const maintenance = snap.journal.filter((row) => row.type === 'maintenance');
  expect(maintenance.length, 'two monthly maintenance charges were booked').toBe(2);

  for (const row of maintenance) {
    const label = /- (\S+) (\d+) \|BREAKDOWN\|/.exec(row.description);
    expect(label, `maintenance line names its month and year: ${row.description}`).not.toBeNull();
    expect(Number(label[2]), `entry ${row.id} (turn ${row.turn}) is labelled with the year it was stamped with`).toBe(row.year);

    const breakdown = JSON.parse(row.description.split('|BREAKDOWN|')[1]);
    for (const line of breakdown) {
      expect(line.count * line.unitCost, `${line.label} of entry ${row.id}: count × unit = total`).toBe(line.total);
    }
    const roads = breakdown.find((line) => line.label === 'Routes');
    expect(roads.unitCost, 'road unit cost comes from the catalogue').toBe(snap.roadRate);
  }

  const exported = snap.exported.entries;
  expect(exported.length, 'the export holds every journal entry').toBe(snap.journal.length);
  for (const entry of exported.filter((row) => row.id != null)) {
    for (const field of ['hamletId', 'year', 'month', 'businessKey']) {
      expect(entry[field], `export keeps ${field} of entry ${entry.id} (${entry.type})`).not.toBeUndefined();
    }
  }

  expect(sum(snap.hamletFunds), `the hamlets add up to the city balance ${snap.funds}`).toBe(snap.funds);
  expect(journalErrors, 'no journal error was logged and swallowed').toEqual([]);
});

test('a second hamlet charged in the same month is booked to that hamlet', async ({ page }) => {
  test.setTimeout(300000);
  await openTutorialGame(page);
  const { ids, active } = await hamletIdsOf(page);
  const other = ids.find((id) => id !== active);

  await processMonth(page, 5);
  await switchActiveHamlet(page, other);
  await processMonth(page, 5);

  const snap = await snapshot(page);
  const monthOfFive = snap.journal.filter((row) => row.type === 'maintenance' && row.turn === 5);
  expect(monthOfFive.map((row) => row.hamletId).sort(), 'both hamlets pay their maintenance for the same month').toEqual([active, other].sort());
});

test('a hamlet trip keeps the city balance equal to the sum of the hamlets', async ({ page }) => {
  test.setTimeout(300000);
  await openTutorialGame(page);
  const { ids, active } = await hamletIdsOf(page);
  const other = ids.find((id) => id !== active);

  const checks = [];
  let time = 5;
  for (const target of [other, active, other]) {
    await processMonth(page, time);
    await switchActiveHamlet(page, target);
    await processMonth(page, time + 5);
    time += 10;
    const snap = await snapshot(page);
    checks.push({ target, funds: snap.funds, hamlets: sum(snap.hamletFunds) });
  }
  expect(checks.filter((check) => check.funds !== check.hamlets), `city vs hamlets after each trip: ${JSON.stringify(checks)}`).toEqual([]);
});

test('a reload right after a payment keeps the same balance', async ({ page }) => {
  test.setTimeout(300000);
  await openTutorialGame(page);
  await processMonth(page, 5);

  const placed = await page.evaluate(async () => {
    const { placeBuildingAtTile } = await import('/src/composition/constructionOps.js');
    const game = window.__game;
    return placeBuildingAtTile({ city: game.city, x: 7, y: 6, buildingType: 'House-Blue', gameTurn: game.time });
  });
  expect(placed.success, `house placed: ${placed.reason ?? ''}`).toBe(true);

  // Read without flushing: the placement's journal line is still only in memory when the page reloads.
  const before = await page.evaluate(async () => {
    const accounting = await import('/src/composition/accountingOps.js');
    return {
      funds: (await accounting.getTreasurySnapshot()).funds,
    };
  });
  expect(before.funds, 'the placement was paid from the treasury').toBeLessThan(500);

  await page.reload();
  await page.waitForFunction(() => window.__game, null, { timeout: 120000 });
  await page.evaluate(() => window.__game.pause());

  const after = await snapshot(page);
  expect(after.funds, 'the balance after the reload is the balance before it').toBe(before.funds);
});
