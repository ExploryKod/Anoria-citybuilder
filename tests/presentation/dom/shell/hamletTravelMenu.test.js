/**
 * @jest-environment jsdom
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';

const listHamletsWithAccess = jest.fn(async () => [
  { id: 'eraanurbs', name: "Val d'Era", access: 'active' },
  { id: 'clairiere', name: 'Clairière', access: 'locked' },
  { id: 'pont-saules', name: 'Pont-aux-Saules', access: 'unlocked' },
]);

jest.unstable_mockModule('../../../../src/composition/sessionRuntime.js', () => ({
  getSessionGame: () => null,
}));

jest.unstable_mockModule('../../../../src/core/persistence/hamlet/hamletSession.js', () => ({
  getActiveHamletId: () => 'eraanurbs',
}));

jest.unstable_mockModule('../../../../src/core/persistence/hamlet/hamletAccess.js', () => ({
  HAMLET_ACCESS: { active: 'active', unlocked: 'unlocked', locked: 'locked' },
  HAMLET_ACCESS_CHANGED_EVENT: 'anoria:hamlet-access-changed',
  canTravelToHamlet: jest.fn(async () => false),
  listHamletsWithAccess,
}));

const { initHamletTravelMenu } = await import('../../../../src/presentation/dom/shell/HamletTravelMenu.js');

function mountHamletTravel() {
  document.body.innerHTML = `
    <button id="hamlet-travel-btn" type="button" aria-expanded="false"></button>
    <div id="hamlet-travel-menu" class="hamlet-travel__carousel" hidden aria-hidden="true" inert>
      <button id="hamlet-travel-prev" type="button" hidden></button>
      <div id="hamlet-travel-viewport" class="hamlet-travel__viewport">
        <div id="hamlet-travel-track" class="hamlet-travel__track"></div>
      </div>
      <button id="hamlet-travel-next" type="button" hidden></button>
    </div>
  `;
}

describe('HamletTravelMenu access states', () => {
  beforeEach(() => {
    mountHamletTravel();
    initHamletTravelMenu();
  });

  test('renders active, unlocked, and locked destination styles', async () => {
    await Promise.resolve();

    const track = document.getElementById('hamlet-travel-track');
    const buttons = [...track.querySelectorAll('[data-hamlet-id]')];
    expect(buttons).toHaveLength(3);

    const active = track.querySelector('[data-hamlet-id="eraanurbs"]');
    const locked = track.querySelector('[data-hamlet-id="clairiere"]');
    const unlocked = track.querySelector('[data-hamlet-id="pont-saules"]');

    expect(active.classList.contains('hamlet-travel__dest--active')).toBe(true);
    expect(active.disabled).toBe(true);

    expect(locked.classList.contains('hamlet-travel__dest--locked')).toBe(true);
    expect(locked.disabled).toBe(true);

    expect(unlocked.classList.contains('hamlet-travel__dest--unlocked')).toBe(true);
    expect(unlocked.disabled).toBe(false);
  });
});
