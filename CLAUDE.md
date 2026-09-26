# Instructions for Claude Code — Anoria

## No silent fallbacks

Never add a fallback that shows or returns a stand-in value when the real input is missing or wrong: a default
texture, an alias id, a guessed type, an implicit footprint, a `?? 'something'`, a default argument that
"keeps things working". Throw an explicit error (naming what is missing) so the real cause is visible right away.
A substitute value misleads: it hides the defect and sends the investigation in the wrong direction.

When you meet an existing silent fallback while working on something, say so and propose making it strict.

## Player wording comes from the catalog

Any word the player reads that the catalog decides must be read from the catalog, never written by hand in UI
code: a building's name (`displayName`), a good's name and unit (`ResourceCategoryCatalog`), a social category's
name (the name of its house), a month or season a schedule names, a capacity or range declared on a role. Use
`src/presentation/dom/shell/CatalogVocabulary.js` (`buildingName`, `goodLabel`, `goodAmount`, `namesOfBuildings`,
`scheduleLabel`, ...) so that changing the catalog changes the wording everywhere.

A term the catalog does not give is shown as "…" with a one-time `console.warn('[vocabulary] …')`, on purpose, so
what is still hardcoded or undeclared stands out (`pnpm console:tag vocabulary --follow` while `pnpm dev` runs). This
is the one exception to "no silent fallbacks": it is visible and warned about, never a made-up word.

Still hand-written on purpose: the tutorial and news narrative, generic role nouns ("Fermes"), the placeholder
report, accounting labels.
