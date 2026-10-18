import Splide from '@splidejs/splide';
import { AutoScroll } from '@splidejs/splide-extension-auto-scroll';
import '@splidejs/splide/css/core';

/**
 * The bar of short reminders under the game's HUD: the messages scroll by continuously, in a loop, and stop while the pointer is on the bar. The
 * reminders themselves are rules of the catalog (shared/gameplay/reminderCatalog.js); this only shows what it is given, and hides itself when it
 * is given nothing. The scroll does not restart unless the list of messages changed.
 *
 * Markup expected in the page: `<div id="hud-ticker" hidden><div class="splide"><div class="splide__track"><ul class="splide__list"></ul></div></div></div>`.
 * @param {HTMLElement | null} root
 */
export function createHudTicker(root) {
  if (!root) throw new Error('[ticker] #hud-ticker is missing from the page');
  const list = root.querySelector('.splide__list');
  const splideEl = root.querySelector('.splide');
  if (!list || !splideEl) throw new Error('[ticker] #hud-ticker has no .splide__list: its markup is not the Splide carousel');

  /** A loop needs more slides than the bar can show: the messages are repeated until there are at least this many. */
  const MIN_SLIDES = 6;

  /** @type {Splide | null} */
  let splide = null;
  let shown = '';

  return {
    /** @param {ReadonlyArray<string>} messages the reminders that hold now; none hides the bar */
    show(messages) {
      const key = JSON.stringify(messages);
      if (key === shown) return;
      shown = key;

      splide?.destroy(true);
      splide = null;
      root.hidden = messages.length === 0;
      list.replaceChildren();
      if (messages.length === 0) return;

      const slides = [];
      while (slides.length < MIN_SLIDES) slides.push(...messages);
      list.replaceChildren(...slides.map((message) => {
        const slide = document.createElement('li');
        slide.className = 'splide__slide hud-ticker__message';
        slide.textContent = message;
        return slide;
      }));

      splide = new Splide(splideEl, {
        type: 'loop',
        autoWidth: true,
        arrows: false,
        pagination: false,
        drag: false,
        autoScroll: { speed: 0.6, pauseOnHover: true, pauseOnFocus: true },
        // A player who asks for less motion gets no scrolling: the bar shows its first messages still.
        reducedMotion: { autoScroll: false },
      }).mount({ AutoScroll });
    },
  };
}
