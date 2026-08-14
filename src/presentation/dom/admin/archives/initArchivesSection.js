import { ArchivesSectionPresenter } from './ArchivesSectionPresenter.js';

/**
 * @param {{
 *   intelligence: object,
 *   registerAppService?: (name: string, instance: *) => void,
 * }} deps
 */
export function initArchivesSection(deps) {
  if (typeof document === 'undefined') return;
  if (!deps?.intelligence) return;

  const section = document.getElementById('admin-section-archives');
  if (!section) return;

  const presenter = new ArchivesSectionPresenter(deps);
  presenter.init();

  const observer = new MutationObserver(() => {
    if (section.classList.contains('active')) {
      void presenter.loadArchives();
    }
  });

  observer.observe(section, { attributes: true, attributeFilter: ['class'] });

  deps.registerAppService?.('archivesSectionPresenter', presenter);
}
