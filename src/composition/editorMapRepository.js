import { createHttpEditorMapRepository } from '../contexts/world-layout/infrastructure/adapters/http/HttpEditorMapRepositoryAdapter.js';
import { createStaticEditorMapRepository } from '../contexts/world-layout/infrastructure/adapters/static/StaticEditorMapRepositoryAdapter.js';

/** @type {import('../contexts/world-layout/application/ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort | null} */
let repositoryInstance = null;

/**
 * Composition root — swap adapter here. The dev server has /api/maps (read, import, delete); the built site only
 * has static files (read only, see the maps index plugin of vite.config.js).
 *
 * @returns {import('../contexts/world-layout/application/ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort}
 */
export function getEditorMapRepository() {
  if (!repositoryInstance) {
    const isDevServer = typeof import.meta !== 'undefined' && Boolean(import.meta.env?.DEV);
    repositoryInstance = isDevServer ? createHttpEditorMapRepository() : createStaticEditorMapRepository();
  }
  return repositoryInstance;
}

/**
 * @param {import('../contexts/world-layout/application/ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort} repository
 */
export function setEditorMapRepositoryForTests(repository) {
  repositoryInstance = repository;
}

export function resetEditorMapRepositoryForTests() {
  repositoryInstance = null;
}
