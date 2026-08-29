import { TimeManager } from '../shared/time/TimeManager.js';
import { buildWorldMapView } from '../contexts/geography/application/queries/buildWorldMapView.js';
import {
  canTravelToHamlet,
} from '../core/persistence/hamlet/hamletAccess.js';
import {
  getActiveHamletId,
  setActiveHamletId,
} from '../core/persistence/hamlet/hamletSession.js';
import {
  createAccountingSessionApi,
  createCommerceSessionApi,
  createEmploymentSessionApi,
  createHousingSessionApi,
} from './sessionApi.js';

/**
 * @param {{
 *   commerce: object,
 *   housing: object,
 *   employment: object,
 *   accounting: object,
 *   cityAssets?: object | null,
 * }} deps
 */
export function createMapSessionApi({
  commerce,
  housing,
  employment,
  accounting,
  cityAssets = null,
}) {
  const commerceApi = createCommerceSessionApi(commerce);
  const housingApi = createHousingSessionApi(housing);
  const employmentApi = createEmploymentSessionApi(employment);
  const accountingApi = createAccountingSessionApi(accounting, cityAssets);

  async function buildActivationByPartnerId() {
    const partners = commerceApi.loadOrSeedCommercePartners();
    const activationByPartnerId = {};

    for (const partner of partners) {
      const [population, unemployment] = await Promise.all([
        housingApi.getCityTotalPopulation(),
        employmentApi.getCityEmploymentSummary().then((summary) => summary.unemploymentPercentage),
      ]);

      activationByPartnerId[partner.id] = commerceApi.evaluatePartnerActivationConditions({
        partner,
        activationConditions: partner.activationConditions,
        metrics: {
          population,
          unemployment,
          stocksCheck: { hasStocks: true, missingProducts: [] },
        },
      });
    }

    return activationByPartnerId;
  }

  return Object.freeze({
    async getWorldMapView() {
      const activationByPartnerId = await buildActivationByPartnerId();
      return buildWorldMapView({ commerceApi, activationByPartnerId });
    },

    async travelToHamlet(hamletId) {
      if (hamletId === getActiveHamletId()) {
        return { success: true, alreadyActive: true };
      }

      if (!(await canTravelToHamlet(hamletId))) {
        return { success: false, reason: 'locked' };
      }

      setActiveHamletId(hamletId);
      return { success: true, alreadyActive: false };
    },

    async activateTradePartner(partnerId) {
      const partners = commerceApi.loadOrSeedCommercePartners();
      const partner = partners.find((item) => item.id === partnerId);
      if (!partner) {
        return { success: false, message: 'Partenaire non trouvé' };
      }

      if (partner.isActive) {
        return { success: false, message: 'La route est déjà ouverte' };
      }

      const activationByPartnerId = await buildActivationByPartnerId();
      const activation = activationByPartnerId[partnerId];
      if (!activation?.canActivate) {
        return {
          success: false,
          message: `Conditions non remplies : ${(activation?.unmetConditions ?? []).join(', ')}`,
        };
      }

      const commercialRouteFee = accountingApi.getCommercialRouteFee();
      try {
        const currentBudget = await accountingApi.getTreasurySnapshot();
        const timeInfo = currentBudget?.turn !== undefined
          ? TimeManager.getTimeInfo(currentBudget.turn)
          : null;
        const yearDisplay = timeInfo && timeInfo.year === 0 ? '0 JC' : timeInfo ? `${timeInfo.year} ap JC` : '';
        const monthName = timeInfo ? timeInfo.month || 'Mois' : 'Mois';
        const dateDisplay = `${monthName} ${yearDisplay}`;
        const breakdown = [{
          label: partner.name,
          quantity: 1,
          unitCost: commercialRouteFee,
          total: commercialRouteFee,
        }];
        const description = `Route commerciale - ${dateDisplay} |BREAKDOWN|${JSON.stringify(breakdown)}|BREAKDOWN|`;

        const feeResult = await accountingApi.recordCommercialRouteFee(
          commercialRouteFee,
          description,
          partnerId
        );

        if (feeResult.skipped && feeResult.reason === 'duplicate_business_key') {
          partner.isActive = true;
          commerceApi.saveCommercePartners(partners);
          return {
            success: true,
            message: 'Route commerciale déjà payée — route réactivée.',
          };
        }
      } catch (error) {
        console.error('[mapSessionApi] activateTradePartner fee error:', error);
        return {
          success: false,
          message: 'Erreur lors du paiement de la route commerciale',
        };
      }

      partner.isActive = true;
      commerceApi.saveCommercePartners(partners);
      return {
        success: true,
        message: `Route ouverte avec ${partner.name} (${commercialRouteFee} €).`,
      };
    },
  });
}
