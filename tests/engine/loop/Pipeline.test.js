import { describe, test, expect } from '@jest/globals';
import { World } from '../../../src/engine/ecs/World.js';
import { defineComponent } from '../../../src/engine/ecs/defineComponent.js';
import { Pipeline } from '../../../src/engine/loop/Pipeline.js';

const Flag = defineComponent('Flag');

describe('Pipeline', () => {
  test('exécute les groupes dans l\'ordre de création', async () => {
    const world = new World();
    const entity = world.createEntity();
    world.add(entity, Flag, { step: 0 });

    const log = [];
    const pipeline = new Pipeline();

    pipeline.group('simulation').register('sim', (w) => {
      w.add(entity, Flag, { step: 1 });
      log.push('sim');
    });

    pipeline.group('render').register('render', (w) => {
      w.add(entity, Flag, { step: w.get(entity, Flag).step + 1 });
      log.push('render');
    });

    await pipeline.runAll(world);
    expect(log).toEqual(['sim', 'render']);
    expect(world.get(entity, Flag).step).toBe(2);
  });

  test('runGroup exécute un seul groupe', async () => {
    const world = new World();
    const pipeline = new Pipeline();
    const log = [];

    pipeline.group('a').register('a', () => log.push('a'));
    pipeline.group('b').register('b', () => log.push('b'));

    await pipeline.runGroup('a', world);
    expect(log).toEqual(['a']);
  });

  test('runGroup lève une erreur pour un groupe inconnu', async () => {
    const pipeline = new Pipeline();
    await expect(pipeline.runGroup('missing', new World())).rejects.toThrow();
  });
});
