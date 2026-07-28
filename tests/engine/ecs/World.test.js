import { describe, test, expect, beforeEach } from '@jest/globals';
import { World, defineComponent, SINGLETON_ENTITY_ID } from '../../../src/engine/ecs/World.js';

const Position = defineComponent('Position');
const Velocity = defineComponent('Velocity');
const Time = defineComponent('Time');

describe('World', () => {
  let world;

  beforeEach(() => {
    world = new World();
  });

  test('createEntity retourne des IDs uniques', () => {
    const a = world.createEntity();
    const b = world.createEntity();
    expect(a).not.toBe(b);
    expect(world.getEntityCount()).toBe(2);
  });

  test('add / get composant', () => {
    const entity = world.createEntity();
    world.add(entity, Position, { x: 3, y: 7 });
    expect(world.get(entity, Position)).toEqual({ x: 3, y: 7 });
  });

  test('has détecte la présence d\'un composant', () => {
    const entity = world.createEntity();
    expect(world.has(entity, Position)).toBe(false);
    world.add(entity, Position, { x: 1, y: 1 });
    expect(world.has(entity, Position)).toBe(true);
  });

  test('query retourne les entités ayant tous les composants demandés', () => {
    const moving = world.createEntity();
    world.add(moving, Position, { x: 0, y: 0 });
    world.add(moving, Velocity, { dx: 1, dy: 0 });

    const staticEntity = world.createEntity();
    world.add(staticEntity, Position, { x: 5, y: 5 });

    const results = world.query(Position, Velocity);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(moving);
    expect(results[0].components[1]).toEqual({ dx: 1, dy: 0 });
  });

  test('remove supprime tous les composants', () => {
    const entity = world.createEntity();
    world.add(entity, Position, { x: 1, y: 1 });
    world.remove(entity);
    expect(world.getEntityCount()).toBe(0);
    expect(world.query(Position)).toHaveLength(0);
  });

  test('singleton via entity ID 0', () => {
    world.setSingleton(Time, { turn: 42 });
    expect(world.getSingleton(Time)).toEqual({ turn: 42 });
    expect(world.get(SINGLETON_ENTITY_ID, Time)).toEqual({ turn: 42 });
  });

  test('add sur entité inconnue lève une erreur', () => {
    expect(() => world.add(999, Position, { x: 0, y: 0 })).toThrow();
  });
});
