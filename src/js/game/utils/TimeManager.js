/**
 * TimeManager - Gère le système de temps avec jours, mois et saisons
 * 
 * Système de temps (mode test) :
 * - 1 jour = 1 mois (modifié pour les tests, permet de passer plus vite d'une saison à l'autre)
 * - 4 saisons : Printemps, Été, Automne, Hiver
 * - Chaque saison dure 3 mois (3 jours en mode test)
 */
export class TimeManager {
    /**
     * Resolve days per month from environment variables
     * Allows switching between test/prod via VITE_DAYS_PER_MONTH
     */
    static resolveDaysPerMonth() {
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

        // Default fallback (test mode)
        return 1;
    }

    /**
     * Nombre de jours par mois
     * Modifié à 1 pour les tests (permet de passer plus vite d'une saison à l'autre)
     */
    static DAYS_PER_MONTH = TimeManager.resolveDaysPerMonth();

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
     * @returns {Object} Objet contenant les informations de temps
     */
    static getTimeInfo(days) {
        // Vérifier que days est un nombre valide
        if (days === undefined || days === null || isNaN(days) || typeof days !== 'number') {
            days = 0; // Valeur par défaut
        }
        
        // S'assurer que days est positif ou zéro
        days = Math.max(0, Math.floor(days));
        
        // Traiter days comme 0-indexed (nombre de jours écoulés depuis le début)
        // Si days = 0 → jour 1 du premier mois
        // Si days = 15 → jour 16 du premier mois
        const adjustedDays = days; // days est déjà 0-indexed
        const dayInMonth = (adjustedDays % this.DAYS_PER_MONTH) + 1;
        const monthIndexAdjusted = Math.floor(adjustedDays / this.DAYS_PER_MONTH) % 12;
        const monthNumber = Math.floor(adjustedDays / this.DAYS_PER_MONTH) + 1;
        
        // Calculer l'année : 12 mois par année
        const year = Math.floor(adjustedDays / (this.DAYS_PER_MONTH * 12));
        
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
        
        const timeInfo = this.getTimeInfo(days);
        
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
        
        const showDay = this.DAYS_PER_MONTH > 1;
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
        const timeInfo = this.getTimeInfo(days);
        const showDay = this.DAYS_PER_MONTH > 1;
        const dayLabel = showDay ? `J${timeInfo.dayInMonth}` : `M${timeInfo.monthNumber}`;

        return `${dayLabel} | ${timeInfo.month} | ${timeInfo.season}`;
    }
}

