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

## Relief: buildings stand on the ground of their tile (decided 2026-10-31, step 1 built)

A custom map (editor) makes its relief with Kenney terrain pieces stacked on a tile (`stackObjects`, `baseLocalY`; the Anoria map has two levels, 0 and 0.5).
Buildings used to stand at one fixed height (`KENNEY_CITY_KIT_PLATFORM_HEIGHT`), so on a plateau they sank into it. The vertical axis of the 3D scene is Y; a
tile `(x, y)` sits at world `(x, ·, y)`; a height is a `baseLocalY`, relative to `WORLD_PLATFORM_Y`.

Built: `getGroundElevation` (`kenneyPlacementProfile.js`: the top of the terrain pieces of a tile above the flat grass the game builds on, 0 there; props do not
count), read by `scene.resolveGroundElevation(x, y, width, depth)`, and the placement ghost (plain and anchored) is lifted by it. Derived from the map, never stored.

Built too (the rules): a tile carries a `relief` ({ elevation, flat }) when its map has one, set when the map layout is applied (`ApplyEditorMapLayoutToCity`) and
re-read when the editor changes a tile; plain grass has none (flat, level 0). `groundRefusal` (`FootprintAvailabilityPolicy`) refuses a footprint on non-flat ground
(`ground_not_flat`) and one **straddling two levels** (`ground_not_level`), for the ghost and for the real placement, roads included. The flat pieces are the list
the player gave (`FLAT_TOP_PIECES` in `kenneyPlacementProfile.js`: the `cliff_block*` blocks quarter/half/full/cave in rock and stone, `ground_grass`,
`ground_pathOpen`, every `path_stone*`). **Every other Kenney piece takes no building** until the player adds it to that list (the other `ground_path*`, the
rivers, the cliff faces, the slopes). A prop standing on a tile that blocks (`ground_obstructed`: trees, rocks, stones, stumps, structures, details, bushes; not the
flowers, grass, mushrooms or moss) refuses the building too: the list is `BLOCKING_PROP_CATEGORIES` in `naturePropCatalog.js`, to adjust when a prop is wrongly
blocking or not.

Built too (2026-10-31): the buildings and roads once placed are lifted by their ground (`liftToGround` in `scene.js`, at the two places that create a building
mesh); the road paint preview and the reach overlay lie on the ground of each tile; the walkers walk at their tile's height. The status icons and the plot
highlight are children of a building or of the ghost, so they follow.

The natural resources seeded on a virgin hamlet (`ResourceManager`: trees, boulders) are lifted by their ground, and only seeded on flat, clear grass (no slope, cliff or obstacle).

**Roads between two levels.** Built (2026-10-31): a road may stand on a **slope** (`SLOPE_PIECES` in `kenneyPlacementProfile.js`: `cliff_blockSlope_rock/stone`, which cover the
   whole tile and rise 1.0), never a building. `cliff_half_*` is **not** a slope (it covers only the upper part of its tile, a one-tile road would not fit it): it is a cliff,
   blocking roads and buildings. A slope rises toward where its +z axis points once turned by the piece's `rotationY` (`relief.slope` = { dx, dy, rise }). What lies on
   it is **sheared** (`placement/groundShear.js`: `y += rise × distance along the slope`), not turned: a turned plate leaves a groove at both ends, a sheared one keeps
   its whole span and meets the neighbouring roads at the exact height; the road, its ghost and the previews are laid this way, and the walkers walk at the middle
   height. On a slope a road goes straight up or down (`slopeAxisSides`, `canPlaceHere` in `game.js`): no bend, tee or side road there. Roads are two-way.
   A road touches a neighbouring road only at the same height (`roadLevelsMeet` in `roadPaintPlanner.js`, `ground_road_level`): two flat tiles of different levels, or a
   slope's end against the wrong level, are refused, in a single placement and along a drag (the path is cut there). Still to do: the other Kenney pieces (flat or
   slope) the player has not listed yet.

## A "lego" placement step for big buildings made of several parts

Idea (not built): instead of placing a multi-mesh building (the nuclear plant, `geometry.parts`) in one click, the player places each
part with its own button, next to each other. The game checks the parts touch and fit the building's recipe, then qualifies the whole as
the building. A new placement step guides the player with ghost colours (the next part to place, valid and invalid spots), as the
placement ghost already does. The one-click multi-mesh plant works today and stays the default; this would be a second way to build it.
