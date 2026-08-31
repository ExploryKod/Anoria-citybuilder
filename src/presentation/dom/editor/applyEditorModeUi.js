import { isEditorMode } from '../../../shared/gameplay/gameMode.js';
import { applyEditorTerrainDisplayCssVariables } from '../../../shared/terrain-catalog/applyTerrainDisplayCssVariables.js';

/**
 * Editor session hook — adds body class for editor-only styling (e.g. sea backdrop).
 */
export function applyEditorModeUi() {
  if (!isEditorMode()) return;
  document.body.classList.add('game-mode-editor');
  applyEditorTerrainDisplayCssVariables(document.documentElement);
}
