import { ClientsSectionPresenter } from './ClientsSectionPresenter.js';

/**
 * @param {{ supply: object, registerAppService?: (name: string, instance: *) => void }} deps
 */
export function initClientsSection(deps) {
  if (typeof document === 'undefined') return;

  const section = document.getElementById('admin-section-clients');
  if (!section) return;

  const presenter = new ClientsSectionPresenter(deps, section);
  deps.registerAppService?.('clientsSectionPresenter', presenter);

  // Refreshed each time the tab is opened: what each client got last time moves with the game.
  const observer = new MutationObserver(() => {
    if (section.classList.contains('active')) void presenter.refresh();
  });
  observer.observe(section, { attributes: true, attributeFilter: ['class'] });
  if (section.classList.contains('active')) void presenter.refresh();
}
