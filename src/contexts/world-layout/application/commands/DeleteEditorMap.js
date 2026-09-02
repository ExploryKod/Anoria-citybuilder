/** @typedef {import('../ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort} EditorMapRepositoryPort */

/**
 * @param {EditorMapRepositoryPort} repository
 * @param {string} id
 */
export async function deleteEditorMap(repository, id) {
  await repository.deleteById(id);
}
