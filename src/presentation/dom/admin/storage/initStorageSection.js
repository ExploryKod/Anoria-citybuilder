import { StorageSectionPresenter } from './StorageSectionPresenter.js';

/**
 * @param {{
 *   supply: object,
 *   construction: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initStorageSection(deps) {
  if (typeof document === 'undefined') return;

  const storageSection = document.getElementById('admin-section-storage');
  if (!storageSection) return;

  const presenter = new StorageSectionPresenter(deps);

  const observer = new MutationObserver(() => {
    if (storageSection.classList.contains('active')) {
      presenter.refresh();
    }
  });

  observer.observe(storageSection, { attributes: true, attributeFilter: ['class'] });

  if (storageSection.classList.contains('active')) {
    presenter.init();
  }

  deps.registerAppService?.('storageSectionPresenter', presenter);
}
