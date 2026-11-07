import { buildingName } from '../../shell/CatalogVocabulary.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';
import { HEALTH_LABELS, HEALTH_SICK_BELOW } from '../../../../shared/population/HealthFactorCatalog.js';
import { HEALTH_MAX } from '../../../../shared/population/CitizenCatalog.js';
import { renderHealthHistogram } from './healthHistogramView.js';

const STATUS_LABELS = Object.freeze({ unemployed: 'Chômeur', administrator: 'Administrateur' });

/** What the money a citizen received this month is called, by his status (accounting wording, hand-written on purpose). */
const PAY_LABELS = Object.freeze({ worker: 'Salaire reçu', unemployed: 'Allocation chômage reçue', administrator: 'Indemnité reçue' });

/** The label of the way back from a sheet to the cards. */
const BACK_LABEL = 'Retour aux habitants';

const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const roundedScore = (health) => `${Math.round(health)} / ${HEALTH_MAX}`;

/** What a score has made of a citizen, as a suffix of it: invalid (he does not work), else sick, else nothing. The invalidity is his, not a score's, so it is said once, on the body's. */
const stateOf = (resident) => (resident.invalid ? ` · ${HEALTH_LABELS.invalid}` : resident.health < HEALTH_SICK_BELOW ? ` · ${HEALTH_LABELS.sick}` : '');
const mentalStateOf = (resident) => (resident.mentalHealth < HEALTH_SICK_BELOW ? ` · ${HEALTH_LABELS.sick}` : '');

/** Whether either score of a citizen is under the sick threshold, or he is invalid. */
const isUnwell = (resident) => resident.invalid || resident.health < HEALTH_SICK_BELOW || resident.mentalHealth < HEALTH_SICK_BELOW;

/**
 * The facts a citizen's sheet shows, one row each: a label and a value. A new fact about the citizen is one more entry here
 * (the sheet, its grid and its mobile layout need no change).
 * @param {object} resident
 * @returns {Array<{ label: string, value: string }>}
 */
function factsOf(resident, outsideHealth) {
  const payLabel = PAY_LABELS[resident.status];
  if (!payLabel) throw new Error(`[HouseResidentsTab] no pay label for the status "${resident.status}"`);
  const pay = { label: payLabel, value: resident.settled ? formatEuro(resident.amount) : 'Pas encore réglé' };
  // A citizen outside health (the administrators') has no score to show: only what he is paid.
  if (outsideHealth) return [pay];
  return [
    { label: HEALTH_LABELS.score, value: `${roundedScore(resident.health)}${stateOf(resident)}` },
    { label: HEALTH_LABELS.mentalScore, value: `${roundedScore(resident.mentalHealth)}${mentalStateOf(resident)}` },
    pay,
  ];
}

/** Where a citizen works, or what he is when he works for no one: short, for a small card. */
function placeOf(resident) {
  return resident.status === 'worker' ? buildingName(resident.workplaceType) : STATUS_LABELS[resident.status];
}

/** A row of label and value, for the facts of a sheet. */
function factRow(label, value) {
  const row = element('div');
  row.append(element('dt', null, label), element('dd', null, value));
  return row;
}

/** A thin bar of a health score on the scale, red when the citizen is sick. */
function healthMeter(health) {
  const meter = element('span', `house-card__meter${health < HEALTH_SICK_BELOW ? ' is-sick' : ''}`);
  const fill = element('span', 'house-card__meter-fill');
  fill.style.width = `${Math.max(0, Math.min(100, (health / HEALTH_MAX) * 100))}%`;
  meter.append(fill);
  return meter;
}

/**
 * One small card, a button as a whole (the card is the target of a finger): a title, a line under it, and a score with its meter. The `detail` it opens is drawn on demand.
 * @param {object} card
 * @param {string} card.title
 * @param {string} card.line
 * @param {string} card.score what the card shows as its figure
 * @param {number | null} card.health for the meter (null: the house has nobody to measure)
 * @param {boolean} card.sick whether to flag it
 * @param {string} card.className
 * @returns {HTMLButtonElement}
 */
function cardButton({ title, line, score, health, sick, className }) {
  const button = element('button', `house-card ${className}${sick ? ' is-sick' : ''}`);
  button.type = 'button';
  button.setAttribute('aria-label', `${title}, ${line}, ${score}`);
  const head = element('span', 'house-card__title', title);
  const sub = element('span', 'house-card__line', line);
  const figure = element('span', 'house-card__score', score);
  button.append(head, sub, figure);
  if (health !== null) button.append(healthMeter(health));
  return button;
}

/** The two scores on one line, for a small card: the body's then the mind's (the short forms are the catalog's). */
const scoresLine = (body, mind) => `${HEALTH_LABELS.score} ${Math.round(body)} · ${HEALTH_LABELS.mentalShort} ${Math.round(mind)}`;

/** The sheet of one citizen: who he is, where he works, the facts about him (see factsOf) and the breakdown of his health, of the body and of the mind, the environments as he lives them. */
function residentSheet(resident, environment, mentalEnvironment, outsideHealth) {
  const sheet = element('div', `house-resident-card house-resident-card--${resident.status}`);
  const facts = element('dl', 'house-resident-card__facts');
  for (const { label, value } of factsOf(resident, outsideHealth)) facts.append(factRow(label, value));
  const health = element('div', 'house-resident-card__health');
  // Outside health, there is no environment to draw: the sheet says why instead.
  if (outsideHealth) health.append(element('p', 'house-resident-card__note', HEALTH_LABELS.outsideNote));
  else health.append(renderHealthHistogram(environment, 0, HEALTH_LABELS.environment), renderHealthHistogram(mentalEnvironment, 0, HEALTH_LABELS.mentalEnvironment));
  sheet.append(
    element('h4', 'house-resident-card__name', resident.firstName),
    element('p', 'house-resident-card__place', resident.status === 'worker' ? `Travaille à ${buildingName(resident.workplaceType)}` : STATUS_LABELS[resident.status]),
    facts,
    health,
  );
  return sheet;
}

/** The sheet of the house: its inhabitants' health on average, of the body and of the mind, how many are sick, and the environments they share (their histograms). */
function houseSheet(model) {
  const { health } = model;
  const sheet = element('div', 'house-resident-card house-resident-card--house');
  if (health.outsideHealth) {
    const note = element('div', 'house-resident-card__health');
    note.append(element('p', 'house-resident-card__note', HEALTH_LABELS.outsideNote));
    sheet.append(element('h4', 'house-resident-card__name', buildingName(model.buildingType)), note);
    return sheet;
  }
  const facts = element('dl', 'house-resident-card__facts');
  facts.append(
    factRow(HEALTH_LABELS.citizens, String(health.citizens)),
    factRow(HEALTH_LABELS.average, health.average === null ? '—' : roundedScore(health.average)),
    factRow(HEALTH_LABELS.mentalAverage, health.mentalAverage === null ? '—' : roundedScore(health.mentalAverage)),
    factRow(HEALTH_LABELS.sickCount, String(health.sick)),
  );
  const histogram = element('div', 'house-resident-card__health');
  histogram.append(
    renderHealthHistogram(health.environment, health.sick, HEALTH_LABELS.environment),
    renderHealthHistogram(health.mentalEnvironment, 0, HEALTH_LABELS.mentalEnvironment),
  );
  sheet.append(element('h4', 'house-resident-card__name', buildingName(model.buildingType)), facts, histogram);
  return sheet;
}

/**
 * The Habitants tab of a house: small cards in a grid that wraps to the width (the house first, named by the catalog, then one per citizen in his stable order). A card is
 * a button: pressing it opens the sheet of the house or of the citizen, with the way back to the cards; the two are never on screen together. Names and workplaces come from
 * the catalogs; the citizens are read from the buildings (see getHouseResidents). Phone first: two cards to a row on a narrow screen, more as it widens, no sideways scroll.
 * @param {HTMLElement} container
 * @param {{ accounting: { getHouseResidents: (houseId: string) => Promise<Array<object>> }, buildingId: string, buildingType: string, health: object | null } | null} model
 */
export async function renderHouseResidentsTab(container, model) {
  container.replaceChildren();
  if (!model) return;
  if (!model.health) {
    container.append(element('p', null, 'La santé de cette maison n\'est pas disponible.'));
    return;
  }
  let residents;
  try {
    residents = await model.accounting.getHouseResidents(model.buildingId);
  } catch (error) {
    console.error('[HouseResidentsTab] getHouseResidents failed:', error);
    container.append(element('p', null, 'Les habitants de cette maison ne sont pas disponibles.'));
    return;
  }

  const { health } = model;
  // A house outside health (the administrators') has no score, no meter and no environment: its cards say "Immortels" in their place.
  const outside = health.outsideHealth === true;
  // The views, in the order of the cards: the house first, then each citizen. A view has its card and, on demand, its sheet.
  const views = [
    {
      key: 'house',
      card: () => cardButton({
        title: buildingName(model.buildingType),
        line: `${outside ? residents.length : health.citizens} ${HEALTH_LABELS.citizens.toLowerCase()}`,
        score: outside ? HEALTH_LABELS.outside : health.average === null ? '—' : scoresLine(health.average, health.mentalAverage),
        health: outside || health.average === null ? null : Math.min(health.average, health.mentalAverage),
        sick: !outside && health.sick > 0,
        className: `house-card--house${outside ? ' house-card--outside' : ''}`,
      }),
      sheet: () => houseSheet(model),
    },
    ...residents.map((resident) => ({
      key: resident.id,
      card: () => cardButton({
        title: resident.firstName,
        line: placeOf(resident),
        score: outside ? HEALTH_LABELS.outside : `${scoresLine(resident.health, resident.mentalHealth)}${stateOf(resident)}`,
        health: outside ? null : Math.min(resident.health, resident.mentalHealth),
        sick: !outside && isUnwell(resident),
        className: `house-card--${resident.status}${outside ? ' house-card--outside' : ''}`,
      }),
      sheet: () => {
        if (outside) return residentSheet(resident, null, null, true);
        const environment = health.citizenEnvironments[resident.id];
        const mentalEnvironment = health.citizenMentalEnvironments[resident.id];
        if (!environment || !mentalEnvironment) throw new Error(`[HouseResidentsTab] no health environment for the citizen ${resident.id}`);
        return residentSheet(resident, environment, mentalEnvironment, false);
      },
    })),
  ];

  const grid = element('ul', 'house-residents-grid');
  const buttons = new Map();
  for (const view of views) {
    const item = element('li', 'house-residents-grid__item');
    const button = view.card();
    button.addEventListener('click', () => openSheet(view));
    buttons.set(view.key, button);
    item.append(button);
    grid.append(item);
  }

  function openSheet(view) {
    const back = element('button', 'house-sheet__back', `← ${BACK_LABEL}`);
    back.type = 'button';
    back.addEventListener('click', () => {
      container.replaceChildren(grid);
      // The card that was opened gets the focus back, so a keyboard or a screen reader picks up where it left.
      buttons.get(view.key).focus();
    });
    container.replaceChildren(back, view.sheet());
    back.focus();
  }

  container.append(grid);
}
