import { createHttpEditorMapRepository } from '../contexts/world-layout/infrastructure/adapters/http/HttpEditorMapRepositoryAdapter.js';

/** @type {import('../contexts/world-layout/application/ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort | null} */
let repositoryInstance = null;

/**
 * Composition root — swap adapter here (HTTP today, SQLite tomorrow).
 *
 * @returns {import('../contexts/world-layout/application/ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort}
 */
export function getEditorMapRepository() {
  if (!repositoryInstance) {
    repositoryInstance = createHttpEditorMapRepository();
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
