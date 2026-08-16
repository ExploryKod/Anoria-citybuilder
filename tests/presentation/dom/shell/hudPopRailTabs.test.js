/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  activateHudPopRailTab,
  initHudPopRailTabs,
  HUD_POP_RAIL_TAB_IDS,
} from '../../../../src/presentation/dom/shell/hudPopRailTabs.js';

function mountRail() {
  document.body.innerHTML = `
    <aside id="hud-pop-rail">
      <div class="hud-pop-rail__tabs" role="tablist">
        <button type="button" role="tab" data-tab="pop-details" aria-controls="hud-pop-panel-details" aria-selected="true">Pop</button>
        <button type="button" role="tab" data-tab="pop-ressources-ville" aria-controls="hud-pop-panel-ressources-ville" aria-selected="false" tabindex="-1">Ville</button>
        <button type="button" role="tab" data-tab="pop-ressources-commerce" aria-controls="hud-pop-panel-ressources-commerce" aria-selected="false" tabindex="-1">Commerce</button>
        <button type="button" role="tab" data-tab="pop-ressources-nature" aria-controls="hud-pop-panel-ressources-nature" aria-selected="false" tabindex="-1">Nature</button>
      </div>
      <section id="hud-pop-panel-details" role="tabpanel"></section>
      <section id="hud-pop-panel-ressources-ville" role="tabpanel" hidden></section>
      <section id="hud-pop-panel-ressources-commerce" role="tabpanel" hidden></section>
      <section id="hud-pop-panel-ressources-nature" role="tabpanel" hidden></section>
    </aside>
  `;
  return document.getElementById('hud-pop-rail');
}

describe('hudPopRailTabs', () => {
  beforeEach(() => {
    mountRail();
  });

  test('switches the visible panel to ressources ville', () => {
    const root = document.getElementById('hud-pop-rail');
    activateHudPopRailTab(HUD_POP_RAIL_TAB_IDS.ressourcesVille, root);

    expect(root.querySelector('[data-tab="pop-details"]').getAttribute('aria-selected')).toBe('false');
    expect(root.querySelector('[data-tab="pop-ressources-ville"]').getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(document.getElementById('hud-pop-panel-details').hidden).toBe(true);
    expect(document.getElementById('hud-pop-panel-ressources-ville').hidden).toBe(false);
    expect(document.getElementById('hud-pop-panel-ressources-commerce').hidden).toBe(true);
  });

  test('ArrowDown from the tablist selects ressources ville then commerce then nature', () => {
    const root = document.getElementById('hud-pop-rail');
    initHudPopRailTabs(root);
    const tablist = root.querySelector('[role="tablist"]');

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(root.querySelector('[data-tab="pop-ressources-ville"]').getAttribute('aria-selected')).toBe(
      'true'
    );
    expect(document.getElementById('hud-pop-panel-ressources-ville').hidden).toBe(false);

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(
      root.querySelector('[data-tab="pop-ressources-commerce"]').getAttribute('aria-selected')
    ).toBe('true');
    expect(document.getElementById('hud-pop-panel-ressources-commerce').hidden).toBe(false);

    tablist.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(
      root.querySelector('[data-tab="pop-ressources-nature"]').getAttribute('aria-selected')
    ).toBe('true');
    expect(document.getElementById('hud-pop-panel-ressources-nature').hidden).toBe(false);
  });
});
