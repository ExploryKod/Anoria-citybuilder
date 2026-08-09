import { HUD_TIME_BAR_LABEL_MAX } from '../../../shared/time/TimeCalendar.js';

/** Measure longest HUD date label with current chip typography. */
export function applyHudTimeBarMinWidth() {
  const displayTime = document.querySelector('.info-panel .display-time');
  if (!displayTime) return;

  const style = getComputedStyle(displayTime);
  const probe = document.createElement('span');
  probe.textContent = HUD_TIME_BAR_LABEL_MAX;
  probe.style.position = 'absolute';
  probe.style.visibility = 'hidden';
  probe.style.whiteSpace = 'nowrap';
  probe.style.font = style.font;
  probe.style.fontSize = style.fontSize;
  probe.style.fontWeight = style.fontWeight;
  probe.style.fontVariantNumeric = style.fontVariantNumeric;
  probe.style.fontFamily = style.fontFamily;
  probe.style.letterSpacing = style.letterSpacing;

  document.body.appendChild(probe);
  const textWidth = Math.ceil(probe.getBoundingClientRect().width);
  probe.remove();

  const root = document.documentElement;
  root.style.setProperty('--hud-time-date-min-width', `${textWidth}px`);

  const seasonWidth = 44;
  const clockIcon = document.querySelector('.info-panel .infos-time .clock-icon svg');
  const clockIconWidth = clockIcon ? Math.ceil(clockIcon.getBoundingClientRect().width) : 16;
  const clockGap = 6;
  const clockPaddingX = 24;
  const barMinWidth = seasonWidth + clockPaddingX + clockIconWidth + clockGap + textWidth;
  root.style.setProperty('--hud-time-bar-min-width', `${barMinWidth}px`);
}

export function initHudTimeBarMinWidth() {
  applyHudTimeBarMinWidth();
  const mq = window.matchMedia('(max-width: 1024px)');
  if (mq.addEventListener) {
    mq.addEventListener('change', applyHudTimeBarMinWidth);
  } else if (mq.addListener) {
    mq.addListener(applyHudTimeBarMinWidth);
  }
}
