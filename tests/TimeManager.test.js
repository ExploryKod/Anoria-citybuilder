/**
 * Tests pour TimeManager
 * 
 * Focus sur les fonctionnalités utilisées dans le jeu :
 * - Calcul du mois (pour la collecte d'impôts en Novembre)
 * - Calcul de l'année (pour éviter la double collecte d'impôts)
 * - Calcul des saisons (pour la production des fermes)
 */

import { TimeManager } from '../src/shared/time/TimeManager.js';
import { formatTime } from '../src/shared/time/TimeCalendar.js';

describe('TimeManager', () => {
    
    // ===== Tests pour getTimeInfo =====
    describe('getTimeInfo', () => {
        
        test('jour 0 retourne Janvier, année 0', () => {
            const result = TimeManager.getTimeInfo(0, 1); // 1 jour par mois
            expect(result.month).toBe('Janvier');
            expect(result.monthIndex).toBe(0);
            expect(result.year).toBe(0);
        });

        test('gère les valeurs invalides (undefined, null, NaN)', () => {
            expect(TimeManager.getTimeInfo(undefined, 1).month).toBe('Janvier');
            expect(TimeManager.getTimeInfo(null, 1).month).toBe('Janvier');
            expect(TimeManager.getTimeInfo(NaN, 1).month).toBe('Janvier');
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
                const result = TimeManager.getTimeInfo(days, 1);
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
                const result = TimeManager.getTimeInfo(days, 1);
                expect(result.season).toBe(expectedSeason);
            });
        });

        // Tests des années (utilisé pour éviter la double collecte d'impôts)
        describe('calcul des années', () => {
            test('12 mois = 1 an (avec 1 jour/mois)', () => {
                const result = TimeManager.getTimeInfo(12, 1);
                expect(result.year).toBe(1);
                expect(result.month).toBe('Janvier');
            });

            test('24 mois = 2 ans', () => {
                const result = TimeManager.getTimeInfo(24, 1);
                expect(result.year).toBe(2);
            });
        });
    });

    // ===== Tests spécifiques pour la collecte d'impôts en Novembre =====
    describe('Novembre - collecte d\'impôts', () => {
        
        test('Novembre est bien le monthIndex 10', () => {
            const result = TimeManager.getTimeInfo(10, 1);
            expect(result.month).toBe('Novembre');
            expect(result.monthIndex).toBe(10);
        });

        test('Novembre fait partie de l\'Automne', () => {
            const result = TimeManager.getTimeInfo(10, 1);
            expect(result.season).toBe('Automne');
        });

        test('tous les jours de Novembre ont la même année (fix du bug des impôts doubles)', () => {
            // Avec 30 jours par mois, simulons le début et la fin de Novembre
            const daysPerMonth = 30;
            const novemberStart = 10 * daysPerMonth; // Premier jour de Novembre
            const novemberEnd = 10 * daysPerMonth + 29; // Dernier jour de Novembre
            
            const startInfo = TimeManager.getTimeInfo(novemberStart, daysPerMonth);
            const endInfo = TimeManager.getTimeInfo(novemberEnd, daysPerMonth);
            
            expect(startInfo.month).toBe('Novembre');
            expect(endInfo.month).toBe('Novembre');
            expect(startInfo.year).toBe(endInfo.year); // Même année = impôts collectés une seule fois
        });

        test('Novembre année 0 et Novembre année 1 ont des années différentes', () => {
            const daysPerMonth = 1;
            const novemberYear0 = 10; // Novembre de l'année 0
            const novemberYear1 = 10 + 12; // Novembre de l'année 1
            
            const year0Info = TimeManager.getTimeInfo(novemberYear0, daysPerMonth);
            const year1Info = TimeManager.getTimeInfo(novemberYear1, daysPerMonth);
            
            expect(year0Info.month).toBe('Novembre');
            expect(year1Info.month).toBe('Novembre');
            expect(year0Info.year).toBe(0);
            expect(year1Info.year).toBe(1);
        });
    });

    // ===== Tests pour l'Automne (marché achète en Automne) =====
    describe('Automne - période d\'achat du marché', () => {
        
        test('Septembre, Octobre, Novembre sont en Automne (seasonIndex 2)', () => {
            const september = TimeManager.getTimeInfo(8, 1);
            const october = TimeManager.getTimeInfo(9, 1);
            const november = TimeManager.getTimeInfo(10, 1);
            
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
