/**
 * How the tutorial gives an instruction to the player. Gameplay hands over a finished dépêche; the context that owns the news (Intelligence)
 * files it, once per step or dispatch (`stepId` is the id of whichever it is), and knows nothing of tutorial steps. The composition root implements it.
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
 *   illustrations: string[],
 *   image: { src: string, alt: string } | null,
 *   blocking: boolean,
 *   legend: Array<{ icon: string, word: string }>,
 *   choices: Array<{ label: string, page: object }>,
 *   next: object | null,
 * }) => Promise<object | null>} announce
 * @property {(stepId: string) => Promise<boolean>} wasRead whether that dépêche was written and the player got past it (closed it, or left by its button)
 * @property {(stepId: string) => Promise<boolean>} wasAnnounced whether that step's or dispatch's dépêche has been written (it stays filed once written)
 */

export {};
