import { buildingName } from '../../shell/CatalogVocabulary.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { HEALTH_LABELS, HEALTH_SICK_BELOW } from '../../../../shared/population/HealthFactorCatalog.js';
import { HEALTH_MAX } from '../../../../shared/population/CitizenCatalog.js';
import { renderHealthHistogram } from './healthHistogramView.js';

const STATUS_LABELS = Object.freeze({ unemployed: 'Chômeur', administrator: 'Administrateur' });

/** What the money a citizen received this month is called, by his status (accounting wording, hand-written on purpose). */
const PAY_LABELS = Object.freeze({ worker: 'Salaire reçu', unemployed: 'Allocation chômage reçue', administrator: 'Indemnité reçue' });

/**
 * The facts a citizen's card shows, one row each: a label and a value. A new fact about the citizen is one more entry here
 * (the card, its grid and its mobile layout need no change).
 * @param {object} resident
 * @returns {Array<{ label: string, value: string }>}
 */
function factsOf(resident) {
  const payLabel = PAY_LABELS[resident.status];
  if (!payLabel) throw new Error(`[HouseResidentsTab] no pay label for the status "${resident.status}"`);
  return [
    { label: HEALTH_LABELS.score, value: `${Math.round(resident.health)} / ${HEALTH_MAX}${resident.health < HEALTH_SICK_BELOW ? ` · ${HEALTH_LABELS.sick}` : ''}` },
    { label: payLabel, value: resident.settled ? formatEuro(resident.amount) : 'Pas encore réglé' },
  ];
}

/**
 * The Habitants tab of a house: one card per citizen, in a grid that fills the width (one column on a phone). A card says who
 * he is, where he works (or his status when he works for no one: a civil servant of the city, or unemployed) and the facts
 * about him (see factsOf). The names and the workplaces come from the catalogs; the citizens are read from the buildings
 * (see getHouseResidents).
 * @param {HTMLElement} container
 * @param {{ accounting: { getHouseResidents: (houseId: string) => Promise<Array<object>> }, buildingId: string } | null} model
 */
export async function renderHouseResidentsTab(container, model) {
  container.replaceChildren();
  if (!model) return;
  let residents;
  try {
    residents = await model.accounting.getHouseResidents(model.buildingId);
  } catch (error) {
    console.error('[HouseResidentsTab] getHouseResidents failed:', error);
    const message = document.createElement('p');
    message.textContent = 'Les habitants de cette maison ne sont pas disponibles.';
    container.append(message);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'house-residents-list';
  list.setAttribute('aria-label', 'Habitants de la maison');
  for (const resident of residents) {
    const card = document.createElement('li');
    card.className = `house-resident-card house-resident-card--${resident.status}`;

    const name = document.createElement('h4');
    name.className = 'house-resident-card__name';
    name.textContent = resident.firstName;

    const place = document.createElement('p');
    place.className = 'house-resident-card__place';
    place.textContent = resident.status === 'worker' ? `Travaille à ${buildingName(resident.workplaceType)}` : STATUS_LABELS[resident.status];

    const facts = document.createElement('dl');
    facts.className = 'house-resident-card__facts';
    for (const { label, value } of factsOf(resident)) {
      const row = document.createElement('div');
      const term = document.createElement('dt');
      term.textContent = label;
      const detail = document.createElement('dd');
      detail.textContent = value;
      row.append(term, detail);
      facts.append(row);
    }

    card.append(name, place, facts);
    list.append(card);
  }
  if (model.health) container.append(renderHealthHistogram(model.health.environment, model.health.sick));
  container.append(list);
}
