import Splide from '@splidejs/splide';
import { getActiveHamletId, listHamlets } from '../../../core/persistence/hamlet/hamletSession.js';

const HOUSE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22a1 1 0 0 1-1-1v-4a1 1 0 0 1 .445-.832l3-2a1 1 0 0 1 1.11 0l3 2A1 1 0 0 1 22 17v4a1 1 0 0 1-1 1z"/><path d="M18 10a8 8 0 0 0-16 0c0 4.993 5.539 10.193 7.399 11.799a1 1 0 0 0 .601.2"/><path d="M18 22v-3"/><circle cx="10" cy="10" r="3"/></svg>`;

let bar = null;
let list = null;
let splide = null;
let switcherButton = null;

function buildBar() {
  const el = document.createElement('div');
  el.id = 'hamlet-switcher';
  el.className = 'mobile-build-bar hamlet-switcher';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Hameaux');
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="mobile-build-bar__carousel splide hamlet-switcher__carousel">
      <div class="splide__arrows mobile-build-bar__arrows">
        <button type="button" class="splide__arrow splide__arrow--prev mobile-build-bar__arrow" aria-label="Hameaux précédents">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <button type="button" class="splide__arrow splide__arrow--next mobile-build-bar__arrow" aria-label="Hameaux suivants">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      <div class="splide__track">
        <ul class="splide__list hamlet-switcher__list"></ul>
      </div>
    </div>`;
  return el;
}

function applyCardState(card, hamlet, isActive) {
  card.dataset.hamletId = hamlet.id;
  card.style.setProperty('--hamlet-color', hamlet.color);
  card.disabled = !hamlet.unlocked;
  card.classList.toggle('is-locked', !hamlet.unlocked);
  card.classList.toggle('is-active', isActive);
  card.setAttribute('aria-label', hamlet.name);
}

function buildSlide(hamlet, isActive) {
  const slide = document.createElement('li');
  slide.className = 'splide__slide hamlet-switcher__slide';

  const item = document.createElement('div');
  item.className = 'hamlet-switcher__item';

  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'hamlet-card';
  card.innerHTML = HOUSE_ICON_SVG;
  applyCardState(card, hamlet, isActive);

  const name = document.createElement('span');
  name.className = 'hamlet-switcher__name';
  name.textContent = hamlet.name;

  item.append(card, name);
  slide.append(item);
  return slide;
}

export function isHamletSwitcherOpen() {
  return Boolean(bar?.classList.contains('mobile-build-bar--open'));
}

export function closeHamletSwitcher() {
  if (!bar || !isHamletSwitcherOpen()) return;
  bar.classList.remove('mobile-build-bar--open');
  bar.setAttribute('aria-hidden', 'true');
  switcherButton.classList.remove('active');
  switcherButton.setAttribute('aria-expanded', 'false');
}

async function openHamletSwitcher() {
  const hamlets = await listHamlets();
  const activeId = getActiveHamletId();
  if (!splide) {
    list.replaceChildren(...hamlets.map((hamlet) => buildSlide(hamlet, hamlet.id === activeId)));
  } else {
    for (const card of list.querySelectorAll('.hamlet-card')) {
      const hamlet = hamlets.find((candidate) => candidate.id === card.dataset.hamletId);
      if (!hamlet) throw new Error(`[hamletSwitcher] card for an unknown hamlet ${card.dataset.hamletId}`);
      applyCardState(card, hamlet, hamlet.id === activeId);
    }
  }
  bar.classList.add('mobile-build-bar--open');
  bar.setAttribute('aria-hidden', 'false');
  switcherButton.classList.add('active');
  switcherButton.setAttribute('aria-expanded', 'true');
  if (!splide) {
    splide = new Splide(bar.querySelector('.hamlet-switcher__carousel'), {
      type: 'slide',
      autoWidth: true,
      gap: '12px',
      pagination: false,
      arrows: true,
      drag: true,
      wheel: false,
      speed: 320,
      keyboard: false,
    });
    splide.mount();
  }
}

/**
 * Hamlet carousel opened from the bottom bar, styled and placed like the construction bar.
 * Choosing a card travels to that hamlet on the same page.
 * @param {{ getGame: () => { travelToHamlet: (hamletId: string) => Promise<boolean> } | null | undefined }} deps
 */
export function initHamletSwitcher({ getGame }) {
  switcherButton = document.getElementById('hamlet-switcher-btn');
  if (!switcherButton) throw new Error('[hamletSwitcher] #hamlet-switcher-btn is missing from the page');

  bar = buildBar();
  document.body.appendChild(bar);
  list = bar.querySelector('.hamlet-switcher__list');

  switcherButton.addEventListener('click', () => {
    if (isHamletSwitcherOpen()) closeHamletSwitcher();
    else openHamletSwitcher();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeHamletSwitcher();
  });

  list.addEventListener('click', async (event) => {
    const card = event.target.closest('.hamlet-card');
    if (!card || card.disabled) return;
    const hamletId = card.dataset.hamletId;
    if (hamletId === getActiveHamletId()) {
      closeHamletSwitcher();
      return;
    }
    const game = getGame();
    if (!game) throw new Error('[hamletSwitcher] the game session is not running');
    const travelled = await game.travelToHamlet(hamletId);
    if (travelled) closeHamletSwitcher();
  });
}
