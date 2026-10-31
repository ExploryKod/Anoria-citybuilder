/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  initHudPopRailCollapse,
  setHudPopRailCollapsed,
  HUD_POP_RAIL_COLLAPSED_KEY,
} from '../../../../src/presentation/dom/shell/hudPopRailCollapse.js';

// jsdom has neither of these: the rail measures its anchor under the exit door and pages the labour market on a phone in landscape
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
};
window.matchMedia = (query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });

function mountRail() {
  document.body.innerHTML = `
    <button type="button" id="game-exit-home-btn"></button>
    <aside id="hud-pop-rail">
      <button type="button" id="hud-pop-rail-collapse" aria-expanded="true"></button>
      <button type="button" id="hud-pop-rail-expand" hidden></button>
      <button type="button" id="hud-pop-labor-next" hidden></button>
      <div class="hud-pop-rail__tabs"></div>
      <div class="hud-pop-rail__panels">
        <section id="hud-pop-panel-emploi"><div class="pop-detail-labor"></div></section>
      </div>
    </aside>
  `;
  localStorage.removeItem(HUD_POP_RAIL_COLLAPSED_KEY);
  return document.getElementById('hud-pop-rail');
}

describe('hudPopRailCollapse', () => {
  beforeEach(() => {
    mountRail();
  });

  test('collapses panels and shows the population icon', () => {
    const root = document.getElementById('hud-pop-rail');
    setHudPopRailCollapsed(true, root, { persist: false });

    expect(root.classList.contains('hud-pop-rail--collapsed')).toBe(true);
    expect(root.querySelector('.hud-pop-rail__panels').hidden).toBe(true);
    expect(root.querySelector('.hud-pop-rail__tabs').hidden).toBe(true);
    expect(root.querySelector('#hud-pop-rail-collapse').hidden).toBe(true);
    expect(root.querySelector('#hud-pop-rail-expand').hidden).toBe(false);
  });

  test('clicking the close button collapses and persists', () => {
    const root = document.getElementById('hud-pop-rail');
    initHudPopRailCollapse(root);
    root.querySelector('#hud-pop-rail-collapse').click();

    expect(root.classList.contains('hud-pop-rail--collapsed')).toBe(true);
    expect(localStorage.getItem(HUD_POP_RAIL_COLLAPSED_KEY)).toBe('true');
  });
});
