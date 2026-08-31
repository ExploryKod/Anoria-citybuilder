/**
 * Applies stack snapshots to the runtime session (Three.js editor store, etc.).
 * Inversion of control — application layer does not import presentation modules.
 *
 * @typedef {import('../../domain/EditorMapLayout.js').EditorStackObjectSnapshot} EditorStackObjectSnapshot
 *
 * @typedef {object} EditorStackLayoutPort
 * @property {(objects: EditorStackObjectSnapshot[]) => void} importStackObjects
 * @property {() => void} resetStackObjects
 */

export {};
