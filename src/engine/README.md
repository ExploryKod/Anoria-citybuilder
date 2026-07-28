# Engine

Couche technique du jeu (generic subdomain). Équivalent du runtime Unity/Bevy.

## Responsabilités

- Gérer les entités (IDs) et les composants (données pures)
- Exécuter les systèmes dans un ordre défini (`SystemRunner`, `Pipeline`)
- Fournir une boucle de tick (`GameLoop`)

## Interdictions

- Aucune règle métier Anoria (routes, nourriture, emploi…)
- Aucun import depuis `contexts/`
- Aucun import Three.js, Dexie, DOM

## Structure

```text
engine/
  ecs/
    defineComponent.js   # typage des composants
    World.js             # entités + query
    SystemRunner.js      # exécution ordonnée de systèmes
  loop/
    Pipeline.js          # groupes de systèmes (sim, render…)
    GameLoop.js          # setInterval / rAF
```

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

- `infrastructure/runtime/*/systems/` — systèmes minces métier
- `composition/` — câblage DI
