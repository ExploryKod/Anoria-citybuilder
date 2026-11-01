import { LAND_USES } from '../../../../shared/land-catalog/LandUseCatalog.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';

/**
 * The Prix tab of the owner's house: the prices of what its property company sells, one line per use of land, per tile (the equivalent of a hectare). The price starts at
 * the catalog's and the player changes it at any time; each sale uses the price in force that day.
 * @param {HTMLElement} container
 * @param {{ land: { listLandPrices: () => Promise<Array<{ use: string, pricePerTile: number }>>, setLandPrice: (use: string, price: number) => Promise<void> } } | null} model
 */
export async function renderLandPricesTab(container, model) {
  container.replaceChildren();
  if (!model) return;
  const { land } = model;
  if (!land) throw new Error('[LandPricesTab] the land context was not given to the info panel: the prices cannot be read');

  const list = document.createElement('ul');
  list.className = 'land-prices';
  list.setAttribute('aria-label', 'Prix des terrains');
  for (const { use, pricePerTile, forSale, sold } of await land.listLandPrices()) {
    const item = document.createElement('li');
    item.className = 'land-prices__item';

    const label = document.createElement('label');
    label.className = 'land-prices__label';
    label.htmlFor = `land-price-${use}`;
    label.textContent = `Terrain ${LAND_USES[use].singular}, par case`;

    const input = document.createElement('input');
    input.type = 'number';
    input.id = `land-price-${use}`;
    input.className = 'land-prices__input';
    input.min = '1';
    input.step = '1';
    input.inputMode = 'decimal';
    input.value = String(pricePerTile);

    const save = document.createElement('button');
    save.type = 'button';
    save.className = 'land-prices__save';
    save.textContent = 'Fixer';

    const status = document.createElement('span');
    status.className = 'land-prices__status';
    status.setAttribute('aria-live', 'polite');
    status.textContent = formatEuro(pricePerTile);

    save.addEventListener('click', async () => {
      const price = Number(input.value);
      try {
        await land.setLandPrice(use, price);
        status.textContent = `${formatEuro(price)} enregistré`;
      } catch (error) {
        console.error('[LandPricesTab] the price could not be set:', error);
        status.textContent = 'Prix refusé : il doit être supérieur à 0';
      }
    });

    // How much of this land the town hall holds: still for sale, and sold to the producers (they are tinted dark green on the map)
    const count = document.createElement('span');
    count.className = 'land-prices__count';
    count.textContent = `${forSale} case${forSale > 1 ? 's' : ''} en vente · ${sold} vendue${sold > 1 ? 's' : ''}`;

    item.append(label, count, input, save, status);
    list.append(item);
  }
  container.append(list);
}
