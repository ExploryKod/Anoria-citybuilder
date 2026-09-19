import { registerEditorMap } from '../../../contexts/world-layout/application/commands/RegisterEditorMap.js';
import { deleteEditorMap } from '../../../contexts/world-layout/application/commands/DeleteEditorMap.js';
import { listEditorMapSummaries } from '../../../contexts/world-layout/application/queries/ListEditorMapSummaries.js';
import { getEditorMapRepository } from '../../../composition/editorMapRepository.js';

/** @typedef {import('../../../contexts/world-layout/domain/EditorMapLayout.js').EditorMapSummary} EditorMapSummary */

/**
 * Cartes terrain disponibles (public/maps) — pas des missions.
 *
 * @returns {Promise<EditorMapSummary[]>}
 */
export async function loadAvailableEditorMaps() {
  return listEditorMapSummaries(getEditorMapRepository());
}

/**
 * @param {File} file
 * @returns {Promise<EditorMapSummary>}
 */
export async function uploadEditorMapFile(file) {
  const text = await file.text();
  const raw = JSON.parse(text);
  const layout = await registerEditorMap(getEditorMapRepository(), raw);
  return { id: layout.id, name: layout.name, citySize: layout.citySize };
}

/**
 * @param {string} mapId
 */
export async function deleteEditorMapById(mapId) {
  await deleteEditorMap(getEditorMapRepository(), mapId);
}

/**
 * @param {string | null} selectedMapLayoutId
 * @returns {string}
 */
export function renderMyMapSection(selectedMapLayoutId) {
  const sourceLine = selectedMapLayoutId
    ? `Source : <code>maps/${selectedMapLayoutId}.json</code>`
    : 'Choisissez une carte ci-dessous.';

  return `
    <div class="mission-my-map">
      <p class="site-section-title">Ma carte</p>
      <p class="mission-my-map-hint">
        Cette mission doit être conçue dans l'éditeur. Vous pouvez utiliser un fichier JSON
        pour charger le terrain conçu.
      </p>
      <div class="mission-my-map-actions">
        <label class="site-btn site-btn--inline mission-my-map-upload">
          Téléverser votre terrain
          <input type="file" id="mission-map-upload" accept="application/json,.json" hidden>
        </label>
        <button
          type="button"
          id="mission-map-open-editor"
          class="site-btn site-btn--inline mission-my-map-editor-link"
        >
          Concevoir votre terrain
        </button>
      </div>
      <p class="mission-my-map-source" id="mission-map-source">${sourceLine}</p>
      <div class="mission-map-grid" id="mission-map-grid" aria-label="Cartes disponibles"></div>
      <p class="mission-my-map-upload-status" id="mission-map-upload-status" hidden></p>
    </div>
  `;
}

/**
 * @param {HTMLElement} gridEl
 * @param {readonly EditorMapSummary[]} summaries
 * @param {string | null} selectedMapId
 * @param {(mapId: string) => void} onSelect
 * @param {(mapId: string) => Promise<void>} onDelete
 */
export function renderMapGrid(gridEl, summaries, selectedMapId, onSelect, onDelete) {
  if (!gridEl) return;

  if (summaries.length === 0) {
    gridEl.innerHTML = '<p class="mission-map-grid-empty">Aucune carte dans <code>public/maps</code>.</p>';
    return;
  }

  gridEl.innerHTML = summaries.map((summary) => `
    <article
      class="mission-map-card${summary.id === selectedMapId ? ' is-selected' : ''}"
      data-map-id="${summary.id}"
    >
      <button type="button" class="mission-map-card__body" data-action="select">
        <span class="mission-map-card__name">${escapeHtml(summary.name)}</span>
      </button>
      <button
        type="button"
        class="mission-map-card__delete"
        data-action="delete"
        aria-label="Supprimer ${escapeHtml(summary.name)}"
        title="Supprimer"
      >×</button>
    </article>
  `).join('');

  gridEl.querySelectorAll('.mission-map-card').forEach((card) => {
    const mapId = card.getAttribute('data-map-id') ?? '';
    card.querySelector('[data-action="select"]')?.addEventListener('click', () => onSelect(mapId));
    card.querySelector('[data-action="delete"]')?.addEventListener('click', async (event) => {
      event.stopPropagation();
      await onDelete(mapId);
    });
  });
}

/**
 * @param {string} value
 */
function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
