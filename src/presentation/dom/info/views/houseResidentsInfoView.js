import { buildingName } from '../../shell/CatalogVocabulary.js';

const STATUS_LABELS = Object.freeze({ civil_servant: 'Fonctionnaire (la mairie)', unemployed: 'Chômeur' });

/**
 * The Habitants tab of a house: one line per citizen, in a list that scrolls. The line says who he is and where he works,
 * or his status when he works for no one (a civil servant of the city, or unemployed). The names and the workplaces come
 * from the catalogs; the citizens are read from the buildings (see getHouseResidents).
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
    const item = document.createElement('li');
    item.className = `house-residents-item house-residents-item--${resident.status}`;
    const name = document.createElement('span');
    name.className = 'house-residents-name';
    name.textContent = resident.firstName;
    const place = document.createElement('span');
    place.className = 'house-residents-place';
    place.textContent = resident.status === 'worker' ? `Travaille à ${buildingName(resident.workplaceType)}` : STATUS_LABELS[resident.status];
    item.append(name, ' — ', place);
    list.append(item);
  }
  container.append(list);
}
