/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  initHudPopRailCollapse,
  setHudPopRailCollapsed,
  HUD_POP_RAIL_COLLAPSED_KEY,
} from '../../../../src/presentation/dom/shell/hudPopRailCollapse.js';

function mountRail() {
  document.body.innerHTML = `
    <aside id="hud-pop-rail">
      <button type="button" id="hud-pop-rail-collapse" aria-expanded="true"></button>
      <button type="button" id="hud-pop-rail-expand" hidden></button>
      <div class="hud-pop-rail__tabs"></div>
      <div class="hud-pop-rail__panels"></div>
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
