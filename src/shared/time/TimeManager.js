/**
 * TimeManager — calendrier de jeu + résolution synchrone de DAYS_PER_MONTH (localStorage / env).
 *
 * Policies pures : shared/time/TimeCalendar.js
 * Injection composition : composition/gameTimeBridge.js
 */
import * as TimeCalendar from './TimeCalendar.js';
import * as eventsConfig from '../../config/events.js';

export class TimeManager {
  static _eventsConfigCache = null;
  static _daysPerMonthCache = null;
  static _cacheInitialized = false;

  static async initializeCache() {
    if (this._cacheInitialized) return;

    try {
      this._eventsConfigCache = eventsConfig;
      if (typeof eventsConfig.getDaysPerMonth === 'function') {
        this._daysPerMonthCache = eventsConfig.getDaysPerMonth();
        this._cacheInitialized = true;
      }
    } catch (error) {
      console.warn('[TimeManager] Could not initialize cache, using env fallback:', error);
    }

    if (!this._cacheInitialized) {
      this._daysPerMonthCache = this.resolveDaysPerMonthFromEnv();
      this._cacheInitialized = true;
    }
  }

  static async refreshCache() {
    try {
      if (!this._eventsConfigCache) {
        this._eventsConfigCache = eventsConfig;
      }
      if (
        this._eventsConfigCache &&
        typeof this._eventsConfigCache.getDaysPerMonth === 'function'
      ) {
        this._daysPerMonthCache = this._eventsConfigCache.getDaysPerMonth();
      }
    } catch (error) {
      console.warn('[TimeManager] Could not refresh cache:', error);
    }
  }

  static resolveDaysPerMonthFromEnv() {
    let envValue;
    if (
      typeof import.meta !== 'undefined' &&
      import.meta.env &&
      Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_DAYS_PER_MONTH')
    ) {
      envValue = import.meta.env.VITE_DAYS_PER_MONTH;
    } else if (
      typeof window !== 'undefined' &&
      window.__VITE_DAYS_PER_MONTH__ !== undefined
    ) {
      envValue = window.__VITE_DAYS_PER_MONTH__;
    }

    const parsed = parseInt(envValue, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }

    return 1;
  }

  static async getDaysPerMonth() {
    await this.initializeCache();
    return this._daysPerMonthCache || 1;
  }

  static get DAYS_PER_MONTH() {
    if (!this._cacheInitialized && typeof window !== 'undefined' && window.localStorage) {
      try {
        const stored = localStorage.getItem('days_per_month');
        if (stored !== null) {
          const parsed = parseInt(stored, 10);
          if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
            this._daysPerMonthCache = parsed;
            this._cacheInitialized = true;
            return parsed;
          }
        }
      } catch (_error) {
        // ignore
      }
    }

    if (this._daysPerMonthCache !== null) {
      return this._daysPerMonthCache;
    }

    return this.resolveDaysPerMonthFromEnv();
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

  static getTimeInfo(days, daysPerMonth = null) {
    return TimeCalendar.getTimeInfo(
      days,
      daysPerMonth === null ? this.DAYS_PER_MONTH : daysPerMonth
    );
  }

  static formatTime(days, options = {}) {
    return TimeCalendar.formatTime(days, this.DAYS_PER_MONTH, options);
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
