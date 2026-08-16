/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { adoptHudFabDockChildren } from '../../../../src/presentation/dom/shell/hudFabDock.js';

describe('hudFabDock', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <aside id="hud-fab-dock" class="hud-fab-dock"></aside>
      <button type="button" id="cookieConsentFab"></button>
      <div id="stats-js"></div>
    `;
  });

  test('moves cookie and perf into the shared dock', () => {
    adoptHudFabDockChildren();
    const dock = document.getElementById('hud-fab-dock');
    expect(dock.contains(document.getElementById('cookieConsentFab'))).toBe(true);
    expect(dock.contains(document.getElementById('stats-js'))).toBe(true);
  });
});
