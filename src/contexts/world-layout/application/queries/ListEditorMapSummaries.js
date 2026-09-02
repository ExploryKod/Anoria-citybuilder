/** @typedef {import('../ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort} EditorMapRepositoryPort */

/**
 * @param {EditorMapRepositoryPort} repository
 */
export async function listEditorMapSummaries(repository) {
  return repository.listSummaries();
}
