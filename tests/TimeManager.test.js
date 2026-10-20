/**
 * Tests pour TimeManager
 * 
 * Focus sur les fonctionnalités utilisées dans le jeu :
 * - Calcul du mois (pour la collecte d'impôts en Novembre)
 * - Calcul de l'année (pour éviter la double collecte d'impôts)
 * - Calcul des saisons (pour la production des fermes)
 */

import * as TimeCalendar from '../src/shared/time/TimeCalendar.js';
import db from '../src/core/persistence/dexie/db.js';
import {
    describeCalendar,
    getDaysPerMonth,
    getEnvDaysPerMonth,
    getPregameDaysPerMonth,
    initGameCalendar,
    setPregameDaysPerMonth,
    useDaysPerMonthForTests,
    useEnvDaysPerMonthForTests,
} from '../src/config/events.js';
import { TimeManager } from '../src/shared/time/TimeManager.js';
import { formatTime } from '../src/shared/time/TimeCalendar.js';

describe('TimeManager', () => {
    
    // ===== Tests pour getTimeInfo =====
    describe('getTimeInfo', () => {
        
        test('jour 0 retourne Janvier, année 0', () => {
            const result = TimeCalendar.getTimeInfo(0, 1); // 1 jour par mois
            expect(result.month).toBe('Janvier');
            expect(result.monthIndex).toBe(0);
            expect(result.year).toBe(0);
        });

        test('un nombre de tours invalide (undefined, null, NaN, négatif) est une erreur, jamais le jour 0', () => {
            for (const bad of [undefined, null, NaN, Infinity, -1, '3']) {
                expect(() => TimeCalendar.getTimeInfo(bad, 1)).toThrow('days must be a finite number >= 0');
            }
        });

        test('formatTime, saison et âge d\'un bâtiment sont stricts eux aussi', () => {
            expect(() => TimeCalendar.formatTime(undefined, 1)).toThrow('days must be a finite number');
            expect(() => TimeCalendar.getSeasonDisplay('Mousson')).toThrow('unknown season');
            expect(() => TimeCalendar.getSeasonDisplay(undefined)).toThrow('unknown season');
            expect(() => TimeCalendar.getBuildingAge(10, undefined)).toThrow('worldTime must be a finite number');
            expect(() => TimeCalendar.getBuildingAge(undefined, 3)).toThrow('currentTime must be a finite number');
            expect(() => TimeCalendar.getBuildingAge(3, 10)).toThrow('is after the current time');
            expect(TimeCalendar.getBuildingAge(10, 4)).toBe(6);
        });

        // Tests des mois (utilisé pour savoir quand collecter les impôts)
        describe('calcul des mois', () => {
            test.each([
                [0, 'Janvier', 0],
                [1, 'Février', 1],
                [2, 'Mars', 2],
                [3, 'Avril', 3],
                [4, 'Mai', 4],
                [5, 'Juin', 5],
                [6, 'Juillet', 6],
                [7, 'Août', 7],
                [8, 'Septembre', 8],
                [9, 'Octobre', 9],
                [10, 'Novembre', 10],
                [11, 'Décembre', 11],
            ])('jour %i (1 jour/mois) → %s (index %i)', (days, expectedMonth, expectedIndex) => {
                const result = TimeCalendar.getTimeInfo(days, 1);
                expect(result.month).toBe(expectedMonth);
                expect(result.monthIndex).toBe(expectedIndex);
            });
        });

        // Tests des saisons (utilisé pour la production des fermes et le marché)
        describe('calcul des saisons', () => {
            test.each([
                // Hiver : Décembre (11), Janvier (0), Février (1)
                [0, 'Hiver'],   // Janvier
                [1, 'Hiver'],   // Février
                [11, 'Hiver'],  // Décembre
                
                // Printemps : Mars (2), Avril (3), Mai (4)
                [2, 'Printemps'],  // Mars
                [3, 'Printemps'],  // Avril
                [4, 'Printemps'],  // Mai
                
                // Été : Juin (5), Juillet (6), Août (7)
                [5, 'Été'],    // Juin
                [6, 'Été'],    // Juillet
                [7, 'Été'],    // Août
                
                // Automne : Septembre (8), Octobre (9), Novembre (10)
                [8, 'Automne'],   // Septembre
                [9, 'Automne'],   // Octobre
                [10, 'Automne'],  // Novembre
            ])('mois index %i → saison %s', (days, expectedSeason) => {
                const result = TimeCalendar.getTimeInfo(days, 1);
                expect(result.season).toBe(expectedSeason);
            });
        });

        // Tests des années (utilisé pour éviter la double collecte d'impôts)
        describe('calcul des années', () => {
            test('12 mois = 1 an (avec 1 jour/mois)', () => {
                const result = TimeCalendar.getTimeInfo(12, 1);
                expect(result.year).toBe(1);
                expect(result.month).toBe('Janvier');
            });

            test('24 mois = 2 ans', () => {
                const result = TimeCalendar.getTimeInfo(24, 1);
                expect(result.year).toBe(2);
            });
        });
    });

    // ===== Tests spécifiques pour la collecte d'impôts en Novembre =====
    describe('Novembre - collecte d\'impôts', () => {
        
        test('Novembre est bien le monthIndex 10', () => {
            const result = TimeCalendar.getTimeInfo(10, 1);
            expect(result.month).toBe('Novembre');
            expect(result.monthIndex).toBe(10);
        });

        test('Novembre fait partie de l\'Automne', () => {
            const result = TimeCalendar.getTimeInfo(10, 1);
            expect(result.season).toBe('Automne');
        });

        test('tous les jours de Novembre ont la même année (fix du bug des impôts doubles)', () => {
            // Avec 30 jours par mois, simulons le début et la fin de Novembre
            const daysPerMonth = 30;
            const novemberStart = 10 * daysPerMonth; // Premier jour de Novembre
            const novemberEnd = 10 * daysPerMonth + 29; // Dernier jour de Novembre
            
            const startInfo = TimeCalendar.getTimeInfo(novemberStart, daysPerMonth);
            const endInfo = TimeCalendar.getTimeInfo(novemberEnd, daysPerMonth);
            
            expect(startInfo.month).toBe('Novembre');
            expect(endInfo.month).toBe('Novembre');
            expect(startInfo.year).toBe(endInfo.year); // Même année = impôts collectés une seule fois
        });

        test('Novembre année 0 et Novembre année 1 ont des années différentes', () => {
            const daysPerMonth = 1;
            const novemberYear0 = 10; // Novembre de l'année 0
            const novemberYear1 = 10 + 12; // Novembre de l'année 1
            
            const year0Info = TimeCalendar.getTimeInfo(novemberYear0, daysPerMonth);
            const year1Info = TimeCalendar.getTimeInfo(novemberYear1, daysPerMonth);
            
            expect(year0Info.month).toBe('Novembre');
            expect(year1Info.month).toBe('Novembre');
            expect(year0Info.year).toBe(0);
            expect(year1Info.year).toBe(1);
        });
    });

    // ===== Tests pour l'Automne (marché achète en Automne) =====
    describe('Automne - période d\'achat du marché', () => {
        
        test('Septembre, Octobre, Novembre sont en Automne (seasonIndex 2)', () => {
            const september = TimeCalendar.getTimeInfo(8, 1);
            const october = TimeCalendar.getTimeInfo(9, 1);
            const november = TimeCalendar.getTimeInfo(10, 1);
            
            expect(september.seasonIndex).toBe(2);
            expect(october.seasonIndex).toBe(2);
            expect(november.seasonIndex).toBe(2);
        });
    });

    describe('formatTime (HUD)', () => {
        test('abrège le mois (sept., déc.) pour une largeur stable', () => {
            expect(formatTime(8, 1)).toBe('sept. | 0 JC');
            expect(formatTime(11, 1)).toBe('déc. | 0 JC');
            expect(formatTime(0, 1)).toBe('janv. | 0 JC');
            expect(formatTime(8 * 30, 30)).toBe('1 sept. | 0 JC');
        });

        test('expose le mois entier pour les lecteurs d’écran', () => {
            expect(formatTime(8, 1, { abbreviated: false })).toBe('Septembre | 0 JC');
            expect(formatTime(8 * 30, 30, { abbreviated: false })).toBe('1 Septembre | 0 JC');
        });
    });
});


// ===== Calendrier : jours/mois, une seule source, figé en partie =====
describe('calendar — days per month', () => {
    beforeEach(async () => {
        await db.gameSettings.clear();
        localStorage.removeItem('days_per_month');
        useDaysPerMonthForTests(null);
        useEnvDaysPerMonthForTests(5);
    });

    test('a year lasts daysPerMonth × MONTHS_PER_YEAR turns, whatever the setting', () => {
        for (const days of [1, 2, 3, 5, 30]) {
            expect(TimeCalendar.turnsPerYear(days)).toBe(days * TimeCalendar.MONTHS_PER_YEAR);
            expect(TimeCalendar.getTimeInfo(days * TimeCalendar.MONTHS_PER_YEAR, days).year).toBe(1);
            expect(TimeCalendar.getTimeInfo(days * TimeCalendar.MONTHS_PER_YEAR - 1, days).year).toBe(0);
        }
    });

    test('an invalid daysPerMonth is an error, never a guessed month length', () => {
        for (const bad of [0, -1, 1.5, NaN, undefined, null]) {
            expect(() => TimeCalendar.getTimeInfo(10, bad)).toThrow('daysPerMonth must be a positive integer');
        }
    });

    test('.env is the default; a missing or invalid .env value throws', () => {
        expect(getEnvDaysPerMonth()).toBe(5);
        expect(getPregameDaysPerMonth()).toBe(5);
        useEnvDaysPerMonthForTests(null);
        expect(() => getEnvDaysPerMonth()).toThrow('VITE_DAYS_PER_MONTH is not set');
        useEnvDaysPerMonthForTests(31);
        expect(() => getEnvDaysPerMonth()).toThrow('must be an integer in 1..30');
    });

    test('the game reads no calendar before it is loaded', () => {
        expect(() => getDaysPerMonth()).toThrow('calendar is not loaded');
        expect(() => TimeManager.DAYS_PER_MONTH).toThrow('calendar is not loaded');
    });

    test('creating the game freezes the pre-game choice; nothing changes it afterwards', async () => {
        expect(await describeCalendar()).toEqual({ daysPerMonth: 5, frozen: false });
        await setPregameDaysPerMonth(3);
        expect(await initGameCalendar()).toBe(3);
        expect(TimeManager.DAYS_PER_MONTH).toBe(3);
        expect(await describeCalendar()).toEqual({ daysPerMonth: 3, frozen: true });

        await expect(setPregameDaysPerMonth(10)).rejects.toThrow('frozen');
        useEnvDaysPerMonthForTests(7); // .env changes later: the game keeps its own calendar
        useDaysPerMonthForTests(null);
        expect(await initGameCalendar()).toBe(3);
    });

    test('a pre-game choice outside the range is refused', async () => {
        await expect(setPregameDaysPerMonth(0)).rejects.toThrow('must be an integer in 1..30');
        await expect(setPregameDaysPerMonth(31)).rejects.toThrow('must be an integer in 1..30');
        await expect(setPregameDaysPerMonth(2.5)).rejects.toThrow('must be an integer in 1..30');
    });
});
