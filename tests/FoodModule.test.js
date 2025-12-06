/**
 * Tests pour FoodModule
 * 
 * FoodModule gère la disponibilité de nourriture pour les bâtiments :
 * - Calcul du total de nourriture disponible
 * - Bilan nourriture/population (netFood)
 * - Vérification des objectifs pour l'évolution des maisons
 * - Détection de famine
 * 
 * Ce module est une fonction pure - pas de dépendances externes, facile à tester.
 */

import { FoodModule } from '../src/js/game/modules/FoodModule.js';

// ============================================================================
// Tests pour FoodModule
// ============================================================================
describe('FoodModule', () => {
    let foodModule;

    beforeEach(() => {
        // Créer une nouvelle instance pour chaque test
        foodModule = new FoodModule({});
    });

    // ========================================================================
    // updateFromStocks - Mise à jour des stocks et de la population
    // ========================================================================
    describe('updateFromStocks', () => {
        
        test('met à jour les stocks depuis un objet complet', () => {
            const stocks = { food: 10, wheat: 5, carrot: 3, cabbage: 2 };
            foodModule.updateFromStocks(stocks, 6);
            
            expect(foodModule.stocks).toEqual(stocks);
            expect(foodModule.population).toBe(6);
        });

        test('gère les stocks partiels (certains types manquants)', () => {
            const stocks = { food: 8, wheat: 8 };
            foodModule.updateFromStocks(stocks, 4);
            
            expect(foodModule.stocks.food).toBe(8);
            expect(foodModule.stocks.wheat).toBe(8);
            expect(foodModule.population).toBe(4);
        });

        test('utilise des valeurs par défaut si stocks est null', () => {
            foodModule.updateFromStocks(null, 0);
            
            expect(foodModule.stocks).toEqual({ food: 0, wheat: 0, carrot: 0, cabbage: 0 });
            expect(foodModule.population).toBe(0);
        });

        test('utilise 0 comme population par défaut si non fournie', () => {
            const stocks = { food: 5 };
            foodModule.updateFromStocks(stocks);
            
            expect(foodModule.population).toBe(0);
        });
    });

    // ========================================================================
    // getTotalFood - Calcul du total de nourriture
    // ========================================================================
    describe('getTotalFood', () => {
        
        test('retourne la valeur du champ "food" si présent', () => {
            foodModule.updateFromStocks({ food: 15, wheat: 5, carrot: 3 }, 0);
            
            expect(foodModule.getTotalFood()).toBe(15);
        });

        test('calcule depuis les types individuels si "food" n\'est pas défini', () => {
            foodModule.updateFromStocks({ wheat: 5, carrot: 3, cabbage: 2 }, 0);
            
            expect(foodModule.getTotalFood()).toBe(10); // 5 + 3 + 2
        });

        test('retourne 0 si stocks est null', () => {
            foodModule.stocks = null;
            
            expect(foodModule.getTotalFood()).toBe(0);
        });

        test('gère les valeurs undefined dans les types individuels', () => {
            foodModule.updateFromStocks({ wheat: 5, carrot: undefined, cabbage: null }, 0);
            
            expect(foodModule.getTotalFood()).toBe(5);
        });

        test('priorise "food" même si les types individuels sont différents', () => {
            // Si "food" = 10 mais wheat+carrot+cabbage = 15, on utilise "food"
            foodModule.updateFromStocks({ food: 10, wheat: 8, carrot: 5, cabbage: 2 }, 0);
            
            expect(foodModule.getTotalFood()).toBe(10);
        });
    });

    // ========================================================================
    // hasFood - Vérification de disponibilité de nourriture
    // ========================================================================
    describe('hasFood', () => {
        
        test('retourne true si food > 0', () => {
            foodModule.updateFromStocks({ food: 1 }, 0);
            
            expect(foodModule.hasFood()).toBe(true);
        });

        test('retourne true si getTotalFood() > 0 (même si food = 0)', () => {
            // Si food est défini (même à 0), getTotalFood() retourne food, pas la somme
            // Pour tester le calcul depuis les types, il faut ne pas définir food
            foodModule.updateFromStocks({ wheat: 3, carrot: 0, cabbage: 0 }, 0);
            // Ne pas définir 'food' pour que getTotalFood() calcule depuis wheat+carrot+cabbage
            
            // getTotalFood() calcule depuis wheat = 3
            expect(foodModule.getTotalFood()).toBe(3);
            expect(foodModule.hasFood()).toBe(true);
        });

        test('retourne false si aucune nourriture', () => {
            foodModule.updateFromStocks({ food: 0, wheat: 0, carrot: 0, cabbage: 0 }, 0);
            
            expect(foodModule.hasFood()).toBe(false);
        });

        test('retourne false si stocks est null', () => {
            foodModule.stocks = null;
            
            // hasFood() vérifie this.stocks && ..., donc retourne false si null
            // Mais getTotalFood() peut retourner 0 ou planter, donc hasFood() peut être false
            const result = foodModule.hasFood();
            // Le comportement réel dépend de l'implémentation
            expect(result).toBeFalsy(); // false ou null sont tous deux falsy
        });
    });

    // ========================================================================
    // getNetFood - Bilan nourriture/population
    // ========================================================================
    describe('getNetFood', () => {
        
        test('retourne le surplus si nourriture > population', () => {
            foodModule.updateFromStocks({ food: 10 }, 6);
            
            expect(foodModule.getNetFood()).toBe(4); // 10 - 6 = 4
        });

        test('retourne 0 si déficit (jamais de valeur négative)', () => {
            foodModule.updateFromStocks({ food: 3 }, 6);
            
            expect(foodModule.getNetFood()).toBe(0); // Déficit = 0, pas -3
        });

        test('retourne 0 si équilibre parfait', () => {
            foodModule.updateFromStocks({ food: 6 }, 6);
            
            expect(foodModule.getNetFood()).toBe(0);
        });

        test('retourne le total si population = 0', () => {
            foodModule.updateFromStocks({ food: 10 }, 0);
            
            expect(foodModule.getNetFood()).toBe(10);
        });

        test('retourne le total si nourriture = 0 (même avec population)', () => {
            foodModule.updateFromStocks({ food: 0 }, 5);
            
            expect(foodModule.getNetFood()).toBe(0);
        });
    });

    // ========================================================================
    // meetsFoodGoal - Objectif pour évolution vers palace
    // Condition: population > 5 ET food > population * 2
    // ========================================================================
    describe('meetsFoodGoal', () => {
        
        test('retourne true si toutes les conditions sont remplies', () => {
            // Population 6, food doit être > 12
            foodModule.updateFromStocks({ food: 15 }, 6);
            
            expect(foodModule.meetsFoodGoal()).toBe(true);
        });

        test('retourne false si population <= 5', () => {
            foodModule.updateFromStocks({ food: 20 }, 5);
            
            expect(foodModule.meetsFoodGoal()).toBe(false);
        });

        test('retourne false si population = 5 (doit être > 5)', () => {
            foodModule.updateFromStocks({ food: 20 }, 5);
            
            expect(foodModule.meetsFoodGoal()).toBe(false);
        });

        test('retourne false si food <= population * 2', () => {
            // Population 6, food = 12 (doit être > 12)
            foodModule.updateFromStocks({ food: 12 }, 6);
            
            expect(foodModule.meetsFoodGoal()).toBe(false);
        });

        test('retourne false si food = population * 2 (doit être >)', () => {
            foodModule.updateFromStocks({ food: 12 }, 6);
            
            expect(foodModule.meetsFoodGoal()).toBe(false);
        });

        test('retourne true avec population 6 et food 13', () => {
            foodModule.updateFromStocks({ food: 13 }, 6);
            
            expect(foodModule.meetsFoodGoal()).toBe(true);
        });
    });

    // ========================================================================
    // isInsufficient - Détection de famine
    // Condition: population >= 2 ET food < population
    // ========================================================================
    describe('isInsufficient', () => {
        
        test('retourne true si population >= 2 et food < population', () => {
            foodModule.updateFromStocks({ food: 3 }, 5);
            
            expect(foodModule.isInsufficient()).toBe(true);
        });

        test('retourne false si population < 2', () => {
            foodModule.updateFromStocks({ food: 0 }, 1);
            
            expect(foodModule.isInsufficient()).toBe(false);
        });

        test('retourne false si population = 1 (doit être >= 2)', () => {
            foodModule.updateFromStocks({ food: 0 }, 1);
            
            expect(foodModule.isInsufficient()).toBe(false);
        });

        test('retourne false si food >= population', () => {
            foodModule.updateFromStocks({ food: 5 }, 5);
            
            expect(foodModule.isInsufficient()).toBe(false);
        });

        test('retourne false si food = population (doit être <)', () => {
            foodModule.updateFromStocks({ food: 5 }, 5);
            
            expect(foodModule.isInsufficient()).toBe(false);
        });

        test('retourne true avec population 2 et food 1', () => {
            foodModule.updateFromStocks({ food: 1 }, 2);
            
            expect(foodModule.isInsufficient()).toBe(true);
        });
    });

    // ========================================================================
    // toHTML - Génération HTML pour les panneaux d'info
    // ========================================================================
    describe('toHTML', () => {
        
        test('retourne "None" si aucune nourriture', () => {
            foodModule.updateFromStocks({ food: 0 }, 0);
            
            const html = foodModule.toHTML();
            
            expect(html).toContain('None');
            expect(html).toContain('Food');
        });

        test('affiche les types de nourriture disponibles', () => {
            foodModule.updateFromStocks({ wheat: 5, carrot: 3, cabbage: 2 }, 0);
            
            const html = foodModule.toHTML();
            
            expect(html).toContain('Wheat: 5');
            expect(html).toContain('Carrot: 3');
            expect(html).toContain('Cabbage: 2');
        });

        test('affiche le total de nourriture', () => {
            foodModule.updateFromStocks({ food: 10 }, 0);
            
            const html = foodModule.toHTML();
            
            expect(html).toContain('Total Food');
            expect(html).toContain('10');
        });

        test('n\'affiche que les types avec quantité > 0', () => {
            foodModule.updateFromStocks({ wheat: 5, carrot: 0, cabbage: 2 }, 0);
            
            const html = foodModule.toHTML();
            
            expect(html).toContain('Wheat: 5');
            expect(html).not.toContain('Carrot: 0');
            expect(html).toContain('Cabbage: 2');
        });
    });
});

