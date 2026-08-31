import {
  importEditorStackObjects,
  resetEditorNatureLayout,
} from '../../../../../presentation/three/editor/editorNatureLayout.js';

/** @typedef {import('../../../application/ports/EditorStackLayoutPort.js').EditorStackLayoutPort} EditorStackLayoutPort */

/** @returns {EditorStackLayoutPort} */
export function createEditorNatureStackLayoutPort() {
  return {
    resetStackObjects: resetEditorNatureLayout,
    importStackObjects: importEditorStackObjects,
  };
}
