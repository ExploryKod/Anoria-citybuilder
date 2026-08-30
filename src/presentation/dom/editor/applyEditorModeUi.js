import { isEditorMode } from '../../../shared/gameplay/gameMode.js';

/**
 * Editor session hook — adds body class for editor-only styling (e.g. sea backdrop).
 */
export function applyEditorModeUi() {
  if (!isEditorMode()) return;
  document.body.classList.add('game-mode-editor');
}
