/**
 * Hamlet travel carousel — bottom FAB next to construction.
 * Arrows appear only when the track overflows the viewport.
 */

import { getSessionGame } from '../../../composition/sessionRuntime.js';
import {
  getActiveHamletId,
  listHamlets,
} from '../../../core/persistence/hamlet/hamletSession.js';

function destinationButtons(track) {
  return [...(track?.querySelectorAll('[data-hamlet-id]') ?? [])].filter(
    (el) => el instanceof HTMLButtonElement
  );
}

function paintDestinations(track, activeId) {
  destinationButtons(track).forEach((btn) => {
    const isActive = btn.dataset.hamletId === activeId;
    btn.classList.toggle('hamlet-travel__dest--active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
    btn.setAttribute('aria-current', isActive ? 'true' : 'false');
    btn.setAttribute('aria-disabled', isActive ? 'true' : 'false');
    const name = btn.textContent.trim();
    btn.setAttribute(
      'aria-label',
      isActive ? `${name}, hameau actuel` : name
    );
  });
}

/**
 * @param {HTMLElement} track
 * @param {{ id: string, name: string }[]} hamlets
 */
function renderTrack(track, hamlets) {
  track.replaceChildren();
  for (const hamlet of hamlets) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hamlet-travel__dest';
    btn.setAttribute('role', 'option');
    btn.tabIndex = -1;
    btn.dataset.hamletId = hamlet.id;
    btn.textContent = hamlet.name;
    track.appendChild(btn);
  }
}

function setOpenAttrs(menu, toggle, open) {
  if (!menu || !toggle) return;
  menu.hidden = !open;
  menu.inert = !open;
  menu.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toggle.classList.toggle('active', open);
}

export function initHamletTravelMenu() {
  const toggle = document.getElementById('hamlet-travel-btn');
  const menu = document.getElementById('hamlet-travel-menu');
  const track = document.getElementById('hamlet-travel-track');
  const viewport = document.getElementById('hamlet-travel-viewport');
  const prevBtn = document.getElementById('hamlet-travel-prev');
  const nextBtn = document.getElementById('hamlet-travel-next');
  if (!toggle || !menu || !track || !viewport || !prevBtn || !nextBtn) return;

  let open = false;

  function focusables() {
    const dests = destinationButtons(track);
    const extras = [];
    if (!prevBtn.hidden) extras.push(prevBtn);
    extras.push(...dests);
    if (!nextBtn.hidden) extras.push(nextBtn);
    return extras;
  }

  function syncOverflow() {
    const overflowing = viewport.scrollWidth > viewport.clientWidth + 2;
    menu.classList.toggle('hamlet-travel__carousel--overflow', overflowing);
    prevBtn.hidden = !overflowing;
    nextBtn.hidden = !overflowing;
    const atStart = viewport.scrollLeft <= 2;
    const atEnd = viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 2;
    prevBtn.disabled = overflowing && atStart;
    nextBtn.disabled = overflowing && atEnd;
    prevBtn.tabIndex = overflowing && open ? 0 : -1;
    nextBtn.tabIndex = overflowing && open ? 0 : -1;
    destinationButtons(track).forEach((btn) => {
      btn.tabIndex = open ? 0 : -1;
    });
  }

  function scrollByPage(direction) {
    const delta = Math.max(120, Math.floor(viewport.clientWidth * 0.7)) * direction;
    viewport.scrollBy({ left: delta, behavior: 'smooth' });
  }

  function close({ restoreFocus = true } = {}) {
    open = false;
    setOpenAttrs(menu, toggle, false);
    syncOverflow();
    if (restoreFocus) {
      toggle.focus();
    }
  }

  function openMenu() {
    open = true;
    paintDestinations(track, getActiveHamletId());
    setOpenAttrs(menu, toggle, true);
    requestAnimationFrame(() => {
      syncOverflow();
      const dests = destinationButtons(track);
      const active = dests.find((btn) => btn.dataset.hamletId === getActiveHamletId());
      active?.scrollIntoView({ inline: 'center', block: 'nearest' });
      const inactive = dests.find((btn) => btn.dataset.hamletId !== getActiveHamletId());
      (inactive || dests[0])?.focus();
      requestAnimationFrame(syncOverflow);
    });
  }

  async function travel(hamletId) {
    if (!hamletId || hamletId === getActiveHamletId()) {
      close();
      return;
    }
    close({ restoreFocus: false });
    const game = getSessionGame();
    await game?.travelToHamlet?.(hamletId);
    paintDestinations(track, getActiveHamletId());
    toggle.focus();
  }

  setOpenAttrs(menu, toggle, false);

  toggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (open) close();
    else openMenu();
  });

  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (open) close();
      else openMenu();
      return;
    }
    if (open && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      (focusables()[0] || destinationButtons(track)[0])?.focus();
    }
  });

  track.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('[data-hamlet-id]') : null;
    if (!(btn instanceof HTMLButtonElement)) return;
    e.preventDefault();
    void travel(btn.dataset.hamletId);
  });

  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    scrollByPage(-1);
  });

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    scrollByPage(1);
  });

  viewport.addEventListener('scroll', () => {
    if (open) syncOverflow();
  }, { passive: true });

  menu.addEventListener('keydown', (e) => {
    const dests = destinationButtons(track);
    if (dests.length === 0) return;
    const items = focusables();
    const currentEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const current = currentEl ? items.indexOf(currentEl) : -1;
    const destIndex = currentEl instanceof HTMLButtonElement ? dests.indexOf(currentEl) : -1;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      if (destIndex >= 0) {
        dests[(destIndex + 1) % dests.length].focus();
        dests[(destIndex + 1) % dests.length].scrollIntoView({ inline: 'nearest', block: 'nearest' });
      } else {
        items[(current + 1 + items.length) % items.length]?.focus();
      }
      return;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      if (destIndex >= 0) {
        dests[(destIndex - 1 + dests.length) % dests.length].focus();
        dests[(destIndex - 1 + dests.length) % dests.length].scrollIntoView({
          inline: 'nearest',
          block: 'nearest',
        });
      } else {
        items[(current - 1 + items.length) % items.length]?.focus();
      }
      return;
    }
    if (e.key === 'Home') {
      e.preventDefault();
      e.stopPropagation();
      dests[0].focus();
      dests[0].scrollIntoView({ inline: 'start', block: 'nearest' });
      return;
    }
    if (e.key === 'End') {
      e.preventDefault();
      e.stopPropagation();
      dests[dests.length - 1].focus();
      dests[dests.length - 1].scrollIntoView({ inline: 'end', block: 'nearest' });
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      if (items.length === 0) {
        toggle.focus();
        return;
      }
      if (e.shiftKey) {
        if (current <= 0) toggle.focus();
        else items[current - 1].focus();
      } else if (current >= items.length - 1 || current === -1) {
        toggle.focus();
      } else {
        items[current + 1].focus();
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !open) return;
    e.preventDefault();
    e.stopPropagation();
    close();
  });

  document.addEventListener('pointerdown', (e) => {
    if (!open) return;
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (!menu.contains(target) && !toggle.contains(target)) {
      close({ restoreFocus: false });
    }
  });

  window.addEventListener('resize', () => {
    if (open) syncOverflow();
  });

  document.getElementById('toolbar-mobile-toggle')?.addEventListener('click', () => {
    if (open) close({ restoreFocus: false });
  });

  void listHamlets().then((hamlets) => {
    renderTrack(track, hamlets);
    paintDestinations(track, getActiveHamletId());
    syncOverflow();
  });
}
