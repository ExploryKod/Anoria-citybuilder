/**
 * What the tutorial reads of the city. Read-only: Gameplay never writes what it reads here. The composition root implements it from the
 * contexts that own the facts (the buildings from Construction, their residents and workers from the building rows).
 *
 * @typedef {import('../../domain/policies/TutorialProgressPolicy.js').TutorialFacts} TutorialFacts
 *
 * @typedef {object} TutorialFactsPort
 * @property {() => Promise<TutorialFacts>} read
 */

export {};
