# Gameplay — the tutorial

The tutorial teaches the first steps of a solid economy, one instruction at a time (road, houses, residents, field, granary, market, workers).
It is **Gameplay's**: the script and the rule that advances it. The instruction reaches the player as a **dépêche of category `tutorial`**, filed by
**Intelligence**.

## The script is data

`domain/catalogs/TutorialCatalog.js` is an ordered list of steps `{ id, done, news }`.

- `done`: conditions that, all together, say the player has done what the step asks. A condition is `{ <kind>: <argument> }`.
- `news`: the dépêche that gives the instruction, or `null` for a step that only waits (the opening's dépêches already lead to the mayor's house,
  in every mode). Its `action` puts a building in hand, like the other dépêches' buttons.
- Words the catalogs decide are tokens, never typed: `{building:<id>}`, `{skill:<id>}`. No figure in a sentence.

Changing the tutorial with the game means editing this list. The only code that grows is the list of **kinds of condition**
(`CONDITION_KINDS` in `domain/policies/TutorialProgressPolicy.js`):

| Kind | Holds when |
|---|---|
| `built` / `housed` / `staffed` | at least one (or `{ type, atLeast: N }`) building of that type stands / has residents / has all its workers |
| `roadBuilt` | a road stands, whichever its variant |
| `noWork: [ids]` | a building of one of those types shows the no-work sprite: it needs workers and has none (the city's `understaffedBuildingIds` rule) |
| `turnAtLeast` / `season` / `month` / `harvest` / `harvestWithin: N` | the game's clock: a turn reached, the season or month, the harvest month, the harvest at most N months away |
| `foodCovered: 'built' \| 'staffed'` | the fields' yearly harvest covers what the houses placed eat when full |

`foodCovered` is how "the right number of fields" is asked without writing a number: a field is recognised by `getAnnualSupplyEntry`, its
yield and a citizen's need (`getPerCapitaDemand`) come from the economy catalog, and a house's capacity is its first tier in
`socialCategoryCatalog.js`. Retune the economy and the tutorial asks for the new count by itself. The counts of houses are the only numbers in
the script.

## Dispatches

`TUTORIAL_DISPATCHES` are dépêches that are not a step's: `{ id, news, when?, unless?, step?, delay? }`, triggered exactly like a toast, so a
dépêche can come "when this building stands" or "N turns after this step was reached", whichever step the player is on. They are written once
(Intelligence's once-only rule, keyed by the dispatch id). A `news` may carry `illustrations` (building ids shown as pictures in a row under the
text, no button), an `image` (`{ src, alt }`, a file of `public/`, e.g. a screenshot of the interface) and, as before, an `action`. A dépêche
(a step's or a dispatch's) is read a page at a time inside the same modal: `choices` are buttons, each with a sentence of the catalog (`label`), that
open a page; `next` is the page "Lire la suite" opens. A page has the same fields as the dépêche (`body`, `action`, `illustrations`, `image`,
`choices`, `next`, and `legend`: icons of the interface with a word each, `[{ icon, word }]`, the icon being a key of `NEWS_LEGEND_ICONS` in
`NewsEventModal.js` whose button's own icon is copied), so a long explanation is cut into pages rather than spread over several dépêches.

Tokens added: `{skillicon:<id>}` (a skill's emoji), `{harvest:when}` (the harvest schedule's season or month), `{farms:3*House-Red/Farm-Wheat}`
(how many fields feed 3 such houses, from the catalog). A toast may `highlight: 'construction'` (the house-shaped button that opens the build bar) or `'road'` (the road button beside it): the button turns
yellow and pulses until clicked (`presentation/dom/onboarding/tutorialHighlight.js`, `tutorial.css`).

## Construction buttons per step

Every step carries `allow: [building ids]`: the construction buttons that work while the player is on it. The other construction buttons (every tool that
is a building of the catalog) are greyed out and do nothing; once the script is over, none is. `AdvanceTutorial` answers `allowed` (the current step's
list, or null), and the presentation applies it through `ButtonStateManager.restrict`, which also reaches the buttons the build bar creates later. A
building that a dépêche or a toast of the step asks for must be in the step's `allow`, unless the dépêche itself unlocks it: a dispatch may carry
`unlocks: [building ids]`, and those buttons work from the moment that dépêche has been written (`wasAnnounced`, read from what Intelligence filed). The
merchants' house is unlocked that way by `merchants-needed`: it is greyed out until the shortage of hands is explained.

## Objective counter

A step may carry `counter: { label, items: [{ type, atLeast }] }`. `AdvanceTutorial` answers `progress` (the current step's counter: label, have, target)
and `justCompleted` (the counter of the step the player has just finished, full). The HUD shows it as a pulsing line under the season and date
(`#tutorial-objective`, `TutorialObjective.js`): "Maisons « Artisans » construites 2/3". The counter of a step that has a dépêche appears only once the player got past it (closed it, or left by its button: it is then archived, `wasRead`);
the game looks at the tutorial as soon as the dépêche modal closes. A finished counter stays on screen, green, for a moment before the
next step's takes over; the congratulation toast of the objective comes at the same time.

## Reminders, blocking dépêches, history

- A step may carry `reminder: { after, every?, duration, text }`: a warning toast (id `reminder:<step id>`) when the player has stayed on the step
  `after` turns without doing it, again every `every` turns; it is taken off when the step is done.
- A dépêche whose `news` is `blocking: true` (it needs an `action`) cannot be closed: no close button, no Escape, no "next". Its button puts the
  building in hand; the dépêche is not archived and comes back two turns later while the building is still missing, until it stands. The tutorial's
  `famine-warning` is one: the fields are missing as the harvest comes close (`harvestWithin: N` months, read from the harvest schedule).
- Nothing comes before its time: a step is the first not done, and the dispatches tied to a `step` wait for that step to be reached, so the next
  dépêche of the sequence does not arrive before the player did what the current one asks.
- The history button (`#tutorial-history-btn`, tutorial games only) opens a list of the dépêches of category `tutorial`, newest first. Each row has
  "Lire" (the dépêche's pages and pictures, "Retour à la liste" to leave) and, once the dépêche is read, "Supprimer". Removing is `hideNewsItem`: the
  dépêche stays filed with `hidden: true` (deleting it would let the once-only rule write it again), and only this list stops showing it.

## Timing

A step may carry `delay: N` — turns (days) between the player reaching the step (the previous one done) and its dépêche. A toast takes the same
`delay`: turns its moment must last before it shows. Absent = at once. The turn the step was reached is session memory only (like the toasts'):
a game reopened mid-tutorial restarts the wait, and a dépêche already announced is never repeated. The wait is counted on the game clock, so it
holds across a fast-forward batch.

## Toasts

`TUTORIAL_TOASTS` (same file) are short, non-blocking messages that underline a moment while the player works ("« Marché » est maintenant
pourvu en travailleurs !"). A toast is `{ id, kind, duration, text, when?, unless?, step?, delay? }` with the same conditions and tokens as a step. `duration` (ms on screen) is
required. `step` ties it to the script: it is on only once the player has reached that step; `when` and `step` can be used alone or together (one
is required). Beyond the city's facts, conditions read the clock: `turnAtLeast: N`, `season`, `month`, and `harvest: true` (the month the
catalog's harvest schedule names; the root matches it, Gameplay reads no supply). A toast is taken off the screen early — and its highlight cleared — when the player does what it points at (`until`: conditions that all hold; a toast
whose `until` already holds is not shown) or when its moment goes off. `AdvanceTutorial` answers the ids to hide (`dismissed`); the presentation
hides them (`hideTutorialToast`). It is **due the moment
its conditions come true** (and none of its `unless` holds), and again only if that moment goes and comes back. `AdvanceTutorial` keeps, for the
session only, which toasts were on at the last look; the first look only records, so a game reopened mid-tutorial does not repeat what was
already true. Nothing is stored. Gameplay returns the toasts; the presentation shows them (`showToast`, injected into `runGameTick`).

## The rule

The step the player is on is the **first one not done**, in the catalog's order. Progress is derived from the city's facts each time, never stored.
The only memory is Intelligence's once-only announcement (`tutorial:<step id>:<hamlet>`). A catalog mistake (unknown building, skill, kind of
condition, missing `news`) throws when the contexts are built and names the step (`validateTutorialSteps`).

## Boundaries

| | Owner | How |
|---|---|---|
| The script, the progress rule, `AdvanceTutorial` | Gameplay | `domain/`, `application/` |
| The city's facts (building rows: type, residents, workers) | Construction rows | `TutorialFactsPort`, implemented in `composition/createGameplayContext.js` |
| The dépêche, its category `tutorial`, the once-only rule | Intelligence | `TutorialAnnouncerPort` → `announceGuidance` → `AnnounceGuidance` |
| Whether this game is a tutorial | the session (`isTutorialMode`) | injected as `isActive`; the domain reads no session |

Gameplay never imports Intelligence (or any context): it hands a finished text to a port, and the composition root connects them.

## When it runs

- After a placement (`presentation/three/game.js`, through `sessionApi.gameplay.advanceTutorial()`), once the open dépêche has been read.
- At the end of each turn (`composition/runGameTick.js`), before the news is presented; not on the silent days of a fast-forward batch (the
  toasts would be spent unseen, and the batch's last day looks at the same city).

`advanceTutorial()` answers `{ news, toasts }`: the dépêche just written (or null) and the toasts due. Outside a tutorial game it is a no-op.

## Open points

- Farms harvest once a year, in autumn: the last step ("staff the chain") says to wait for the harvest. A tutorial that starts late in the year
  would let the player see it sooner (a boot-config choice, not a change of the farm's schedule).
- Once the script is over, the end-of-turn check still reads the building rows in a tutorial game.
