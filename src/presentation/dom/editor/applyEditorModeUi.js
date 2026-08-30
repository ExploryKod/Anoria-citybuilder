import { isEditorMode } from '../../../shared/gameplay/gameMode.js';

/**
 * Editor session chrome — hides mission/tutorial affordances and shows a mode banner.
 * Terrain/nature placement tools hook in here later.
 */
export function applyEditorModeUi() {
  if (!isEditorMode()) return;

  document.body.classList.add('game-mode-editor');

  const hideIds = ['tutorial-btn', 'objectives-btn'];
  for (const id of hideIds) {
    const el = document.getElementById(id);
    if (el) {
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
    }
  }

  if (document.getElementById('editor-mode-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'editor-mode-banner';
  banner.className = 'editor-mode-banner';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    <span class="editor-mode-banner__label">Mode éditeur — terrain &amp; nature</span>
    <a class="editor-mode-banner__link" href="/">Menu</a>
  `;
  document.body.appendChild(banner);
}
