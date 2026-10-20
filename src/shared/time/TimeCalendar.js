/** Nombre de mois par an : fixe pour tout le jeu (seul le nombre de jours par mois est un paramètre). */
export const MONTHS_PER_YEAR = 12;

/**
 * A turn count (days since the game began): a finite number, never negative.
 * @param {unknown} days
 * @param {string} what
 */
export function assertTurnCount(days, what = 'days') {
  if (typeof days !== 'number' || !Number.isFinite(days) || days < 0) {
    throw new Error(`[TimeCalendar] ${what} must be a finite number >= 0, got ${days}`);
  }
}

/** @param {unknown} daysPerMonth */
export function assertDaysPerMonth(daysPerMonth) {
  if (!Number.isInteger(daysPerMonth) || daysPerMonth < 1) {
    throw new Error(`[TimeCalendar] daysPerMonth must be a positive integer, got ${daysPerMonth}`);
  }
}

/**
 * Nombre de tours (jours) que dure une année pour un nombre de jours par mois donné.
 *
 * @param {number} daysPerMonth
 */
export function turnsPerYear(daysPerMonth) {
  assertDaysPerMonth(daysPerMonth);
  return daysPerMonth * MONTHS_PER_YEAR;
}

/** Nombre de mois par saison (calendrier civil du jeu). */
export const MONTHS_PER_SEASON = 3;

/** @readonly */
export const SEASONS = Object.freeze(['Printemps', 'Été', 'Automne', 'Hiver']);

/** Emoji affiché dans le HUD pour chaque saison */
export const SEASON_EMOJI = Object.freeze({
  Printemps: '🌸',
  Été: '☀️',
  Automne: '🍂',
  Hiver: '❄️',
});

/** Clé CSS stable pour chaque saison (ordre = SEASONS) */
export const SEASON_KEYS = Object.freeze(['printemps', 'ete', 'automne', 'hiver']);

/**
 * @param {string} [season]
 * @returns {{ season: string, seasonKey: string, emoji: string, title: string, ariaLabel: string }}
 */
export function getSeasonDisplay(season) {
  const index = SEASONS.indexOf(season);
  if (index < 0) {
    throw new Error(`[TimeCalendar] unknown season "${season}", expected one of ${SEASONS.join(', ')}`);
  }
  const label = SEASONS[index];
  return {
    season: label,
    seasonKey: SEASON_KEYS[index],
    emoji: SEASON_EMOJI[label],
    title: label,
    ariaLabel: `Saison : ${label}`,
  };
}

/** @readonly */
export const MONTHS = Object.freeze([
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]);

/** Abréviations HUD (typographie française) — index aligné sur MONTHS. */
export const MONTH_ABBREVS = Object.freeze([
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juill.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
]);

/**
 * Calcule les informations de temps à partir du nombre de jours.
 *
 * @param {number} days
 * @param {number} daysPerMonth
 */
export function getTimeInfo(days, daysPerMonth) {
  assertTurnCount(days);
  assertDaysPerMonth(daysPerMonth);
  days = Math.floor(days);

  const adjustedDays = days;
  const dayInMonth = (adjustedDays % daysPerMonth) + 1;
  const monthIndexAdjusted = Math.floor(adjustedDays / daysPerMonth) % MONTHS_PER_YEAR;
  const monthNumber = Math.floor(adjustedDays / daysPerMonth) + 1;
  const year = Math.floor(adjustedDays / turnsPerYear(daysPerMonth));

  let seasonIndex;
  if (monthIndexAdjusted >= 8 && monthIndexAdjusted <= 10) {
    seasonIndex = 2;
  } else if (monthIndexAdjusted === 11 || monthIndexAdjusted <= 1) {
    seasonIndex = 3;
  } else if (monthIndexAdjusted >= 2 && monthIndexAdjusted <= 4) {
    seasonIndex = 0;
  } else {
    seasonIndex = 1;
  }

  const month = MONTHS[monthIndexAdjusted];
  const season = SEASONS[seasonIndex];

  return {
    days,
    dayInMonth,
    month,
    monthIndex: monthIndexAdjusted,
    monthNumber,
    season,
    seasonIndex,
    year,
  };
}

/**
 * @param {number|undefined|null} days
 * @param {number} daysPerMonth
 * @param {{ abbreviated?: boolean }} [options]
 */
export function formatTime(days, daysPerMonth, options = {}) {
  const timeInfo = getTimeInfo(days, daysPerMonth);

  let yearDisplay;
  if (timeInfo.year === 0) {
    yearDisplay = '0 JC';
  } else {
    yearDisplay = `${timeInfo.year} ap JC`;
  }

  const abbreviated = options.abbreviated !== false;
  const showDay = daysPerMonth > 1;
  const monthLabel = abbreviated
    ? MONTH_ABBREVS[timeInfo.monthIndex]
    : timeInfo.month;
  const dateLabel = showDay
    ? `${timeInfo.dayInMonth} ${monthLabel}`
    : `${monthLabel}`;

  return `${dateLabel} | ${yearDisplay}`;
}

/**
 * Worst-case HUD date label (longest month + day + year) for stable chip width.
 * @param {number} [maxDaysPerMonth=30]
 */
export function getHudTimeBarLabelMaxSample(maxDaysPerMonth = 30) {
  const longestMonth = MONTH_ABBREVS.reduce((best, month) => (month.length > best.length ? month : best));
  const dayPrefix = maxDaysPerMonth > 1 ? `${maxDaysPerMonth} ` : '';
  return `${dayPrefix}${longestMonth} | 9999 ap JC`;
}

/** @readonly */
export const HUD_TIME_BAR_LABEL_MAX = getHudTimeBarLabelMaxSample(30);

/** @param {number} days @param {number} daysPerMonth */
export function formatTimeShort(days, daysPerMonth) {
  const timeInfo = getTimeInfo(days, daysPerMonth);
  const showDay = daysPerMonth > 1;
  const dayLabel = showDay ? `J${timeInfo.dayInMonth}` : `M${timeInfo.monthNumber}`;

  return `${dayLabel} | ${timeInfo.month} | ${timeInfo.season}`;
}

/** @param {number} currentTime @param {number} worldTime */
export function getBuildingAge(currentTime, worldTime) {
  assertTurnCount(currentTime, 'currentTime');
  assertTurnCount(worldTime, 'the building worldTime');
  if (worldTime > currentTime) {
    throw new Error(`[TimeCalendar] building worldTime ${worldTime} is after the current time ${currentTime}`);
  }
  return currentTime - worldTime;
}

/** @param {number} currentTime @param {number} worldTime @param {number} [requiredAgeDays=3] */
export function isBuildingOldEnough(currentTime, worldTime, requiredAgeDays = 3) {
  return getBuildingAge(currentTime, worldTime) > requiredAgeDays;
}
