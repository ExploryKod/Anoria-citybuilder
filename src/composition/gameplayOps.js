export { RandomEventsSimulationService } from '../contexts/gameplay/application/services/RandomEventsSimulationService.js';

/**
 * ACL — Gameplay bounded context entry points.
 */
export {
  createGameplayContext,
  getOrCreateGameplayContext,
  resetGameplayContextForTests,
} from './createGameplayContext.js';
