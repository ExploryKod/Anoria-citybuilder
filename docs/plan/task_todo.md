# Tasks to do later

## Famine message wording: "sommes" should be "sont" (noted 2026-10-11)

In the info panel of a house, the Messages tab says "6 d'entre nous sommes affamés". It should read "6 d'entre nous
sont affamés" ("1 d'entre nous est affamé" is already right). The wording is in
`src/presentation/dom/info/presenters/formats/messagesInfoFormat.js` (line 32).

## Watch: famine count was 5 of 6 for several turns, then became 6 of 6 (observed 2026-10-11)

A 6/6 house with only farms (no market, no granary, no food stock left) showed "5 d'entre nous sommes affamés" for several
turns, then "6 d'entre nous sommes affamés". The count is now right, but the cause of the 5 is unknown and it did not fix
itself within "several turns". If it comes back, check where `totalUnfed` is computed: a house's `lastConsumption`
(`taken` / `demand`), whether it reads the previous month, or a leftover share counted as fed.

## Built, to check in the app: where a house's people work (2026-10-11)

The Savoirs tab of a house now has an "Employeurs" row under the skills: one entry per type of building that employs some of
its inhabitants (icon from the building's toolbar icon, name from the catalog, how many of the house work there, the most
first), then "sans emploi" for those with no job (always shown, even at 0). It reads `accounting.getHouseResidents` (the Habitants tab's reading),
grouped by `workplaceType`: `houseInfoFormat.js` (`employersOf`), `buildingInfoLayout.js` (`appendHouseholdEmployers`),
`CatalogVocabulary.js` (`buildingIconHtml`).

To check: a house with workers in two kinds of building shows two entries whose numbers plus "sans emploi" equal its
population; the icons (SVG, picture or emoji depending on the building) are the right size; no `[vocabulary]` warning.
Still open: precise building (x, y) is not shown; "sans emploi" is written by hand (no catalog entry for it); its icon is the HUD's unemployment picture (`no-work_colored.png`), whose path is written in `houseInfoFormat.js` and in `game.html`.

## Scopes that have no effect (noted 2026-10-11)

Some buildings show a scope to the player that changes nothing in play: every house receives the water of a tank and the goods of a
market whatever the distance. Until the rules enforce a scope for real, **every scope that serves the houses is Infinity** in the catalog
(the distributors of needs and services: tank, plants, fire, police, doctor, hospital, bath, school, library, theatre, cinema,
café-restaurant, markets).

Not to confuse with the scopes that DO bite and stay finite: a market must be placed within 5 tiles of a silo and 8 of a warehouse
(`MARKET_SILO_PLACEMENT_RANGE`, `MARKET_WAREHOUSE_RANGE`: placement rejects a market too far), a warehouse collects the goods of
producers within `WAREHOUSE_RANGE`, a workshop draws its inputs from a warehouse within `WAREHOUSE_RANGE`.

To solve: find which panel or tool still shows a finite scope for a market or a tank (the "Portée" tool, an info row), decide what a
distributor's scope should mean (who it reaches, by road or by distance), make the distribution read it, and give finite values back
where it should bite.

## A "lego" placement step for big buildings made of several parts

Idea (not built): instead of placing a multi-mesh building (the nuclear plant, `geometry.parts`) in one click, the player places each
part with its own button, next to each other. The game checks the parts touch and fit the building's recipe, then qualifies the whole as
the building. A new placement step guides the player with ghost colours (the next part to place, valid and invalid spots), as the
placement ghost already does. The one-click multi-mesh plant works today and stays the default; this would be a second way to build it.
