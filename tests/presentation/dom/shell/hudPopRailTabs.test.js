/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  activateHudPopRailTab,
  initHudPopRailTabs,
} from '../../../../src/presentation/dom/shell/hudPopRailTabs.js';

function mountRail() {
  document.body.innerHTML = `
    <aside id="hud-pop-rail">
      <div class="hud-pop-rail__tabs" role="tablist">
        <button type="button" role="tab" data-tab="pop-details" aria-controls="hud-pop-panel-details" aria-selected="true">Pop</button>
        <button type="button" role="tab" data-tab="pop-ressources" aria-controls="hud-pop-panel-ressources" aria-selected="false" tabindex="-1">Res</button>
      </div>
      <section id="hud-pop-panel-details" role="tabpanel"></section>
      <section id="hud-pop-panel-ressources" role="tabpanel" hidden></section>
    </aside>
  `;
  return document.getElementById('hud-pop-rail');
}

describe('hudPopRailTabs', () => {
  beforeEach(() => {
    mountRail();
  });

  test('switches the visible panel to ressources', () => {
    const root = document.getElementById('hud-pop-rail');
    activateHudPopRailTab('pop-ressources', root);

    const detailsTab = root.querySelector('[data-tab="pop-details"]');
    const ressourcesTab = root.querySelector('[data-tab="pop-ressources"]');
    expect(detailsTab.getAttribute('aria-selected')).toBe('false');
    expect(ressourcesTab.getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('hud-pop-panel-details').hidden).toBe(true);
    expect(document.getElementById('hud-pop-panel-ressources').hidden).toBe(false);
  });

  test('ArrowDown from the tablist selects ressources', () => {
    const root = document.getElementById('hud-pop-rail');
    initHudPopRailTabs(root);
    const tablist = root.querySelector('[role="tablist"]');
    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

    expect(root.querySelector('[data-tab="pop-ressources"]').getAttribute('aria-selected')).toBe('true');
    expect(document.getElementById('hud-pop-panel-ressources').hidden).toBe(false);
  });
});
