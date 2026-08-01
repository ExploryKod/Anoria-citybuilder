import {
  CommerceSimulationService,
  getOrCreateCommerceContext,
} from '../../acl/commerce.js';

export { CommerceSimulationService };

/** Legacy game service — delegates to Commerce BC simulation. */
export class CommerceService extends CommerceSimulationService {
  constructor(overrides = null) {
    const ctx = getOrCreateCommerceContext();
    super(overrides ?? ctx.simulationDeps);
  }
}
