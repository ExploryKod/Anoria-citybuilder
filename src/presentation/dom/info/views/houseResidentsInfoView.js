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
 * One citizen's card: who he is, where he works (or his status when he works for no one), the facts about him (see factsOf) and the
 * breakdown of his health, the environment as he lives it.
 * @param {object} resident
 * @param {object} environment see describeCitizenEnvironment
 * @returns {HTMLElement}
 */
function residentCard(resident, environment) {
  const card = document.createElement('div');
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

  const health = document.createElement('div');
  health.className = 'house-resident-card__health';
  health.append(renderHealthHistogram(environment, 0));

  card.append(name, place, facts, health);
  return card;
}

/**
 * The Habitants tab of a house: a bar of pills, the house first (named by the catalog) then one pill per citizen. The house pill shows
 * the house's health environment (its histogram); a citizen's pill shows his card alone. The two are never on screen together. The names and
 * the workplaces come from the catalogs; the citizens are read from the buildings (see getHouseResidents).
 * @param {HTMLElement} container
 * @param {{ accounting: { getHouseResidents: (houseId: string) => Promise<Array<object>> }, buildingId: string, buildingType: string, health: object | null } | null} model
 */
export async function renderHouseResidentsTab(container, model) {
  container.replaceChildren();
  if (!model) return;
  if (!model.health) {
    const message = document.createElement('p');
    message.textContent = 'La santé de cette maison n\'est pas disponible.';
    container.append(message);
    return;
  }
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

  // The views, in the order of the pills: the house first, then each citizen in his stable order.
  const views = [
    { key: 'house', label: buildingName(model.buildingType), draw: () => renderHealthHistogram(model.health.environment, model.health.sick) },
    ...residents.map((resident) => ({
      key: resident.id,
      label: resident.firstName,
      draw: () => {
        const environment = model.health.citizenEnvironments[resident.id];
        if (!environment) throw new Error(`[HouseResidentsTab] no health environment for the citizen ${resident.id}`);
        return residentCard(resident, environment);
      },
    })),
  ];

  const bar = document.createElement('div');
  bar.className = 'building-finance-pills house-residents-pills';
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', 'Maison et habitants');
  const body = document.createElement('div');
  body.className = 'house-residents-body';

  const buttons = views.map((view) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'building-finance-pill-tab';
    button.textContent = view.label;
    button.addEventListener('click', () => select(view.key));
    bar.append(button);
    return button;
  });

  function select(key) {
    views.forEach((view, index) => {
      const open = view.key === key;
      buttons[index].classList.toggle('is-active', open);
      buttons[index].setAttribute('aria-pressed', String(open));
    });
    body.replaceChildren(views.find((view) => view.key === key).draw());
  }

  container.append(bar, body);
  select('house');
}
