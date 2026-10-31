import { parseEditorMapLayout, serializeEditorMapLayoutDocument } from '../../domain/validateEditorMapLayout.js';

/** @typedef {import('../../domain/EditorMapLayout.js').EditorMapLayout} EditorMapLayout */

/**
 * Reads a map document (a file the player chose, or the one the editor menu kept): the layout it holds, or an error saying why it is not a map.
 * @param {unknown} document
 * @returns {EditorMapLayout}
 */
export function readEditorMapDocument(document) {
  return parseEditorMapLayout(document);
}

/**
 * The document of a layout, as a file or the editor menu keeps it.
 * @param {EditorMapLayout} layout
 * @returns {object}
 */
export function editorMapDocumentOf(layout) {
  return serializeEditorMapLayoutDocument(layout);
}
