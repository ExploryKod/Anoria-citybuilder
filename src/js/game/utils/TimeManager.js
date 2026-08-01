/**
 * TimeManager - Gère le système de temps avec jours, mois et saisons
 * 
 * Système de temps (mode test) :
 * - 1 jour = 1 mois (modifié pour les tests, permet de passer plus vite d'une saison à l'autre)
 * - 4 saisons : Printemps, Été, Automne, Hiver
 * - Chaque saison dure 3 mois (3 jours en mode test)
 */
import { registerAppService } from '../../acl/appRuntime.js';

export class TimeManager {
    /**
     * Cache pour éviter les imports répétés
     */
    static _eventsConfigCache = null;
    
    /**
     * Cache synchrone pour DAYS_PER_MONTH (mis à jour depuis localStorage)
     */
    static _daysPerMonthCache = null;
    static _cacheInitialized = false;

    /**
     * Initialise le cache depuis localStorage (appelé au démarrage)
     */
    static async initializeCache() {
        if (this._cacheInitialized) return;
        
        try {
            const eventsConfig = await import('../../../config/events.js');
            this._eventsConfigCache = eventsConfig;
            if (typeof eventsConfig.getDaysPerMonth === 'function') {
                this._daysPerMonthCache = eventsConfig.getDaysPerMonth();
                this._cacheInitialized = true;
            }
        } catch (error) {
            console.warn('[TimeManager] Could not initialize cache, using env fallback:', error);
        }
        
        // Si le cache n'a pas pu être initialisé, utiliser la valeur par défaut
        if (!this._cacheInitialized) {
            this._daysPerMonthCache = this.resolveDaysPerMonthFromEnv();
            this._cacheInitialized = true;
        }
    }

    /**
     * Met à jour le cache depuis localStorage (appelé quand les paramètres changent)
     */
    static async refreshCache() {
        try {
            if (!this._eventsConfigCache) {
                this._eventsConfigCache = await import('../../../config/events.js');
            }
            if (this._eventsConfigCache && typeof this._eventsConfigCache.getDaysPerMonth === 'function') {
                this._daysPerMonthCache = this._eventsConfigCache.getDaysPerMonth();
            }
        } catch (error) {
            console.warn('[TimeManager] Could not refresh cache:', error);
        }
    }

    /**
     * Récupère le nombre de jours par mois depuis les variables d'environnement (fallback)
     */
    static resolveDaysPerMonthFromEnv() {
        let envValue;
        if (typeof import.meta !== 'undefined' && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_DAYS_PER_MONTH')) {
            envValue = import.meta.env.VITE_DAYS_PER_MONTH;
        } else if (typeof window !== 'undefined' && window.__VITE_DAYS_PER_MONTH__ !== undefined) {
            envValue = window.__VITE_DAYS_PER_MONTH__;
        }

        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }

        return 1; // Default
    }

    /**
     * Récupère le nombre de jours par mois depuis localStorage (source of truth)
     * Version asynchrone pour mise à jour dynamique
     */
    static async getDaysPerMonth() {
        await this.initializeCache();
        return this._daysPerMonthCache || 1;
    }

    /**
     * Nombre de jours par mois (synchrone, utilise le cache)
     * Le cache est initialisé au démarrage et mis à jour quand les paramètres changent
     */
    static get DAYS_PER_MONTH() {
        // Initialiser le cache de manière synchrone si possible
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
            } catch (error) {
                // Ignorer les erreurs
            }
        }
        
        // Utiliser le cache ou la valeur par défaut
        if (this._daysPerMonthCache !== null) {
            return this._daysPerMonthCache;
        }
        
        // Fallback vers les variables d'environnement
        return this.resolveDaysPerMonthFromEnv();
    }

    /**
     * Nombre de mois par saison
     */
    static MONTHS_PER_SEASON = 3;

    /**
     * Noms des saisons
     */
    static SEASONS = ['Printemps', 'Été', 'Automne', 'Hiver'];

    /**
     * Noms des mois
     */
    static MONTHS = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];

    /**
     * Calcule les informations de temps à partir du nombre de jours
     * @param {number} days - Nombre de jours écoulés
     * @param {number} daysPerMonth - Nombre de jours par mois (optionnel, utilise DAYS_PER_MONTH si non fourni)
     * @returns {Object} Objet contenant les informations de temps
     */
    static getTimeInfo(days, daysPerMonth = null) {
        // Vérifier que days est un nombre valide
        if (days === undefined || days === null || isNaN(days) || typeof days !== 'number') {
            days = 0; // Valeur par défaut
        }
        
        // S'assurer que days est positif ou zéro
        days = Math.max(0, Math.floor(days));
        
        // Utiliser daysPerMonth fourni ou la valeur depuis le cache
        if (daysPerMonth === null) {
            daysPerMonth = this.DAYS_PER_MONTH;
        }
        
        // Traiter days comme 0-indexed (nombre de jours écoulés depuis le début)
        // Si days = 0 → jour 1 du premier mois
        // Si days = 15 → jour 16 du premier mois
        const adjustedDays = days; // days est déjà 0-indexed
        const dayInMonth = (adjustedDays % daysPerMonth) + 1;
        const monthIndexAdjusted = Math.floor(adjustedDays / daysPerMonth) % 12;
        const monthNumber = Math.floor(adjustedDays / daysPerMonth) + 1;
        
        // Calculer l'année : 12 mois par année
        const year = Math.floor(adjustedDays / (daysPerMonth * 12));
        
        // Calculer la saison selon les mois réels :
        // Automne : Septembre (8), Octobre (9), Novembre (10)
        // Hiver : Décembre (11), Janvier (0), Février (1)
        // Printemps : Mars (2), Avril (3), Mai (4)
        // Été : Juin (5), Juillet (6), Août (7)
        let seasonIndex;
        if (monthIndexAdjusted >= 8 && monthIndexAdjusted <= 10) {
            // Automne : Septembre, Octobre, Novembre
            seasonIndex = 2; // Automne est l'index 2 dans SEASONS
        } else if (monthIndexAdjusted === 11 || monthIndexAdjusted <= 1) {
            // Hiver : Décembre, Janvier, Février
            seasonIndex = 3; // Hiver est l'index 3 dans SEASONS
        } else if (monthIndexAdjusted >= 2 && monthIndexAdjusted <= 4) {
            // Printemps : Mars, Avril, Mai
            seasonIndex = 0; // Printemps est l'index 0 dans SEASONS
        } else {
            // Été : Juin, Juillet, Août
            seasonIndex = 1; // Été est l'index 1 dans SEASONS
        }
        
        // S'assurer que les index sont valides
        const safeMonthIndex = Math.max(0, Math.min(11, monthIndexAdjusted));
        const safeSeasonIndex = Math.max(0, Math.min(3, seasonIndex));
        
        // S'assurer que les valeurs de retour sont toujours définies
        const month = this.MONTHS[safeMonthIndex];
        const season = this.SEASONS[safeSeasonIndex];
        
        if (!month || !season) {
            // Valeurs par défaut si quelque chose ne va pas
            return {
                days: days,
                dayInMonth: 1,
                month: this.MONTHS[0],
                monthIndex: 0,
                monthNumber: 1,
                season: this.SEASONS[0],
                seasonIndex: 0,
                year: 0
            };
        }
        
        return {
            days: days,
            dayInMonth: dayInMonth,
            month: month,
            monthIndex: safeMonthIndex,
            monthNumber: monthNumber,
            season: season,
            seasonIndex: safeSeasonIndex,
            year: year
        };
    }

    /**
     * Formate le temps pour l'affichage
     * @param {number|undefined|null} days - Nombre de jours écoulés
     * @returns {string} Chaîne formatée (ex: "15 Mars | Printemps") ou "Chargement..." si days est invalide
     */
    static formatTime(days) {
        // Vérifier que days est un nombre valide
        if (days === undefined || days === null || isNaN(days) || typeof days !== 'number') {
            return 'Chargement...';
        }
        
        const daysPerMonth = this.DAYS_PER_MONTH;
        const timeInfo = this.getTimeInfo(days, daysPerMonth);
        
        // Vérifier que les valeurs sont définies
        if (!timeInfo.month || !timeInfo.season) {
            return 'Chargement...';
        }
        
        // Formater l'année : 0 JC, 1 ap JC, 2 ap JC, etc.
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

        return `${dateLabel} | ${timeInfo.season} | ${yearDisplay}`;
    }

    /**
     * Formate le temps de manière courte
     * @param {number} days - Nombre de jours écoulés
     * @returns {string} Chaîne formatée courte (ex: "J15 M3 Printemps")
     */
    static formatTimeShort(days) {
        const daysPerMonth = this.DAYS_PER_MONTH;
        const timeInfo = this.getTimeInfo(days, daysPerMonth);
        const showDay = daysPerMonth > 1;
        const dayLabel = showDay ? `J${timeInfo.dayInMonth}` : `M${timeInfo.monthNumber}`;

        return `${dayLabel} | ${timeInfo.month} | ${timeInfo.season}`;
    }

    /**
     * Calculate the age of a building in days
     * Uses worldTime (creation time) as the source of truth
     * @param {number} currentTime - Current game time in days
     * @param {number} worldTime - Building creation time (worldTime field from IndexedDB)
     * @returns {number} Age in days (0 if worldTime is not set or invalid)
     */
    static getBuildingAge(currentTime, worldTime) {
        if (worldTime === undefined || worldTime === null || isNaN(worldTime) || typeof worldTime !== 'number') {
            return 0;
        }
        if (currentTime === undefined || currentTime === null || isNaN(currentTime) || typeof currentTime !== 'number') {
            return 0;
        }
        return Math.max(0, currentTime - worldTime);
    }

    /**
     * Check if a building is old enough for evolution
     * @param {number} currentTime - Current game time in days
     * @param {number} worldTime - Building creation time
     * @param {number} requiredAgeDays - Required age in days (default: 3)
     * @returns {boolean} True if building is old enough
     */
    static isBuildingOldEnough(currentTime, worldTime, requiredAgeDays = 3) {
        const age = this.getBuildingAge(currentTime, worldTime);
        return age > requiredAgeDays;
    }
}

registerAppService('timeManager', TimeManager);