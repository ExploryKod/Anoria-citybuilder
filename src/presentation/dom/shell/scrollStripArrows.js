/**
 * A strip of buttons that scrolls sideways (swipe, wheel) with a "back" and a "forward" arrow beside it. Each arrow moves by most of what
 * is visible and is disabled at its end; both are disabled when the strip fits and needs no scrolling.
 */

/**
 * @param {{ strip: HTMLElement, back: HTMLButtonElement, forward: HTMLButtonElement }} parts
 */
export function initScrollStripArrows({ strip, back, forward }) {
  if (!strip || !back || !forward) {
    throw new Error('scrollStripArrows: strip, back and forward are all required');
  }

  const update = () => {
    const max = strip.scrollWidth - strip.clientWidth;
    back.disabled = strip.scrollLeft <= 1;
    forward.disabled = strip.scrollLeft >= max - 1;
  };

  const step = (direction) => {
    strip.scrollBy({ left: direction * strip.clientWidth * 0.8, behavior: 'smooth' });
  };

  back.addEventListener('click', () => step(-1));
  forward.addEventListener('click', () => step(1));
  strip.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(strip);
  update();

  return {
    update,
    /** Bring a button into view (the selected tab, when it is off to the side). @param {HTMLElement} el */
    reveal(el) {
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
    },
  };
}
