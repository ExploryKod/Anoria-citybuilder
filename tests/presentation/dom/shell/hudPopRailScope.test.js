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
      <button type="button" id="hud-pop-rail-scope" data-scope="hamlet">
        <svg data-scope-icon="country" hidden></svg>
        <svg data-scope-icon="hamlet" hidden></svg>
      </button>
      <span class="pop-detail-value--scoped">10</span>
    </aside>
  `;
  return document.getElementById('hud-pop-rail');
}

describe('hudPopRailScope', () => {
  beforeEach(() => {
    localStorage.clear();
    mountRail();
  });

  test('switches hamlet ↔ country, and refuses any other scope instead of replacing it', () => {
    expect(nextHudPopRailScope('hamlet')).toBe('country');
    expect(nextHudPopRailScope('country')).toBe('hamlet');
    // 'both' (figures side by side) is gone: a stale stored choice must be named, not turned into another scope
    expect(() => normalizeHudPopRailScope('both')).toThrow('unknown scope "both"');
    expect(() => normalizeHudPopRailScope('nope')).toThrow('unknown scope "nope"');
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
    expect(btn.querySelector('[data-scope-icon="country"]').hasAttribute('hidden')).toBe(true);
    expect(localStorage.getItem(HUD_POP_RAIL_SCOPE_KEY)).toBe('hamlet');
  });

  test('click switches scope, twice back to hamlet', () => {
    const root = document.getElementById('hud-pop-rail');
    initHudPopRailScope(root);
    const btn = root.querySelector('#hud-pop-rail-scope');

    expect(getHudPopRailScope(root)).toBe('hamlet');
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
