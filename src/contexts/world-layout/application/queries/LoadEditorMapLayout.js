/** @typedef {import('../ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort} EditorMapRepositoryPort */

/**
 * @param {EditorMapRepositoryPort} repository
 * @param {string} id
 */
export async function loadEditorMapLayout(repository, id) {
  return repository.loadById(id);
}
