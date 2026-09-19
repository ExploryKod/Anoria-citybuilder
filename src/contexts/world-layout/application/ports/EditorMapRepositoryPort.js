/**
 * Editor map persistence — infrastructure-agnostic (HTTP, SQLite, filesystem…).
 *
 * @typedef {import('../../domain/EditorMapLayout.js').EditorMapLayout} EditorMapLayout
 * @typedef {import('../../domain/EditorMapLayout.js').EditorMapSummary} EditorMapSummary
 *
 * @typedef {object} EditorMapRepositoryPort
 * @property {() => Promise<EditorMapSummary[]>} listSummaries
 * @property {(id: string) => Promise<EditorMapLayout>} loadById
 * @property {(layout: EditorMapLayout) => Promise<void>} register — upload / import (missions panel)
 * @property {(id: string) => Promise<void>} deleteById
 */

export {};
