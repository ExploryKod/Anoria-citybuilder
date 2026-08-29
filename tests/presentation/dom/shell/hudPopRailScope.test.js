/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  HUD_POP_RAIL_SCOPES,
  HUD_POP_RAIL_SCOPE_KEY,
  normalizeHudPopRailScope,
  nextHudPopRailScope,
  setHudPopRailScope,
  cycleHudPopRailScope,
  initHudPopRailScope,
  getHudPopRailScope,
} from '../../../../src/presentation/dom/shell/hudPopRailScope.js';

function mountRail() {
  document.body.innerHTML = `
    <aside id="hud-pop-rail">
      <button type="button" id="hud-pop-rail-scope" data-scope="both">
        <svg data-scope-icon="both"></svg>
        <svg data-scope-icon="country" hidden></svg>
        <svg data-scope-icon="hamlet" hidden></svg>
      </button>
      <span class="pop-detail-value--country">10</span>
      <span class="pop-detail-value--hamlet">3</span>
    </aside>
  `;
  return document.getElementById('hud-pop-rail');
}

describe('hudPopRailScope', () => {
  beforeEach(() => {
    localStorage.clear();
    mountRail();
  });

  test('cycles both → country → hamlet → both', () => {
    expect(nextHudPopRailScope('both')).toBe('country');
    expect(nextHudPopRailScope('country')).toBe('hamlet');
    expect(nextHudPopRailScope('hamlet')).toBe('both');
    expect(normalizeHudPopRailScope('nope')).toBe('hamlet');
  });

  test('setHudPopRailScope updates data attribute, icon and label', () => {
    const root = document.getElementById('hud-pop-rail');
    setHudPopRailScope(HUD_POP_RAIL_SCOPES.hamlet, root);

    expect(root.dataset.popScope).toBe('hamlet');
    expect(getHudPopRailScope(root)).toBe('hamlet');
    const btn = root.querySelector('#hud-pop-rail-scope');
    expect(btn.dataset.scope).toBe('hamlet');
    expect(btn.title).toBe('Chiffres du hameau');
    expect(btn.querySelector('[data-scope-icon="hamlet"]').hasAttribute('hidden')).toBe(false);
    expect(btn.querySelector('[data-scope-icon="both"]').hasAttribute('hidden')).toBe(true);
    expect(localStorage.getItem(HUD_POP_RAIL_SCOPE_KEY)).toBe('hamlet');
  });

  test('click cycles scope three times back to hamlet', () => {
    const root = document.getElementById('hud-pop-rail');
    initHudPopRailScope(root);
    const btn = root.querySelector('#hud-pop-rail-scope');

    expect(getHudPopRailScope(root)).toBe('hamlet');
    btn.click();
    expect(getHudPopRailScope(root)).toBe('both');
    btn.click();
    expect(getHudPopRailScope(root)).toBe('country');
    btn.click();
    expect(getHudPopRailScope(root)).toBe('hamlet');
  });

  test('init restores persisted scope', () => {
    localStorage.setItem(HUD_POP_RAIL_SCOPE_KEY, 'country');
    const root = document.getElementById('hud-pop-rail');
    delete root.dataset.popRailScopeReady;
    initHudPopRailScope(root);
    expect(getHudPopRailScope(root)).toBe('country');
    expect(root.querySelector('[data-scope-icon="country"]').hasAttribute('hidden')).toBe(false);
  });

  test('cycleHudPopRailScope advances once', () => {
    const root = document.getElementById('hud-pop-rail');
    setHudPopRailScope('country', root, { persist: false });
    cycleHudPopRailScope(root);
    expect(getHudPopRailScope(root)).toBe('hamlet');
  });
});
