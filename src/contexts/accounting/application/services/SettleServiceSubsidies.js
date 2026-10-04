import { buildServiceSubsidyBusinessKey } from '../../domain/policies/LedgerBusinessKeys.js';
import { serviceSubsidyShare } from '../../domain/policies/ServiceSubsidyPolicy.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';
import { getResourceCategoryPresentation } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

/**
 * Application service — settles one delivered month of services for the active hamlet. Per service, the city pays its
 * subsidy share as one journal expense (once per month and service: the business key refuses a second charge); the
 * billing of the service (units, price, subsidy, inhabitants' share) is written to the transactions.
 */
export class SettleServiceSubsidies {
  /**
   * @param {object} deps
   * @param {(turn: number) => { year: number, monthIndex: number, month?: string }} deps.getTimeInfo
   * @param {(year: number, monthIndex: number) => Promise<Record<string, number>>} deps.sumServiceDeliveries
   * @param {() => Promise<Record<string, number>>} deps.getServiceSubsidies percent per service, of the active hamlet
   * @param {(service: string) => number} deps.getServicePrice
   * @param {(params: { turn: number, type: string, amount: number, description: string, businessKey: string }) => Promise<{ recorded: boolean, reason?: string }>} deps.recordLedgerEntry
   * @param {(billing: object) => Promise<void>} deps.recordServiceBilling
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * @param {object} params
   * @param {number} params.time the turn the lines are dated by: the first turn after the delivered month
   * @param {number} params.deliveredTime a turn of the delivered month
   */
  async execute({ time, deliveredTime }) {
    const timeInfo = this.deps.getTimeInfo(deliveredTime);
    const hamletId = requireActiveHamletId();
    const subsidies = await this.deps.getServiceSubsidies();
    const deliveries = await this.deps.sumServiceDeliveries(timeInfo.year, timeInfo.monthIndex);
    const monthName = timeInfo.month || 'Mois';

    for (const service of Object.keys(deliveries)) {
      const units = deliveries[service];
      if (units === 0) continue;

      const subsidyPercent = subsidies[service];
      const unitPrice = this.deps.getServicePrice(service);
      const share = serviceSubsidyShare({ units, unitPrice, subsidyPercent });
      const label = getResourceCategoryPresentation(service).label;

      if (share.citySubsidy > 0) {
        const result = await this.deps.recordLedgerEntry({
          turn: time,
          type: 'service_subsidy',
          amount: share.citySubsidy,
          description: `Subvention ${label} - ${monthName} ${timeInfo.year} (${units} unités à ${unitPrice} €, ${subsidyPercent} %)`,
          businessKey: buildServiceSubsidyBusinessKey(service, timeInfo, hamletId),
        });
        // A month already settled is not charged again; any other refusal is a defect, not a skipped line.
        if (!result.recorded) {
          if (result.reason === 'duplicate_business_key') continue;
          throw new Error(`[subsidy] the ${label} subsidy of ${monthName} ${timeInfo.year} was not recorded: ${result.reason}`);
        }
      }

      await this.deps.recordServiceBilling({
        turn: time,
        year: timeInfo.year,
        monthIndex: timeInfo.monthIndex,
        service,
        units,
        unitPrice,
        subsidyPercent,
        ...share,
      });
    }
  }
}
