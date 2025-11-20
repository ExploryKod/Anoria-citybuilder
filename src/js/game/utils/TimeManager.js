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
     * Nombre de jours par mois
     * Modifié à 1 pour les tests (permet de passer plus vite d'une saison à l'autre)
     */
    static DAYS_PER_MONTH = 1;

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
        
        // Calculer la saison (chaque saison dure 3 mois = 90 jours)
        const seasonIndex = Math.floor((adjustedDays % (this.DAYS_PER_MONTH * 12)) / (this.DAYS_PER_MONTH * this.MONTHS_PER_SEASON));
        
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
                seasonIndex: 0
            };
        }
        
        return {
            days: days,
            dayInMonth: dayInMonth,
            month: month,
            monthIndex: safeMonthIndex,
            monthNumber: monthNumber,
            season: season,
            seasonIndex: safeSeasonIndex
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
        
        return `${timeInfo.dayInMonth} ${timeInfo.month} | ${timeInfo.season}`;
    }

    /**
     * Formate le temps de manière courte
     * @param {number} days - Nombre de jours écoulés
     * @returns {string} Chaîne formatée courte (ex: "J15 M3 Printemps")
     */
    static formatTimeShort(days) {
        const timeInfo = this.getTimeInfo(days);
        return `J${timeInfo.days} | ${timeInfo.dayInMonth}/${timeInfo.monthNumber} | ${timeInfo.season}`;
    }
}

