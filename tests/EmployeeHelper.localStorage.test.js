/**
 * Tests pour EmployeeHelper avec mocking de localStorage
 * 
 * Ces tests vérifient la gestion des priorités d'emploi stockées dans localStorage.
 */

import {
    getSectorPriority,
    getAllSectorPriorities
} from '../src/composition/employmentOps.js';

// ============================================================================
// Tests pour les priorités d'emploi (localStorage)
// ============================================================================
describe('EmployeeHelper - localStorage (Priorités)', () => {
    
    beforeEach(() => {
        // Nettoyer localStorage avant chaque test
        localStorage.clear();
    });

    afterEach(() => {
        // Nettoyer après chaque test
        localStorage.clear();
    });

    // ========================================================================
    // getSectorPriority - Récupération de la priorité d'un secteur
    // ========================================================================
    describe('getSectorPriority', () => {
        
        test('retourne la priorité par défaut si localStorage est vide', () => {
            // localStorage vide → utilise les valeurs par défaut de config
            const priority = getSectorPriority(1); // Production Alimentaire
            
            // Priorité par défaut pour secteur 1 = 6 (d'après config)
            expect(priority).toBe(6);
        });

        test('retourne la priorité depuis localStorage si elle existe', () => {
            // Sauvegarder une priorité personnalisée
            const customPriorities = {
                1: 1,  // Production Alimentaire = priorité 1 (la plus haute)
                2: 2   // Commerces = priorité 2
            };
            localStorage.setItem('employment_priorities', JSON.stringify(customPriorities));
            
            const priority = getSectorPriority(1);
            
            expect(priority).toBe(1); // Depuis localStorage, pas la valeur par défaut
        });

        test('retourne 99 pour le secteur 0 (résidentiel)', () => {
            const priority = getSectorPriority(0);
            
            expect(priority).toBe(99); // Priorité la plus basse
        });

        test('gère les erreurs de parsing JSON gracieusement', () => {
            // Mock console.warn pour éviter le bruit dans les logs de test
            const originalWarn = console.warn;
            const warnCalls = [];
            console.warn = (...args) => {
                warnCalls.push(args);
            };
            
            // localStorage corrompu
            localStorage.setItem('employment_priorities', 'invalid json{');
            
            // Ne devrait pas planter, retourne la valeur par défaut
            const priority = getSectorPriority(1);
            
            expect(priority).toBe(6); // Valeur par défaut
            expect(warnCalls.length).toBeGreaterThan(0); // Vérifie que le warning a été loggé
            
            // Restaurer console.warn
            console.warn = originalWarn;
        });
    });

    // ========================================================================
    // getAllSectorPriorities - Récupération de toutes les priorités
    // ========================================================================
    describe('getAllSectorPriorities', () => {
        
        test('retourne les priorités par défaut si localStorage est vide', () => {
            const priorities = getAllSectorPriorities();
            
            // Vérifier que toutes les priorités par défaut sont présentes
            expect(priorities[1]).toBe(6); // Production Alimentaire
            expect(priorities[2]).toBe(5);  // Commerces
            expect(priorities[3]).toBe(4);  // Industries
            expect(priorities[4]).toBe(3);  // Stockage
            expect(priorities[5]).toBe(1);  // Infrastructure
            expect(priorities[6]).toBe(2);  // Services Publics
        });

        test('retourne les priorités depuis localStorage', () => {
            const customPriorities = {
                1: 1,
                2: 2,
                3: 3,
                4: 4,
                5: 5,
                6: 6
            };
            localStorage.setItem('employment_priorities', JSON.stringify(customPriorities));
            
            const priorities = getAllSectorPriorities();
            
            expect(priorities).toEqual(customPriorities);
        });

        test('gère les erreurs de parsing JSON', () => {
            // Mock console.warn pour éviter le bruit dans les logs de test
            const originalWarn = console.warn;
            const warnCalls = [];
            console.warn = (...args) => {
                warnCalls.push(args);
            };
            
            localStorage.setItem('employment_priorities', 'invalid');
            
            // Ne devrait pas planter, retourne les valeurs par défaut
            const priorities = getAllSectorPriorities();
            
            expect(priorities[1]).toBe(6); // Valeur par défaut
            expect(warnCalls.length).toBeGreaterThan(0); // Vérifie que le warning a été loggé
            
            // Restaurer console.warn
            console.warn = originalWarn;
        });
    });

    // ========================================================================
    // Scénario réel : Changement de priorités par l'utilisateur
    // ========================================================================
    describe('Scénario : Modification des priorités par l\'utilisateur', () => {
        
        test('simule un changement de priorité dans le panneau admin', () => {
            // État initial : priorités par défaut
            let priority1 = getSectorPriority(1);
            expect(priority1).toBe(6); // Production Alimentaire = priorité 6
            
            // L'utilisateur change la priorité du secteur 1 à 1 (la plus haute)
            const updatedPriorities = {
                1: 1,  // Production Alimentaire = priorité 1
                2: 5,  // Commerces = priorité 5
                3: 4,  // Industries = priorité 4
                4: 3,  // Stockage = priorité 3
                5: 2,  // Infrastructure = priorité 2
                6: 6   // Services Publics = priorité 6
            };
            localStorage.setItem('employment_priorities', JSON.stringify(updatedPriorities));
            
            // Vérifier que le changement est pris en compte
            priority1 = getSectorPriority(1);
            expect(priority1).toBe(1); // Nouvelle priorité
            
            // Vérifier que les autres secteurs sont inchangés
            expect(getSectorPriority(2)).toBe(5);
            expect(getSectorPriority(3)).toBe(4);
        });
    });
});

