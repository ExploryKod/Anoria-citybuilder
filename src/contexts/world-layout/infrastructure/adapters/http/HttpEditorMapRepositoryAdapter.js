import {
  parseEditorMapLayout,
  serializeEditorMapLayoutDocument,
} from '../../../domain/validateEditorMapLayout.js';

/** @typedef {import('../../domain/EditorMapLayout.js').EditorMapLayout} EditorMapLayout */
/** @typedef {import('../../domain/EditorMapLayout.js').EditorMapSummary} EditorMapSummary */
/** @typedef {import('../../application/ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort} EditorMapRepositoryPort */

/**
 * HTTP-backed repository — swappable for SQLite / filesystem adapters later.
 *
 * @param {string} [apiBase='/api/maps']
 * @returns {EditorMapRepositoryPort}
 */
export function createHttpEditorMapRepository(apiBase = '/api/maps') {
  return {
    async listSummaries() {
      const response = await fetch(apiBase);
      if (!response.ok) {
        throw new Error(`Failed to list editor maps (${response.status})`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload?.maps)) {
        throw new Error('Invalid editor maps list response');
      }
      return /** @type {EditorMapSummary[]} */ (payload.maps);
    },

    async loadById(id) {
      const response = await fetch(`${apiBase}/${encodeURIComponent(id)}`);
      if (!response.ok) {
        throw new Error(`Failed to load editor map ${id} (${response.status})`);
      }
      const raw = await response.json();
      return parseEditorMapLayout(raw);
    },

    async register(layout) {
      const response = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(serializeEditorMapLayoutDocument(layout)),
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(detail || `Failed to register editor map (${response.status})`);
      }
    },

    async deleteById(id) {
      const response = await fetch(`${apiBase}/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error(`Failed to delete editor map ${id} (${response.status})`);
      }
    },
  };
}
