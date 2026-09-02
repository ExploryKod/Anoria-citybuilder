/**
 * Portable editor map layout — no Three.js, no fetch.
 * Source-of-truth document exchanged between editor export and mission load.
 */

/** @typedef {'terrain' | 'stack' | 'sea'} EditorStackAnchor */

/**
 * @typedef {object} EditorStackObjectSnapshot
 * @property {string} id
 * @property {string} assetId
 * @property {number} x
 * @property {number} y
 * @property {number} rotationY
 * @property {number} baseLocalY
 * @property {string | null} parentId
 * @property {EditorStackAnchor} anchor
 * @property {import('../../shared/editor-catalog/editorKenneyAssetBehavior.js').EditorAssetMountMode} [mountMode]
 * @property {import('../../shared/editor-catalog/editorKenneyAssetBehavior.js').EditorVerticalFaceDirection | null} [faceDirection]
 * @property {string | null} [hostAssetId]
 */

/**
 * @typedef {object} EditorMapLayout
 * @property {string} id — stable UUID (same as on-disk filename stem)
 * @property {string} name — display label in missions UI
 * @property {number} version
 * @property {number} citySize
 * @property {string[][]} terrain
 * @property {EditorStackObjectSnapshot[]} stackObjects
 */

/**
 * @typedef {object} EditorMapSummary
 * @property {string} id
 * @property {string} name
 * @property {number} citySize
 */

export {};
