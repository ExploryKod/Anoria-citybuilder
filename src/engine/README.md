# Engine

Couche technique du jeu (generic subdomain). Équivalent du runtime Unity/Bevy.

## Responsabilités

- Gérer les entités (IDs) et les composants (données pures)
- Exécuter les systèmes dans un ordre défini (`SystemRunner`, `Pipeline`)
- Fournir une boucle de tick (`GameLoop`) — optionnelle ; Anoria utilise encore TimeManager + `game.update`

## Interdictions

- Aucune règle métier Anoria (routes, nourriture, emploi…)
- Aucun import depuis `contexts/`
- Aucun import Three.js, Dexie, DOM

## Structure

```text
engine/
  ecs/
    defineComponent.js
    World.js
    SystemRunner.js
  loop/
    Pipeline.js
    GameLoop.js
```

## Branchement jeu (refactor)

```text
composition/createGameRuntime.js
  → World + Pipeline
  → group('simulation').register('parcels.roadAccess', …)

contexts/parcels/infrastructure/runtime/parcelsRoadAccessSystem.js
  → délègue à parcels.recalculateAllRoadAccess

game.js → update()
  → await runtime.runSimulation({ city, time })
  → puis SimServices legacy (commerce, random events, …)
  → puis scene.update
```

Road access : pipeline ECS `parcels.roadAccess` via `createGameRuntime` / `game.update()` (ex-`RoadConnectivityService`, supprimé).

## Usage minimal

```js
import { World, defineComponent } from './ecs/World.js';
import { Pipeline } from './loop/Pipeline.js';

const Position = defineComponent('Position');
const world = new World();

const entity = world.createEntity();
world.add(entity, Position, { x: 0, y: 0 });

const pipeline = new Pipeline();
pipeline.group('simulation').register('move', (w) => {
  for (const { id } of w.query(Position)) {
    const pos = w.get(id, Position);
    w.add(id, Position, { x: pos.x + 1, y: pos.y });
  }
});

await pipeline.runGroup('simulation', world);
```

## Ce qui branche l'engine

- `composition/createGameRuntime.js` — DI runtime
- `contexts/parcels/infrastructure/runtime/` — systèmes minces ECS (appellent le BC Parcels)
- `GameLoop` — disponible pour remplacer TimeManager plus tard (hors scope immédiat)
