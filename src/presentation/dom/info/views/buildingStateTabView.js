/**
 * The État tab of a workplace — view layer (DOM only). One scrolling page of up to three sections, announced up front by a bar of
 * links (icon and word) that scrolls to each: the building's state, its staff, and its services (a single row of chips).
 */

import { renderKvPanelView } from './kvPanelView.js';
import { renderServicesTab } from './servicesInfoView.js';

/**
 * @typedef {object} BuildingStateModel
 * @property {import('../buildingInfoTypes.js').InfoKvPanelModel | null} state What the group says of the building's state (null: nothing to say)
 * @property {import('../buildingInfoTypes.js').InfoKvPanelModel | null} staff The staffing panel (null: the building has no staff)
 * @property {object | null} services The services row's model
 */

/**
 * A kv model drawn under a heading of the tab: its single section loses its own title (the heading says it).
 * @param {import('../buildingInfoTypes.js').InfoKvPanelModel} model
 */
const untitledWhenSingle = (model) => (model.sections.length === 1 ? { sections: [{ ...model.sections[0], title: null }] } : model);

/**
 * Chips that do not fit in the width slide sideways under two arrows; while they fit there is nothing to slide, so no arrows show.
 * @param {HTMLElement} row
 */
function makeSlidable(row) {
  const wrapper = document.createElement('div');
  wrapper.className = 'building-state-carousel';
  row.replaceWith(wrapper);

  const arrow = (direction, label, glyph) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `building-state-carousel__arrow building-state-carousel__arrow--${direction}`;
    button.setAttribute('aria-label', label);
    button.textContent = glyph;
    button.hidden = true;
    button.addEventListener('click', () => row.scrollBy({ left: (direction === 'next' ? 1 : -1) * row.clientWidth * 0.8, behavior: 'smooth' }));
    return button;
  };
  const previous = arrow('previous', 'Services précédents', '‹');
  const next = arrow('next', 'Services suivants', '›');
  wrapper.append(previous, row, next);

  const sync = () => {
    const overflows = row.scrollWidth > row.clientWidth + 1;
    previous.hidden = !overflows || row.scrollLeft <= 0;
    next.hidden = !overflows || row.scrollLeft + row.clientWidth >= row.scrollWidth - 1;
  };
  row.addEventListener('scroll', sync, { passive: true });
  if (typeof ResizeObserver === 'function') new ResizeObserver(sync).observe(row);
  sync();
}

/**
 * @param {HTMLElement} container the tab's panel (it scrolls)
 * @param {BuildingStateModel | null} model
 */
export function renderBuildingStateView(container, model) {
  container.replaceChildren();
  if (!model) return;

  const sections = [
    { id: 'etat', icon: '🧭', title: 'État', kv: model.state },
    { id: 'personnel', icon: '👷', title: 'Personnel', kv: model.staff },
    { id: 'services', icon: '🔧', title: 'Services', services: model.services },
  ].filter((section) => section.kv?.sections?.length || section.services?.items?.length);
  if (sections.length === 0) return;

  const elements = sections.map((section) => {
    const element = document.createElement('section');
    element.className = 'building-state-section';
    element.id = `building-state-${section.id}`;
    element.setAttribute('aria-labelledby', `${element.id}-title`);

    const heading = document.createElement('h3');
    heading.id = `${element.id}-title`;
    heading.className = 'building-state-section__title';
    heading.textContent = `${section.icon} ${section.title}`;
    const body = document.createElement('div');
    element.append(heading, body);

    if (section.kv) renderKvPanelView(body, untitledWhenSingle(section.kv));
    else {
      renderServicesTab(body, section.services);
      const row = body.querySelector('.building-info-services-row');
      if (row) makeSlidable(row);
    }
    return element;
  });

  // The page announces its sections; each link scrolls to its own, and the one in view is marked.
  const nav = document.createElement('nav');
  nav.className = 'building-state-nav';
  nav.setAttribute('aria-label', 'Sections');
  const links = sections.map((section, index) => {
    const link = document.createElement('a');
    link.className = 'building-state-nav__link';
    link.href = `#${elements[index].id}`;
    link.textContent = `${section.icon} ${section.title}`;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      elements[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    nav.append(link);
    return link;
  });
  const mark = (index) => links.forEach((link, i) => link.classList.toggle('is-active', i === index));
  mark(0);

  container.append(nav, ...elements);

  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).map((entry) => elements.indexOf(entry.target));
        if (visible.length > 0) mark(Math.min(...visible));
      },
      { root: container, rootMargin: '0px 0px -60% 0px' },
    );
    elements.forEach((element) => observer.observe(element));
  }
}
