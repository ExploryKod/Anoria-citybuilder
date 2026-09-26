import { goodIcon, goodLabel } from './CatalogVocabulary.js';

/**
 * The rows of the resource panels of the population rail — one per good, with the icon and name the catalog gives
 * it. The markup holds none: which goods the city block and the map block list is what the catalog declares.
 *
 * @param {{ root: string, destination: 'city' | 'nature', panelId: string, products: ReadonlyArray<string> }} params
 */
export function renderHudResourceRows({ root, destination, panelId, products }) {
  const group = document.querySelector(`${root} #${panelId} .pop-detail-groups`);
  if (!group) return;

  group.innerHTML = '';
  for (const product of products) {
    const row = document.createElement('div');
    row.className = 'pop-detail-metric pop-group-row';
    row.dataset.metric = 'resource';
    row.dataset.destination = destination;
    row.dataset.product = product;
    row.innerHTML = `
      <span class="pop-detail-emoji" title="${goodLabel(product)}" aria-hidden="true">${goodIcon(product)}</span>
      <span class="pop-detail-values">
        <span class="pop-detail-value pop-detail-value--country">0</span>
        <span class="pop-detail-value pop-detail-value--hamlet">0</span>
      </span>`;
    group.appendChild(row);
  }
}
