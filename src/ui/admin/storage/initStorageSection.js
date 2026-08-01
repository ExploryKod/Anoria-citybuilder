import { registerAppService } from '../../../js/acl/appRuntime.js';
import { StorageSectionPresenter } from './StorageSection.js';

export function initStorageSection() {
  const storageSection = document.getElementById('admin-section-storage');
  if (!storageSection) return;

  const presenter = new StorageSectionPresenter();

  const observer = new MutationObserver(() => {
    if (storageSection.classList.contains('active')) {
      presenter.refresh();
    }
  });

  observer.observe(storageSection, { attributes: true, attributeFilter: ['class'] });

  if (storageSection.classList.contains('active')) {
    presenter.init();
  }

  registerAppService('storageSectionPresenter', presenter);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStorageSection);
} else {
  initStorageSection();
}
