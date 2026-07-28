/**
 * Tests pour ModuleHelper
 *
 * Ce module fournit des fonctions utilitaires pour :
 * - Vérifier la disponibilité de nourriture
 * - Déterminer si une maison peut évoluer (Blue → Red → Purple → Palace)
 *
 * Accès routier : voir tests/contexts/urban/domain/RoadAccessPolicy.test.js
 */

import {
    checkFoodAvailability,
    canHouseEvolveToPurple,
    canHouseEvolveToPalace
} from '../src/js/game/modules/ModuleHelper.js';

// ============================================================================
// checkFoodAvailability - Vérifie la disponibilité de nourriture
// ============================================================================
describe('checkFoodAvailability', () => {
    
    describe('Calcul du total de nourriture', () => {
        test('additionne tous les types de nourriture', () => {
            const stocks = { wheat: 2, carrot: 3, cabbage: 1 };
            
            const result = checkFoodAvailability(stocks, 0);
            
            expect(result.totalFood).toBe(6);
        });

        test('gère les stocks partiels (certains types à 0)', () => {
            const stocks = { wheat: 5, carrot: 0, cabbage: 0 };
            
            const result = checkFoodAvailability(stocks, 0);
            
            expect(result.totalFood).toBe(5);
        });

        test('stocks vides = 0 nourriture', () => {
            const stocks = { wheat: 0, carrot: 0, cabbage: 0 };
            
            const result = checkFoodAvailability(stocks, 0);
            
            expect(result.totalFood).toBe(0);
            expect(result.hasFood).toBe(false);
        });
    });

    describe('Détection de nourriture disponible', () => {
        test('hasFood: true si au moins 1 unité de nourriture', () => {
            const stocks = { wheat: 1, carrot: 0, cabbage: 0 };
            
            expect(checkFoodAvailability(stocks, 0).hasFood).toBe(true);
        });

        test('hasFood: false si 0 nourriture', () => {
            const stocks = { wheat: 0, carrot: 0, cabbage: 0 };
            
            expect(checkFoodAvailability(stocks, 0).hasFood).toBe(false);
        });
    });

    describe('Calcul du bilan nourriture/population (netFood)', () => {
        test('netFood positif = surplus de nourriture', () => {
            const stocks = { food: 10 }; // Total: 10
            const population = 6;
            
            const result = checkFoodAvailability(stocks, population);
            
            expect(result.netFood).toBe(4); // 10 - 6 = 4 surplus
        });

        test('netFood retourne 0 si déficit (jamais négatif)', () => {
            // L'implémentation retourne 0 au lieu de valeurs négatives
            const stocks = { food: 2 }; // Total: 2
            const population = 5;
            
            const result = checkFoodAvailability(stocks, population);
            
            expect(result.netFood).toBe(0); // Déficit = retourne 0
        });

        test('netFood = 0 si équilibre parfait', () => {
            const stocks = { food: 6 }; // Total: 6
            const population = 6;
            
            const result = checkFoodAvailability(stocks, population);
            
            expect(result.netFood).toBe(0);
        });
    });

    describe('Objectif de nourriture atteint (meetsFoodGoal)', () => {
        // L'objectif est atteint si: population > 5 ET food > population * 2
        test('meetsFoodGoal: true si population > 5 et food > population * 2', () => {
            // Population 6, food doit être > 12
            const stocks = { food: 13 };
            
            expect(checkFoodAvailability(stocks, 6).meetsFoodGoal).toBe(true);
        });

        test('meetsFoodGoal: false si population <= 5', () => {
            const stocks = { food: 20 }; // Beaucoup de nourriture
            
            expect(checkFoodAvailability(stocks, 5).meetsFoodGoal).toBe(false);
        });

        test('meetsFoodGoal: false si nourriture <= population * 2', () => {
            const stocks = { food: 12 }; // = population * 2, pas > 
            
            expect(checkFoodAvailability(stocks, 6).meetsFoodGoal).toBe(false);
        });
    });

    describe('Insuffisance de nourriture (isInsufficient)', () => {
        test('isInsufficient: true si nourriture < population', () => {
            const stocks = { wheat: 2, carrot: 0, cabbage: 0 };
            
            expect(checkFoodAvailability(stocks, 5).isInsufficient).toBe(true);
        });

        test('isInsufficient: false si nourriture >= population', () => {
            const stocks = { wheat: 5, carrot: 0, cabbage: 0 };
            
            expect(checkFoodAvailability(stocks, 5).isInsufficient).toBe(false);
        });
    });
});

// ============================================================================
// canHouseEvolveToPurple - Évolution House-Red → House-Purple
// ============================================================================
describe('canHouseEvolveToPurple', () => {
    
    describe('Conditions d\'évolution réussie', () => {
        test('peut évoluer si toutes les conditions sont remplies', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 6, carrot: 0, cabbage: 0 },
                population: 6,
                buildingType: 'House-Red',
                hasRoadAccess: true
            });
            
            expect(result.canEvolve).toBe(true);
        });
    });

    describe('Condition: doit être une House-Red', () => {
        test('House-Blue ne peut pas évoluer vers Purple', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 6 },
                population: 6,
                buildingType: 'House-Blue',
                hasRoadAccess: true
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('not_house_red');
        });

        test('House-Purple ne peut pas ré-évoluer', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 6 },
                population: 6,
                buildingType: 'House-Purple',
                hasRoadAccess: true
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('not_house_red');
        });
    });

    describe('Condition: doit être habitée (population > 0)', () => {
        test('maison vide ne peut pas évoluer', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 6 },
                population: 0,
                buildingType: 'House-Red',
                hasRoadAccess: true
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('not_inhabited');
        });
    });

    describe('Condition: doit avoir accès à une route', () => {
        test('sans route = pas d\'évolution', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 6 },
                population: 6,
                buildingType: 'House-Red',
                hasRoadAccess: false
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('no_road_access');
        });
    });

    describe('Condition: population > 5 (maison presque pleine)', () => {
        test('population de 5 ne suffit pas (doit être > 5)', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 6 },
                population: 5,
                buildingType: 'House-Red',
                hasRoadAccess: true
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('population_too_low');
        });

        test('population de 6 permet l\'évolution', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 6 },
                population: 6,
                buildingType: 'House-Red',
                hasRoadAccess: true
            });
            
            expect(result.canEvolve).toBe(true);
        });
    });

    describe('Condition: pas de famine (nourriture >= population)', () => {
        test('famine empêche l\'évolution', () => {
            const result = canHouseEvolveToPurple({
                stocks: { wheat: 3 }, // Moins que la population
                population: 6,
                buildingType: 'House-Red',
                hasRoadAccess: true
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('hunger_present');
        });
    });
});

// ============================================================================
// canHouseEvolveToPalace - Évolution House-Purple → House-2Story (Palace)
// Conditions: House-Purple + meetsFoodGoal (pop > 5 ET food > pop * 2) + 2+ types de nourriture
// ============================================================================
describe('canHouseEvolveToPalace', () => {
    
    describe('Conditions d\'évolution réussie', () => {
        test('peut évoluer si toutes les conditions sont remplies', () => {
            // Population 6, food doit être > 12 (pop * 2)
            // Avec 2+ types de nourriture
            const result = canHouseEvolveToPalace({
                stocks: { food: 15, wheat: 8, carrot: 7, cabbage: 0 }, // food=15 > 12, 2 types
                population: 6,
                buildingType: 'House-Purple',
                firstHouses: []
            });
            
            expect(result.canEvolve).toBe(true);
        });
    });

    describe('Condition: doit être une House-Purple', () => {
        test('House-Red ne peut pas devenir Palace directement', () => {
            const result = canHouseEvolveToPalace({
                stocks: { food: 15, wheat: 8, carrot: 7 },
                population: 6,
                buildingType: 'House-Red',
                firstHouses: []
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('not_house_purple');
        });
    });

    describe('Condition: objectif de nourriture (food > population * 2)', () => {
        test('pas assez de nourriture = pas d\'évolution', () => {
            // food = 10, population = 6, besoin > 12
            const result = canHouseEvolveToPalace({
                stocks: { food: 10, wheat: 5, carrot: 5 },
                population: 6,
                buildingType: 'House-Purple',
                firstHouses: []
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('food_goal_not_met');
        });
    });

    describe('Condition: variété alimentaire (au moins 2 types)', () => {
        test('un seul type de nourriture ne suffit pas', () => {
            // Assez de nourriture (15 > 12) mais un seul type
            const result = canHouseEvolveToPalace({
                stocks: { food: 15, wheat: 15, carrot: 0, cabbage: 0 }, // 1 seul type
                population: 6,
                buildingType: 'House-Purple',
                firstHouses: []
            });
            
            expect(result.canEvolve).toBe(false);
            expect(result.reason).toBe('insufficient_food_variety');
        });

        test('deux types de nourriture permettent l\'évolution', () => {
            const result = canHouseEvolveToPalace({
                stocks: { food: 15, wheat: 8, carrot: 7, cabbage: 0 }, // 2 types
                population: 6,
                buildingType: 'House-Purple',
                firstHouses: []
            });
            
            expect(result.canEvolve).toBe(true);
        });

        test('trois types de nourriture permettent l\'évolution', () => {
            const result = canHouseEvolveToPalace({
                stocks: { food: 15, wheat: 5, carrot: 5, cabbage: 5 }, // 3 types
                population: 6,
                buildingType: 'House-Purple',
                firstHouses: []
            });
            
            expect(result.canEvolve).toBe(true);
        });
    });
});

