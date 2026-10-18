import { StorageSectionPresenter } from './StorageSectionPresenter.js';

/**
 * The stock units (the windmills) are a tab of the food traceability section: they load when that tab is shown.
 * @param {{
 *   supply: object,
 *   construction: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initStorageSection(deps) {
  if (typeof document === 'undefined') return;

  const storageTab = document.getElementById('supply-traceability-storage-tab');
  if (!storageTab) return;

  const presenter = new StorageSectionPresenter(deps);

  const observer = new MutationObserver(() => {
    if (storageTab.classList.contains('active')) {
      presenter.refresh();
    }
  });

  observer.observe(storageTab, { attributes: true, attributeFilter: ['class'] });

  if (storageTab.classList.contains('active')) {
    presenter.init();
  }

  deps.registerAppService?.('storageSectionPresenter', presenter);
}
