/**
 * How the tutorial gives an instruction to the player. Gameplay hands over a finished dépêche; the context that owns the news (Intelligence)
 * files it, once per step, and knows nothing of tutorial steps. The composition root implements it.
 *
 * `announce` resolves to the dépêche written, or null when that step was announced before.
 *
 * @typedef {object} TutorialAnnouncerPort
 * @property {(params: {
 *   stepId: string,
 *   turn: number,
 *   title: string,
 *   body: string,
 *   teaser: string,
 *   action: { kind: 'buildTool', toolId: string } | null,
 * }) => Promise<object | null>} announce
 */

export {};
