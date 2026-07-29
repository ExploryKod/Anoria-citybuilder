import { World } from '../engine/ecs/World.js';
import { Pipeline } from '../engine/loop/Pipeline.js';
import { createParcelsRoadAccessSystem } from '../contexts/parcels/infrastructure/runtime/parcelsRoadAccessSystem.js';

/**
 * Composition root du runtime ECS (engine + systèmes minces).
 * Les BC restent owners métier ; le pipeline orchestre quand ils tournent.
 *
 * @param {object} deps
 * @param {ReturnType<import('./createParcelsContext.js').createParcelsContext>} deps.parcels
 */
export function createGameRuntime({ parcels }) {
  if (!parcels) {
    throw new Error('createGameRuntime: parcels context required');
  }

  const world = new World();
  const pipeline = new Pipeline();

  pipeline
    .group('simulation')
    .register('parcels.roadAccess', createParcelsRoadAccessSystem(parcels));

  return {
    world,
    pipeline,

    /**
     * Un tick de simulation ECS (groupe `simulation`).
     * @param {{ city?: object, housesStore?: object, time?: number }} [context]
     */
    async runSimulation(context = {}) {
      await pipeline.runGroup('simulation', world, context);
    },
  };
}
