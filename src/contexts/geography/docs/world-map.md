# World map — renderer-independent architecture

Status: **design, nothing built yet.** Decided with the project's owner: the map stays 2D, keeps its look (the Kenney hexagons), and is first drawn
on a **Canvas** by an adapter; Phaser (or Pixi, SVG, Three.js) can come back later as another adapter. The game's rules never depend on a renderer.

## 1. Principles

- **The business speaks in hexagons, not in pixels.** A tile (axial coordinates), a terrain kind, a place (hamlet, city) and its state, a marker (a thing
  the game puts on the map). No colour, no picture, no frame name, no zoom, no pointer coordinates.
- **The map is a reading, never a store.** What is on the map (a marker, a state) is derived from the game's own facts (journal, hamlets, relations,
  news, events) and can be rebuilt from them at load; events then update it. Nothing is saved only for the map.
- **Appearance is data.** What a marker kind looks like in each state (picture, tint, label style, animation) is one catalog of the presentation, not
  code in a renderer. Changing the look never touches the game's rules or the adapters.
- **The player acts on the world from the map.** Picking a place, a route or an event opens what can be done there. The renderer only says *what was
  picked*; what a pick means, and what the player may do, is data and application code, never the renderer's.
- **Visual time is not game time.** An animation runs on the screen's own clock. The turn stays the one game clock; an animation reads nothing from it.

## 2. What is coupled today

- `resolveKenneyPhaserFrame` (an atlas and a frame name for Phaser) lives in a **domain** catalog, `domain/catalogs/HexAssetCatalog.js`: the business knows
  a picture.
- `presentation/phaser/world/WorldHexScene.js` decides what a state *means* (green tint for the active hamlet, a padlock and 0.82 opacity for a locked
  one, 1.1 scale for the selected one): that is data, written as code in a scene.
- `dom/maps/WorldMapController.js` imports the Phaser bootstrap directly, and the scene gets its data through a hidden global
  (`setPendingWorldBootstrap` / `consumePendingWorldBootstrap`).
- Already healthy: the hex maths (`shared/geography/hexCoordinates.js`), the map definition (`domain/world/worldMapDefinition.js`), and the two
  callbacks (`onCitySelected`, `onHamletSelected`) that are the scene's only way out.

## 3. Target

```
game state, game events ─► map projection ─► [ port: WorldMapRenderer ] ─► adapter (Canvas, then others)
   (read-only facts)         (pure, testable)     (speaks in hexagons)         (speaks in pixels and pictures)
```

### 3.1 The scene description (the business's output)

A neutral, serialisable description of what is on the map: the tiles (hex + terrain kind), the places (id, hex, kind, state, label), the markers
(`{ id, anchor, kind, state, label? }`), the selection. An **anchor** is one of four: a **place** (a hamlet or a city), a **hex**, a **route** (a
connection between two places, which the world already has) or an **area** (a set of hexes: a border, a sea). The place-to-hex resolution is the
business's (the hamlet and city hex catalogs already say it); a route is drawn over the hexes between its two places.

### 3.2 The port `WorldMapRenderer` (owned by the geography application layer, in map words)

Mount and dispose; set the terrain; upsert and remove a marker; set a marker's state; set the selection; focus a hex. Back out, as domain events:
a hex, a place or a marker was **picked** or **hovered** — never a pixel. One more query for the labels (3.5): where on the screen an anchor is now.

### 3.3 The adapters (presentation)

Own everything visual: the camera (pan, zoom, pinch, clamp, pixel ratio), pixel-to-hex (the shared hex maths), hit-testing (a marker by distance, with
the hit size its kind declares: 40 px at least), drawing, animations, loading the atlas. The **Canvas adapter** redraws only when the camera moves or
an animation is running (the idle map costs no battery); the terrain is drawn once into an off-screen canvas and moved with the camera.

### 3.4 The appearance catalog (presentation)

For each terrain kind, place kind and marker kind, and each state: which picture (the Kenney atlas reference lives here, not in the domain), tint, scale,
label style, hit size, animation. Three families of things are drawn: **markers** (an icon at a place or a hex), **route styles** (a connection drawn open,
cut, hostile) and **area tints** (a set of hexes lit: a border, a sea). Animations are described, not coded, in a small vocabulary every adapter interprets with its own means:
**static**, **frames** (an animated icon: frames and fps), **pulse**, **float**, and later **path** (a marker moving along hexes from one place to another,
for convoys). A kind with no entry is an error naming it, never a default picture.

### 3.5 Labels and text: DOM over the canvas

Text is DOM, laid over the canvas, so it is crisp, translatable and readable by assistive technology. The adapter tells the DOM layer where each anchor
is on the screen (`anchor → { x, y }`) and when the view changed (camera moved, zoomed, resized); the layer moves its labels with `transform` in one
animation frame. Labels are not interactive unless they are focusable; their size does not scale with the zoom; below a zoom threshold only the
selected place's label shows. The DOM panel beside the map stays the accessible twin of the map.

### 3.6 Mobile

Pan, pinch and inertia are the adapter's; `touch-action` is off on the canvas, the page's own scroll is not captured outside it. The panels stay DOM and
follow the site's responsive rules. A marker's touch target is 40 px at least, whatever its picture.

### 3.7 What shows on the map: world events

The map shows the **world**: the places, the routes between them, and what happens out there. A hamlet's own facts (a famine in it, the rent it owes,
a disaster that strikes it, the dépêches about it) stay on the hamlet's own screens: they are not map events.

A **world event** is one entry of a catalog (section 4): its kind, what it is **anchored to**, **how long** it lasts, how it **looks**, and what it
**does** on the game's existing mechanisms. The projection reads the events that hold and puts their markers, route styles and area tints on the
scene; it removes them when they end. An event's lifetime belongs to the projection, not to the renderer. Adding an event to the map is one entry in
the world-event catalog and one in the appearance catalog; no renderer code.

### 3.8 Interaction: from a pick to an action

```
pick (renderer) ─► selection (scene) ─► panel (DOM) ─► action (catalog) ─► command (application) ─► facts change ─► projection ─► scene
```

- **The renderer picks and hovers, nothing more.** It reports the identity of what was picked (a place, a route, an area, a marker, or a bare hex). A touch
  is a tap: it selects. Nothing depends on hover (a phone has none); hover only adds a highlight where there is a pointer.
- **A selection drives a DOM panel**, the one the page has beside the map (on a phone, a sheet over the bottom, following the site's responsive rules).
  Every action is reachable there with a keyboard or a screen reader: the canvas holds no function that the panel does not.
- **Actions are data.** One catalog says, for each kind of place, event and state, which actions the player has: their id, their words (from the catalogs,
  as the project's vocabulary rule asks), the test that makes them available, what they cost, and the application command each one runs. A kind with no
  entry is not interactive **by an explicit empty list**, never by default. The exchange window ("Échanges") already is the first action of a trade city.
- **An action is a command of an application service**, never code of the map. When it moves value (goods leaving a warehouse, money paid), it goes through
  the journal like every other movement: the map moves nothing itself. `giftsSent` (a trade requirement) is read from the journal's lines, never counted
  on the side.
- **The map shows the answer by reading again.** The command changes the game's facts; the projection reads them and updates the scene (the appeal turns
  into "aid sent", then goes). The renderer is never told "draw the result".
- **A consequential action asks first**, showing what leaves the stock and what it costs, in the catalog's words.
- **What the map does not do today**: change hamlet (that stays in the game's carousel). Whether it may is an open question below.

## 4. World events (to settle with the owner)

### 4.1 What the world already has to rest on

- **Seven cities with a hex site and a category**: near, far, neutral, owned by Anoria (the port, Maris), and an **enemy** (Vexlor), around the capital
  (`WorldCityCatalog.js`, `WorldCityHexCatalog.js`).
- **A graph of connections** between them, each `inter-city` or `hostile`: the routes already exist.
- **Trade terms per city** (`TradeCatalog.js`): a relation with a satisfaction score and thresholds, an order rhythm, a transport mode with a distance
  multiplier, a sale range that "events and the relation move" (`saleBias`), and opening requirements that already name **`giftsSent`** and
  **`noWarWith`**: gifts and wars are foreseen.
- **Declared reasons for a trade to cease**, with who ceases and the scope (`TradeCeasePolicy.js`).
- **Dépêches from city sources** (caravan; spy and diplomat planned) with categories that fit world news: trade rumour, partner news, foreign market.
  Today a caravan dépêche names no city.

### 4.2 The new concept: a world event, declared as data

A kind, an **anchor** (a place, a route or an area), a duration, its look (a marker, a route style, an area tint), its **effects on hooks that exist**
(a cease reason, a satisfaction factor, the sale bias, the transport multiplier, an opening requirement), and the **dépêche that announces it**, naming its
place or route: that is what gives a caravan dépêche its city. The catalog belongs to geography (it owns the world and its trade); the scheduling to
gameplay's random events, or a script for a scenario. The map only shows; the effects happen in the game's own contexts.

### 4.3 Candidates

| Event | Anchor | On the map | Effects on what exists | Dépêche |
|---|---|---|---|---|
| A city asks for help (famine, epidemic) | the city | appeal icon, pulsing, the good wanted | sending goods is a **gift**: `giftsSent`, a satisfaction factor | partner news |
| A storm cuts a trade route | the route | route drawn cut, storm icon | the trade cycle skips that city (a cease reason by "the world"), or the transport multiplier rises | trade rumour |
| Armies massed at a border | the area between a city and its neighbour | area tinted, banners | satisfaction falls, the sale bias rises; `noWarWith` can close the relation | foreign market |
| A terrorist attack | a city, or the owned port (Maris) | alert, smoke | that city's relation shaken; for the port, the trade through it | partner news |
| An embargo or blockade | a route, or a city | route drawn closed | the relation ceases, with a declared reason | foreign market |
| Pirates at sea | the route to the port | alert on the route | the transport multiplier rises, deliveries may fail | trade rumour |
| A bumper harvest or a festival | a city | positive icon | the sale bias falls for the goods it concerns | trade rumour |
| A diplomatic visit | a city | banner | satisfaction rises | partner news |

### 4.4 What the player could answer (candidates)

Decided: **answering raises the city's satisfaction; doing nothing lowers it**, review after review while the event holds; a satisfaction too low makes the
city **cease the relation** (the existing reason `satisfaction_too_low`, `TradeCeasePolicy.js`). How: the satisfaction of a relation is the sum of the
factors its catalog entry declares, and `SATISFACTION_FACTORS` (`TradeSatisfactionPolicy.js`) is open to extension, one pure function per factor. Two
new factors, read from the world events that concern the city, carry this: points for the events the player answered, a loss for each event left
unanswered at the review. The world-event catalog declares the points; no rule is coded in the map. The review's context gains those two facts, derived
from the events and the journal, never stored on the side.

| Event | Answers offered from the map |
|---|---|
| A city asks for help | send food aid (the goods and the quantity, with what it costs), decline, read the dépêche |
| A storm cuts a route | read the dépêche, wait, pay to have the route reopened |
| Armies massed at a border | send an envoy, send a gift to calm them, ignore, read the dépêche |
| A terrorist attack on the port | send help, reinforce the port (a cost), read the dépêche |
| A trade city, outside any event | open the exchanges (exists), read its latest dépêche |

Every answer is a command of an application service (3.8); the amounts and effects are the game design's to set.

### 4.5 How a gift is booked

Decided: a gift is booked **as the real city would book a diplomatic gift to another public entity**: a charge of the city on the M57 account for gifts and
ceremonies (**6232, « Fêtes et cérémonies »**, which takes the gifts a public body offers; to confirm against the M57 chart in `PcgJournalCatalog.js`
when the line is written).

- A gift **in goods** leaves a warehouse: the goods go out at their cost (the stock's `PriceBook` value) against the charge, so it reaches the compte de
  résultat and the balance sheet, and moves **no cash**. A gift **in money** (an envoy's fee) moves cash against the same charge.
- It is **one entry of `PcgJournalCatalog`** (a type of écriture with its legs named by the writer, as the journal requires), and the city's ledger needs
  **a line of its own for it** if cash moves: an account the city books against that no line takes throws (`CityLedgerLineMappingPolicy.js`).
- The count `giftsSent` that a trade city can require is read from these lines of the journal, never kept as a counter.

Not on the map: the tutorial's current goal (it points at a button of the interface, not at a place of the world).

A suggested first lot, **one of each anchor**, which exercises the whole vocabulary: **a city asks for help** (a place), **a storm cuts a route** (a
route), **armies massed at a border** (an area). Static at first; animated once the Canvas adapter draws them.

## 5. Tests

Few, as the project asks. A **recording fake adapter** (it keeps the commands it receives) tests the projection without any DOM: an event creates then
removes its marker; a marker anchored to a place lands on that place's hex; the scene is rebuilt identically from the game's facts. A **contract
scenario** runs against every adapter that exists (same scene in, same markers and picks out), so a new adapter is validated by the same cases. A drawing
is checked by eye, against the Phaser version while it remains.

## 6. Order of work

1. Write the **port**, the scene description and the two catalogs; move the pictures out of the domain catalog.
2. Put the **current Phaser scene behind the port** as adapter n°1, unchanged in look: it validates the port and is the visual reference.
3. Write the **Canvas adapter** and the DOM label layer; compare with the Phaser version until the look matches.
4. Remove Phaser from the build (its code stays in git history; it can come back as an adapter).
5. Add the **world-event catalog** and the first lot (section 4.3), each with its dépêche and its effects on the existing mechanisms.

## 7. Open questions

- The events to keep, drop or add (4.3), and the first lot.
- Which effects a world event may have, and which answers the player has (4.4): a gift (food aid), a refusal, a wait, a payment.
- The exact legs of a gift in goods and in money, and the name of the ledger line (4.5), to write with the accounting context before the first action
  that moves value.
- The points of the two new satisfaction factors (answered, ignored) and the length of an event, per event kind (4.4): the game design's to set.
- **Left pending by the owner:** whether the map may also change hamlet (today only the game's carousel does). Not designed until decided.
- A route between two places: a straight line between hexes, or a path over land tiles only (and over sea for the port).
- The area of a border: how it is declared (a list of hexes, or "the hexes between two places").
