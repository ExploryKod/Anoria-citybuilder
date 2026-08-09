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
  const safeIndex = index >= 0 ? index : 0;
  const label = SEASONS[safeIndex];
  return {
    season: label,
    seasonKey: SEASON_KEYS[safeIndex],
    emoji: SEASON_EMOJI[label] ?? '🌸',
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

/**
 * Calcule les informations de temps à partir du nombre de jours.
 *
 * @param {number} days
 * @param {number} daysPerMonth
 */
export function getTimeInfo(days, daysPerMonth) {
  if (days === undefined || days === null || isNaN(days) || typeof days !== 'number') {
    days = 0;
  }

  days = Math.max(0, Math.floor(days));

  const adjustedDays = days;
  const dayInMonth = (adjustedDays % daysPerMonth) + 1;
  const monthIndexAdjusted = Math.floor(adjustedDays / daysPerMonth) % 12;
  const monthNumber = Math.floor(adjustedDays / daysPerMonth) + 1;
  const year = Math.floor(adjustedDays / (daysPerMonth * 12));

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

  const safeMonthIndex = Math.max(0, Math.min(11, monthIndexAdjusted));
  const safeSeasonIndex = Math.max(0, Math.min(3, seasonIndex));
  const month = MONTHS[safeMonthIndex];
  const season = SEASONS[safeSeasonIndex];

  if (!month || !season) {
    return {
      days,
      dayInMonth: 1,
      month: MONTHS[0],
      monthIndex: 0,
      monthNumber: 1,
      season: SEASONS[0],
      seasonIndex: 0,
      year: 0,
    };
  }

  return {
    days,
    dayInMonth,
    month,
    monthIndex: safeMonthIndex,
    monthNumber,
    season,
    seasonIndex: safeSeasonIndex,
    year,
  };
}

/**
 * @param {number|undefined|null} days
 * @param {number} daysPerMonth
 */
export function formatTime(days, daysPerMonth) {
  if (days === undefined || days === null || isNaN(days) || typeof days !== 'number') {
    return 'Chargement...';
  }

  const timeInfo = getTimeInfo(days, daysPerMonth);

  if (!timeInfo.month || !timeInfo.season) {
    return 'Chargement...';
  }

  let yearDisplay;
  if (timeInfo.year === 0) {
    yearDisplay = '0 JC';
  } else {
    yearDisplay = `${timeInfo.year} ap JC`;
  }

  const showDay = daysPerMonth > 1;
  const dateLabel = showDay
    ? `${timeInfo.dayInMonth} ${timeInfo.month}`
    : `${timeInfo.month}`;

  return `${dateLabel} | ${yearDisplay}`;
}

/**
 * Worst-case HUD date label (longest month + day + year) for stable chip width.
 * @param {number} [maxDaysPerMonth=30]
 */
export function getHudTimeBarLabelMaxSample(maxDaysPerMonth = 30) {
  const longestMonth = MONTHS.reduce((best, month) => (month.length > best.length ? month : best));
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
  if (
    worldTime === undefined ||
    worldTime === null ||
    isNaN(worldTime) ||
    typeof worldTime !== 'number'
  ) {
    return 0;
  }
  if (
    currentTime === undefined ||
    currentTime === null ||
    isNaN(currentTime) ||
    typeof currentTime !== 'number'
  ) {
    return 0;
  }
  return Math.max(0, currentTime - worldTime);
}

/** @param {number} currentTime @param {number} worldTime @param {number} [requiredAgeDays=3] */
export function isBuildingOldEnough(currentTime, worldTime, requiredAgeDays = 3) {
  return getBuildingAge(currentTime, worldTime) > requiredAgeDays;
}
