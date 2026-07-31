import { balanceSheetFromTreasuryAndAssets } from '../../../domain/policies/BalanceSheetMappingPolicy.js';
import { GetTreasurySnapshot } from '../treasury/GetTreasurySnapshot.js';

/**
 * Query: bilan (actif / passif) from treasury + city assets + loans.
 */
export class GetBalanceSheet {
  /**
   * @param {GetTreasurySnapshot} getTreasurySnapshot
   * @param {import('../../ports/CityAssetsValuationPort.js').CityAssetsValuationPort} cityAssetsValuationPort
   * @param {{ getActiveLoans: () => Promise<Array> }} treasuryLoanPortfolio
   */
  constructor(getTreasurySnapshot, cityAssetsValuationPort, treasuryLoanPortfolio) {
    this.getTreasurySnapshot = getTreasurySnapshot;
    this.cityAssetsValuationPort = cityAssetsValuationPort;
    this.treasuryLoanPortfolio = treasuryLoanPortfolio;
  }

  /** @returns {Promise<import('../../../domain/read-models/BalanceSheet.js').BalanceSheet>} */
  async execute() {
    const [treasurySnapshot, buildingValuation, activeLoans] = await Promise.all([
      this.getTreasurySnapshot.execute(),
      this.cityAssetsValuationPort.getCityBuildingValuation(),
      this.treasuryLoanPortfolio.getActiveLoans(),
    ]);

    return balanceSheetFromTreasuryAndAssets({
      treasurySnapshot,
      buildingValuation,
      activeLoans,
    });
  }
}
