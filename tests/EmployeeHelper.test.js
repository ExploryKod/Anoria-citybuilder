/**
 * Tests pour EmployeeHelper
 * 
 * Ce module gère les données d'employés pour les bâtiments :
 * - Assignation des secteurs d'activité aux bâtiments
 * - Configuration par défaut des besoins en employés
 * - Calcul des salaires
 */

import { 
    getBuildingSector, 
    getDefaultEmployees, 
    calculateSalary,
    updateEmployeeSalary,
    getSectorName 
} from '../src/composition/facades/employment.js';

// ============================================================================
// getBuildingSector - Associe chaque type de bâtiment à un secteur d'emploi
// ============================================================================
describe('getBuildingSector', () => {
    
    describe('Secteur 1 : Production Alimentaire (Fermes)', () => {
        test('Farm-Wheat appartient au secteur 1', () => {
            expect(getBuildingSector('Farm-Wheat')).toBe(1);
        });

        test('Farm-Carrot appartient au secteur 1', () => {
            expect(getBuildingSector('Farm-Carrot')).toBe(1);
        });

        test('Farm-Cabbage appartient au secteur 1', () => {
            expect(getBuildingSector('Farm-Cabbage')).toBe(1);
        });
    });

    describe('Secteur 2 : Commerces (Marchés)', () => {
        test('Market-Stall appartient au secteur 2', () => {
            expect(getBuildingSector('Market-Stall')).toBe(2);
        });
    });

    describe('Secteur 4 : Stockage', () => {
        test('Windmill-001 appartient au secteur 4 (stockage, pas production)', () => {
            expect(getBuildingSector('Windmill-001')).toBe(4);
        });

        test('Barn-001 appartient au secteur 4', () => {
            expect(getBuildingSector('Barn-001')).toBe(4);
        });
    });

    describe('Secteur 5 : Infrastructure', () => {
        test('roads appartient au secteur 5', () => {
            expect(getBuildingSector('roads')).toBe(5);
        });
    });

    describe('Bâtiments résidentiels (secteur 0 = pas d\'emploi)', () => {
        test('House-Blue retourne 0 (résidentiel)', () => {
            expect(getBuildingSector('House-Blue')).toBe(0);
        });

        test('House-Red retourne 0 (résidentiel)', () => {
            expect(getBuildingSector('House-Red')).toBe(0);
        });

        test('House-Purple retourne 0 (résidentiel)', () => {
            expect(getBuildingSector('House-Purple')).toBe(0);
        });
    });

    describe('Cas limites', () => {
        test('type undefined retourne 0', () => {
            expect(getBuildingSector(undefined)).toBe(0);
        });

        test('type null retourne 0', () => {
            expect(getBuildingSector(null)).toBe(0);
        });

        test('type vide retourne 0', () => {
            expect(getBuildingSector('')).toBe(0);
        });

        test('type inconnu retourne 0', () => {
            expect(getBuildingSector('Unknown-Building')).toBe(0);
        });
    });
});

// ============================================================================
// getDefaultEmployees - Configuration par défaut des employés pour un bâtiment
// ============================================================================
describe('getDefaultEmployees', () => {
    
    describe('Fermes - Besoins en travailleurs', () => {
        test('Farm-Wheat nécessite 3 travailleurs, 0 élites', () => {
            const employees = getDefaultEmployees('Farm-Wheat');
            
            expect(employees.worker_need).toBe(3);
            expect(employees.elite_need).toBe(0);
            expect(employees.sector).toBe(1);
        });

        test('les fermes commencent sans employés assignés', () => {
            const employees = getDefaultEmployees('Farm-Carrot');
            
            expect(employees.worker).toBe(0);
            expect(employees.elite).toBe(0);
        });
    });

    describe('Marchés - Besoins mixtes', () => {
        test('Market-Stall nécessite 2 travailleurs et 1 élite', () => {
            const employees = getDefaultEmployees('Market-Stall');
            
            expect(employees.worker_need).toBe(2);
            expect(employees.elite_need).toBe(1);
            expect(employees.sector).toBe(2);
        });
    });

    describe('Moulins - Besoins importants', () => {
        test('Windmill-001 nécessite 4 travailleurs et 2 élites', () => {
            const employees = getDefaultEmployees('Windmill-001');
            
            expect(employees.worker_need).toBe(4);
            expect(employees.elite_need).toBe(2);
            expect(employees.sector).toBe(4);
        });
    });

    describe('Maisons - Pas d\'employés', () => {
        test('House-Blue n\'a pas besoin d\'employés', () => {
            const employees = getDefaultEmployees('House-Blue');
            
            expect(employees.worker_need).toBe(0);
            expect(employees.elite_need).toBe(0);
            expect(employees.worker).toBe(0);
            expect(employees.elite).toBe(0);
            expect(employees.sector).toBe(0);
            expect(employees.salary).toBe(0);
        });
    });

    describe('Structure de l\'objet retourné', () => {
        test('contient toutes les propriétés requises', () => {
            const employees = getDefaultEmployees('Farm-Wheat');
            
            expect(employees).toHaveProperty('worker_need');
            expect(employees).toHaveProperty('elite_need');
            expect(employees).toHaveProperty('worker');
            expect(employees).toHaveProperty('elite');
            expect(employees).toHaveProperty('sector');
            expect(employees).toHaveProperty('salary');
        });

        test('ne contient PAS de propriété priority (géré dans localStorage)', () => {
            const employees = getDefaultEmployees('Farm-Wheat');
            
            expect(employees).not.toHaveProperty('priority');
        });
    });
});

// ============================================================================
// calculateSalary - Calcul du coût salarial basé sur les employés assignés
// ============================================================================
describe('calculateSalary', () => {
    
    describe('Calcul de base (10€ par employé par défaut)', () => {
        test('0 employés = 0€ de salaire', () => {
            const employees = { worker: 0, elite: 0 };
            expect(calculateSalary(employees)).toBe(0);
        });

        test('1 travailleur = 10€', () => {
            const employees = { worker: 1, elite: 0 };
            expect(calculateSalary(employees)).toBe(10);
        });

        test('1 élite = 10€', () => {
            const employees = { worker: 0, elite: 1 };
            expect(calculateSalary(employees)).toBe(10);
        });

        test('3 travailleurs + 2 élites = 50€', () => {
            const employees = { worker: 3, elite: 2 };
            expect(calculateSalary(employees)).toBe(50);
        });
    });

    describe('Calcul avec salaires personnalisés', () => {
        test('travailleurs à 15€, élites à 25€', () => {
            const employees = { worker: 2, elite: 1 };
            expect(calculateSalary(employees, 15, 25)).toBe(55); // 2*15 + 1*25
        });
    });

    describe('Cas limites', () => {
        test('employees null retourne 0', () => {
            expect(calculateSalary(null)).toBe(0);
        });

        test('employees undefined retourne 0', () => {
            expect(calculateSalary(undefined)).toBe(0);
        });

        test('propriétés manquantes traitées comme 0', () => {
            const employees = {}; // Pas de worker ni elite
            expect(calculateSalary(employees)).toBe(0);
        });
    });
});

// ============================================================================
// updateEmployeeSalary - Met à jour le salaire d'un objet employees
// ============================================================================
describe('updateEmployeeSalary', () => {
    
    test('retourne un nouvel objet avec le salaire calculé', () => {
        const employees = { worker: 2, elite: 1, salary: 0 };
        const updated = updateEmployeeSalary(employees);
        
        expect(updated.salary).toBe(30); // 2*10 + 1*10
        expect(updated).not.toBe(employees); // Nouvel objet (immutabilité)
    });

    test('préserve les autres propriétés', () => {
        const employees = { 
            worker: 1, 
            elite: 0, 
            worker_need: 3, 
            sector: 1 
        };
        const updated = updateEmployeeSalary(employees);
        
        expect(updated.worker_need).toBe(3);
        expect(updated.sector).toBe(1);
    });

    test('retourne null si employees est null', () => {
        expect(updateEmployeeSalary(null)).toBe(null);
    });
});

// ============================================================================
// getSectorName - Nom lisible du secteur d'emploi
// ============================================================================
describe('getSectorName', () => {
    
    test('secteur 1 = Production Alimentaire', () => {
        expect(getSectorName(1)).toBe('Production Alimentaire');
    });

    test('secteur 2 = Commerces', () => {
        expect(getSectorName(2)).toBe('Commerces');
    });

    test('secteur 3 = Industries', () => {
        expect(getSectorName(3)).toBe('Industries');
    });

    test('secteur 4 = Stockage', () => {
        expect(getSectorName(4)).toBe('Stockage');
    });

    test('secteur 5 = Infrastructure', () => {
        expect(getSectorName(5)).toBe('Infrastructure');
    });

    test('secteur 6 = Services Publics', () => {
        expect(getSectorName(6)).toBe('Services Publics');
    });

    test('secteur 0 = Résidentiel (maisons)', () => {
        expect(getSectorName(0)).toBe('Résidentiel');
    });

    test('secteur null = Résidentiel', () => {
        expect(getSectorName(null)).toBe('Résidentiel');
    });

    test('secteur inconnu retourne "Secteur X"', () => {
        expect(getSectorName(99)).toBe('Secteur 99');
    });
});

