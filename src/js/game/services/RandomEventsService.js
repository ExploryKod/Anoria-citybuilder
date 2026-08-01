import {
  RandomEventsSimulationService,
  getOrCreateGameplayContext,
} from '../../acl/gameplay.js';
import { SimService } from './SimService.js';

export { RandomEventsSimulationService };

/** Legacy game service — delegates to Gameplay BC simulation. */
export class RandomEventsService extends RandomEventsSimulationService {
  constructor(overrides = null) {
    const ctx = getOrCreateGameplayContext();
    super(overrides ?? ctx.simulationDeps);
  }
}
