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

## Mining and gilded goods (2026-10-31)

Built: the **Mine** (wears Kenney industrial building-n like the network provider; 1x2) draws stone, iron and gold out of the stocks of the rocks within 6 tiles
(`source.draw` in `ProduceResource`; a rock holds what its piece declares, see `PROP_RECORDS` in `naturePropCatalog.js`; a rock left with nothing leaves the game).
A building can hold several producer entries (one per good); its once-per-month lock is then per good (`periodLock: { unit: 'month' }`, no `field`). The goods go to a
warehouse (`STORED_GOODS`); the merchants make export deals for them (`dealRock/Iron/Gold`) and trade cities want them (`TradeCatalog`). The artisans' business now makes
decorated plates, and **gilded** pots and plates (a decorated piece + gold from a warehouse), worth far more (raw pot 3 < decorated 8 < gilded 30).

Accounting detail per product (built): the goods flows of a month are summed per pair AND per good (`sumGoodsFlowsByPair`), `tradeLines` writes a sale/purchase pair per
good (each line carries `resource`, its own flow and business key), and the statement's items (`incomeStatementOf`) split a line by that good: a mine's sales read as one
small row per stone, iron and gold under "ventes". A trade that names no good is refused. A piece of nature leaves the grid on the next scene update once its record is gone
(a tree felled whole, a rock drawn to nothing).

To do:
1. What stone is for (it is mined and exportable, nothing consumes it yet).
2. Iron has no use but export; clay is not tied to a piece of nature yet.
3. The mine's balance (price 90, 3 workers, 8/4/2 a month, values 0.6 / 2 / 12) and the gilded goods' prices are a first pass to play and tune.

## Plantations: plots for sale and planted forests (decided 2026-10-31, nothing built yet)

Assets: Kenney mini-forest (`public/resources/kenney_mini-forest_1.0/Models/GLB format/`: `plant.glb`, `tree.glb`, `tree-high.glb`). The fences are the Kenney
nature kit's `nature-prop:fence_*` (straight, corner, gate...).

Rules given by the player:
- The town hall marks tiles **for sale for an activity** (only forests for now; the destinations are a catalog list, others come later). The plot is bounded by fences,
  nothing can be built on it, and the mayor can stop selling it (the fences go).
- The construction menu gets a **"Terrains"** tab, with a sub-tab per destination (Forêts first): the mayor reserves x tiles to sell as forests.
- A lumberjack (household or industrial) with the budget **buys** plots when there are not enough trees in range and plots are for sale. The price per tile is a catalog
  value (to tune), a revenue of the city; the plot becomes private. Afterwards the lumberjack's wood costs nothing more.
- On its plot it plants `plant` (Kenney mini-forest); a year later it is a `tree` (100 wood), the year after a `tree-high` (200 wood). A tree or high tree used up leaves
  the tile **fallow for one month**, then a `plant` again, and so on.
- Like everything on the grid, a plot tile, a fence and a planted tree are pieces with coordinates and a record (the planted tree's record holds its wood).

Chosen first slice: plots + fences + the "Terrains" tab (nothing planted yet). Then: the buying lumberjack, then the growth cycle.

Slice 1 built (2026-10-31, not yet seen in the browser): `shared/land-catalog/` (`LandUseCatalog.js` the uses, price per tile and fence piece; `plotLayout.js` the fences
around plots and which tiles can be marked; `plotTools.js` the tool ids `plot:<use>:<mark|clear>`). The plots are a list on the hamlet's row (`getHamletPlots` /
`saveHamletPlots`), put on the tiles as `tile.plot` (which refuses building: `ground_plot`). The fences are drawn by `scene.setPlotFences` (one straight
`fence_simple` per open side, its -z edge turned onto the side; they are not pieces of the editor's stack). The "Terrains" pill of the build bar has one cluster per use
with "mettre en vente" / "retirer de la vente"; the gesture is the eraser's square (`PLOT_SQUARE_MAX_SIDE`), behaviour mode `plot`.
To check by playing: fence orientation and height on a plateau, the pill/cluster look on a phone, a plot saved and reloaded, the fences after travelling between hamlets.
Not done: a plot is not yet a piece with a record (it is a list on the hamlet), nothing shows the plot's count.

Slice 2 built (2026-11-01, not yet seen in the browser): **the buying lumberjack.** `landPurchase` on the lumberjacks (`buildingEconomy.js`: use, resource, `buysBelowSources: 2`,
`tilesPerPurchase: 4`, first values) → each month's last day `RunMonthlyLandPurchases` (supply) buys the nearest plots for sale in range when fewer than 2 trees still hold wood
(`LandPurchasePolicy`); the price is the hamlet's (`getHamletLandPrice`, default the catalog's), paid through `accounting.sellLandToCompany`: `land_purchase` (211) on the buyer,
`land_sale` (775) on the owner house's SCI account, both or nothing, refused with no line when the buyer's cash is short. The plot takes the buyer's id as `owner` and is tinted
dark green (event `land.plotsChanged`). The owner's house has a **Prix** tab (`landPricesView.js`) to set the price per tile. Plots saved before `owner` existed fail to load.
Slice 3 built (2026-11-01, not yet seen in the browser): **planting and growth.** Each owned forest tile has a `crop` ({ stage, since }) and a `groundY` on the hamlet's plot list; every
month's last day `RunMonthlyForestGrowth` (after the purchases) plants a `plant` (mini-forest kit: `PLANTATION_PROP_IDS` in `naturePropCatalog.js`, heights in
`kenneyPlacementProfile.js`), turns it into a `tree` after 12 months (100 of the owner's resource) and a `tree-high` after 12 more (200, less what was taken from the tree);
a tree or high tree whose record is gone leaves the tile fallow for 1 month, then a plant again (`crop` of the use in `LandUseCatalog.js`, `ForestGrowthPolicy.js`).
Each stage is a nature record with `planted: true` and the piece it shows; the lumberjacks gather from those records like from any tree, and the scene's daily sync of the
pieces draws the piece the record says (`scene.js`, `naturePieces`). Plots saved before `crop` and `groundY` fail to load.
Still to build: the plot's count in the editor/panel; the growth delays and yields are first values to tune; the look of the three pieces (scale, rotation) to check in play.

## The granary buys unsold perishables at any time, at a low price (noted 2026-10-31, not built)

Seen in play: producers have unsold goods that will spoil, yet the granary stays empty because it only buys in certain months (its purchase schedule).

Wanted: an exception to that schedule. When a producer holds an unsold stock **at risk of spoiling** and the granary **has room to store it**, the granary may buy it **at any
time of the year**, at a **low price** (a salvage price, below the usual one). Outside that case the schedule stays as it is.

**Refined by the player (same day):**
- **Trigger: the surplus message.** As soon as the game raises the over-production message ("Trop de champs (6) : 1728 paniers récoltés par an pour 936 paniers mangés.
  864 paniers risquent d'être jetés, avariés."), the surplus it names (the 864) can be sold **the following month** to the hub.
- **Room.** If the hub has room for all of it, it takes all of it. If not, it takes **pro rata** (its room shared among the sellers in proportion to their surplus).
- **Price.** The existing freshness rule applies (`getFreshnessPriceCurve`: the price falls with the share of shelf life left); no new price rule.
- **General rule.** It holds for **every good with a finite shelf life**, not only food. The buyer is the **granary** for the food, but sometimes the **warehouse**: the buyer is
  whichever hub stores that good (declared by the catalog's roles), not a hard-coded granary.

**Where the figure comes from (player, same day).** The surplus is known by the **producer buildings** themselves: the ones that hold it are the ones that raise the message
(the wording takes a different form for each activity: "Trop de fermes" is only an example). So the figure exists already, per building, and **each producer can sell its
surplus immediately, and the hub (warehouse or granary) buy it immediately**, in the same turn the message is raised, without waiting for the following month.
(This replaces "the following month" above.)

**Sharing a contested room (player, same day, restated).** A seller with x unsold sells all its x to the hub. If competitors want to sell at the same moment (the same month)
y more, then:
- the hub has room for x + y: it takes everything;
- the hub lacks room for both: **each competitor gives the same quantity**, within the room the hub has (not in proportion to the surplus; this replaces "pro rata" above).
A seller with less than the equal quantity gives all it has, and the room it leaves is shared again, equally, among the others (confirmed by the player).
- **Alone in the month:** a seller with more than the hub has room for, and no competitor that month, sells as much as the hub has room left, no more.
- **Already in the game, nothing to code (remember it):** room is not the only limit to a hub's purchase. A granary with plenty of room that **cannot pay** (no cash...) buys
  nothing, and the unsold stays unsold; the city can then give it an **emergency aid** and the hub buys the **following month**. This exists already: the new rule must work
  with it, not duplicate it (the surplus rule above lifts the limit of the buying *window*; the cash limit and its aid stay as they are).
- **First come, first served by month:** a seller that comes after another (a later month) gets what room is left: the earlier month wins. The equal sharing above only
  applies between sellers selling in the same month.

To settle when building it: the producer's surplus figure is the one source (one traced channel: the purchase reads what the message reads, never a second computation), and
where the rule lives (the hub's purchase window in the supply context, declared in the catalog, not
hard-coded per building).

**Who owns the plots, and who is paid (player, 2026-11-01).** The land for sale belongs to the **administrators (the owner's house) and their property company (SCI)**, not to
the city. A plot with `owner: null` is therefore the SCI's: **the sale price goes to the owner's house, on its SCI business account, when ownership is transferred** to the
buyer (`owner` = the buying company's building id). This replaces "a revenue of the city" above. Bought tiles are tinted dark green on the map (built: `ownedPlotTint`
in `scene.js`); tiles still for sale only have their fences.
- The owner's house is not a fixed id: it is derived like the rents (`getRentalHouses` in `createAccountingContext.js`: the house whose residents hold the owner skill, with
  people in it). So `owner: null` stays the stored value for "the SCI's"; the payee is resolved when the sale is booked, never stored on the plot.
- The sale is a real double entry (PCG): the buyer books the land as a fixed asset (211), the SCI books the disposal of an asset against the cash it receives.
- **The SCI's cost of the land is nothing (player).** The land was found, bought from no one: the SCI owns every tile for 0 €, so the whole sale price is its gain.
- **The price is a setting, per category of land (player).** Each plot is sold at the price set for its category: today "non-buildable land for forestry" (forest); buildable
  land etc. will be other categories later. The default is declared in the catalog (`pricePerTile` of `LandUseCatalog.js`), and the player can change it **at the start of
  the game**; the figure is edited from **a tab of the SCI** (the owner's house, Enterprises tab, next to the rents). To settle: whether "at the start of the game" means
  frozen once the game begins (like the calendar) or editable at any time; each sale then uses the price in force on that day.
- **Decided (player, 2026-11-01), this replaces the "frozen or editable" question above:** the price starts at the catalog default and **evolves**; the player can change it
  **at any time once the mayor's house is placed**, from a **"Prix" tab of that house**. The tab lists only the prices of **what the house sells**: for now one line,
  land for forestry, **per tile (the equivalent of a hectare)**; each sale uses the price in force that day. The prices set are the hamlet's own state (not the catalog).
- **Planned for later (not built): a market price indication.** The "Prix" tab will also show the **market price** of the land, which will depend on the **real purchasing
  power of the buyers** and be influenced by the **attractiveness** (of the hamlet/the site). It is only an indication next to the price the player sets (the player's price
  is what applies). To plan the data now: the price set is stored per category of land and per hamlet; the market figure is derived at display time from the buyers'
  means, never stored (one derived figure, as the treasury's).
- **Attractiveness is a separate project (player).** It is multi-factor and has its own work, outside this one: the market price will read it when it exists, and nothing
  of it is designed or stubbed here (no placeholder figure, no default factor).
- Left to settle:
  and nothing else about a missing owner: the mayor's house always stands (nothing can be built without it, and it cannot be demolished), so the SCI always exists. If the
  lookup still finds no owner's house, that is a broken invariant: the sale throws an explicit error naming it (no fallback to the city), it is not a case to design.

## A "lego" placement step for big buildings made of several parts

Idea (not built): instead of placing a multi-mesh building (the nuclear plant, `geometry.parts`) in one click, the player places each
part with its own button, next to each other. The game checks the parts touch and fit the building's recipe, then qualifies the whole as
the building. A new placement step guides the player with ghost colours (the next part to place, valid and invalid spots), as the
placement ghost already does. The one-click multi-mesh plant works today and stays the default; this would be a second way to build it.
