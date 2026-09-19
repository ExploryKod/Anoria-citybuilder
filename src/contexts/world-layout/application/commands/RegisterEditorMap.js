import { parseEditorMapLayout } from '../../domain/validateEditorMapLayout.js';

/** @typedef {import('../ports/EditorMapRepositoryPort.js').EditorMapRepositoryPort} EditorMapRepositoryPort */

/**
 * @param {EditorMapRepositoryPort} repository
 * @param {unknown} rawDocument
 */
export async function registerEditorMap(repository, rawDocument) {
  const layout = parseEditorMapLayout(rawDocument);
  await repository.register(layout);
  return layout;
}
