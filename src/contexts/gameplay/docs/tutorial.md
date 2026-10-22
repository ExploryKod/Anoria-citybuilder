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
(`CONDITION_KINDS` in `domain/policies/TutorialProgressPolicy.js`: `built`, `roadBuilt`, `housed`, `staffed`).

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
- At the end of each turn (`composition/runGameTick.js`), before the news is presented.

Outside a tutorial game both are a no-op.

## Open points

- Farms harvest once a year, in autumn: the last step ("staff the chain") says to wait for the harvest. A tutorial that starts late in the year
  would let the player see it sooner (a boot-config choice, not a change of the farm's schedule).
- Once the script is over, the end-of-turn check still reads the building rows in a tutorial game.
