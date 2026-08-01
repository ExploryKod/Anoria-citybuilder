import { getOrCreateCityAssetsContext } from '../../../../../composition/createCityAssetsContext.js';
import { CityAssetsValuationPort } from '../../../application/ports/CityAssetsValuationPort.js';

/**
 * Cross-context adapter — city built-asset valuation.
 */
export class CityAssetsValuationAdapter extends CityAssetsValuationPort {
  /** @inheritdoc */
  async getCityBuildingValuation() {
    return getOrCreateCityAssetsContext().getCityBuildingValuation();
  }
}
