import { describe, test, expect } from '@jest/globals';
import { World } from '../../../src/engine/ecs/World.js';
import { defineComponent } from '../../../src/engine/ecs/defineComponent.js';
import { SystemRunner } from '../../../src/engine/ecs/SystemRunner.js';

const Counter = defineComponent('Counter');

describe('SystemRunner', () => {
  test('exécute les systèmes dans l\'ordre d\'enregistrement', async () => {
    const world = new World();
    const entity = world.createEntity();
    world.add(entity, Counter, { value: 0 });

    const log = [];
    const runner = new SystemRunner()
      .register('increment', (w) => {
        const counter = w.get(entity, Counter);
        w.add(entity, Counter, { value: counter.value + 1 });
        log.push('increment');
      })
      .register('double', (w) => {
        const counter = w.get(entity, Counter);
        w.add(entity, Counter, { value: counter.value * 2 });
        log.push('double');
      });

    await runner.run(world);
    expect(log).toEqual(['increment', 'double']);
    expect(world.get(entity, Counter).value).toBe(2);
  });
});
