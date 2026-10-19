import { parseEditorMapLayout } from '../../../domain/validateEditorMapLayout.js';

/** @typedef {import('../../../application/ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort} EditorMapRepositoryPort */
/** @typedef {import('../../../domain/EditorMapLayout.js').EditorMapSummary} EditorMapSummary */

const READ_ONLY_MESSAGE = 'Les cartes ne peuvent être importées ni supprimées que sur le serveur de développement.';

/**
 * Read-only repository for the built site: the maps are static files (`maps/index.json` written by the build,
 * `maps/<id>.json` copied from public/maps). Importing or deleting a map needs the dev server's /api/maps.
 *
 * @param {string} [mapsBase='/maps']
 * @returns {EditorMapRepositoryPort}
 */
export function createStaticEditorMapRepository(mapsBase = '/maps') {
  return {
    readOnly: true,

    async listSummaries() {
      const response = await fetch(`${mapsBase}/index.json`);
      if (!response.ok) {
        throw new Error(`Failed to list editor maps (${response.status})`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload?.maps)) {
        throw new Error('Invalid editor maps index');
      }
      return /** @type {EditorMapSummary[]} */ (payload.maps);
    },

    async loadById(id) {
      const response = await fetch(`${mapsBase}/${encodeURIComponent(id)}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load editor map ${id} (${response.status})`);
      }
      return parseEditorMapLayout(await response.json());
    },

    async register() {
      throw new Error(READ_ONLY_MESSAGE);
    },

    async deleteById() {
      throw new Error(READ_ONLY_MESSAGE);
    },
  };
}
