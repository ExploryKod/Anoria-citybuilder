/**
 * TimeManager — calendrier de jeu ; DAYS_PER_MONTH vient de la seule source config/events.js (figé en partie).
 *
 * Policies pures : shared/time/TimeCalendar.js
 * Injection composition : composition/gameTimeBridge.js
 */
import * as TimeCalendar from './TimeCalendar.js';
import * as eventsConfig from '../../config/events.js';

export class TimeManager {
  /** Jours (tours) par mois du jeu : figé à la création de la partie (config/events.js), jamais deviné. */
  static get DAYS_PER_MONTH() {
    return eventsConfig.getDaysPerMonth();
  }

  static MONTHS_PER_SEASON = TimeCalendar.MONTHS_PER_SEASON;
  static SEASONS = TimeCalendar.SEASONS;
  static SEASON_EMOJI = TimeCalendar.SEASON_EMOJI;
  static MONTHS = TimeCalendar.MONTHS;

  static getSeasonDisplay(season) {
    return TimeCalendar.getSeasonDisplay(season);
  }

  static getSeasonDisplayForDays(days) {
    return TimeCalendar.getSeasonDisplay(this.getTimeInfo(days).season);
  }

  static getTimeInfo(days) {
    return TimeCalendar.getTimeInfo(days, this.DAYS_PER_MONTH);
  }

  static formatTime(days, options = {}) {
    return TimeCalendar.formatTime(days, this.DAYS_PER_MONTH, options);
  }

  /** The date the player reads for a turn: the day and month, the year, and the season (e.g. « 12 Mars | 1 ap JC · Printemps »). */
  static formatGameDate(turn) {
    return `${this.formatTime(turn, { abbreviated: false })} · ${this.getTimeInfo(turn).season}`;
  }

  static formatTimeShort(days) {
    return TimeCalendar.formatTimeShort(days, this.DAYS_PER_MONTH);
  }

  static getBuildingAge(currentTime, worldTime) {
    return TimeCalendar.getBuildingAge(currentTime, worldTime);
  }

  static isBuildingOldEnough(currentTime, worldTime, requiredAgeDays = 3) {
    return TimeCalendar.isBuildingOldEnough(currentTime, worldTime, requiredAgeDays);
  }
}
