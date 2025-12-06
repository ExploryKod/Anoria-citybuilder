/**
 * Tests pour EmploymentModule
 * 
 * EmploymentModule gère l'état d'emploi des bâtiments :
 * - Calcul du déficit en travailleurs
 * - Vérification de l'état de recrutement
 * - Calcul du taux d'emploi
 * - Vérification si le bâtiment est complètement pourvu
 * 
 * Fonctions utilitaires simples - facile à tester.
 */

import { EmploymentModule } from '../src/js/game/modules/EmploymentModule.js';

// ============================================================================
// Tests pour EmploymentModule
// ============================================================================
describe('EmploymentModule', () => {
    let employmentModule;

    beforeEach(() => {
        // Créer une nouvelle instance pour chaque test
        employmentModule = new EmploymentModule({});
    });

    // ========================================================================
    // updateFromEmployees - Mise à jour depuis IndexedDB
    // ========================================================================
    describe('updateFromEmployees', () => {
        
        test('met à jour les données d\'emploi depuis un objet complet', () => {
            const employees = { worker: 2, worker_need: 3 };
            
            employmentModule.updateFromEmployees(employees);
            
            expect(employmentModule.employees).toEqual(employees);
        });

        test('utilise des valeurs par défaut si employees est null', () => {
            employmentModule.updateFromEmployees(null);
            
            expect(employmentModule.employees).toEqual({ worker: 0, worker_need: 0 });
        });

        test('utilise des valeurs par défaut si employees est undefined', () => {
            employmentModule.updateFromEmployees(undefined);
            
            expect(employmentModule.employees).toEqual({ worker: 0, worker_need: 0 });
        });

        test('gère les propriétés manquantes', () => {
            employmentModule.updateFromEmployees({ worker: 1 });
            
            expect(employmentModule.employees.worker).toBe(1);
            // Si worker_need n'est pas fourni, il reste undefined (pas remplacé par 0)
            expect(employmentModule.employees.worker_need).toBeUndefined();
        });
    });

    // ========================================================================
    // getWorkerDeficit - Calcul du déficit en travailleurs
    // ========================================================================
    describe('getWorkerDeficit', () => {
        
        test('retourne 0 si le bâtiment est complètement pourvu', () => {
            employmentModule.updateFromEmployees({ worker: 3, worker_need: 3 });
            
            expect(employmentModule.getWorkerDeficit()).toBe(0);
        });

        test('retourne le nombre de travailleurs manquants', () => {
            employmentModule.updateFromEmployees({ worker: 1, worker_need: 3 });
            
            expect(employmentModule.getWorkerDeficit()).toBe(2); // 3 - 1 = 2
        });

        test('retourne 0 si worker > worker_need (sur-effectif)', () => {
            employmentModule.updateFromEmployees({ worker: 5, worker_need: 3 });
            
            expect(employmentModule.getWorkerDeficit()).toBe(0); // Pas de déficit
        });

        test('retourne worker_need si worker = 0', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 3 });
            
            expect(employmentModule.getWorkerDeficit()).toBe(3);
        });

        test('retourne 0 si worker_need = 0 (pas besoin d\'employés)', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 0 });
            
            expect(employmentModule.getWorkerDeficit()).toBe(0);
        });

        test('gère les valeurs undefined comme 0', () => {
            employmentModule.updateFromEmployees({ worker: undefined, worker_need: 3 });
            
            expect(employmentModule.getWorkerDeficit()).toBe(3);
        });
    });

    // ========================================================================
    // needsWorkers - Vérification si le bâtiment a besoin de travailleurs
    // ========================================================================
    describe('needsWorkers', () => {
        
        test('retourne true si déficit > 0', () => {
            employmentModule.updateFromEmployees({ worker: 1, worker_need: 3 });
            
            expect(employmentModule.needsWorkers()).toBe(true);
        });

        test('retourne false si complètement pourvu', () => {
            employmentModule.updateFromEmployees({ worker: 3, worker_need: 3 });
            
            expect(employmentModule.needsWorkers()).toBe(false);
        });

        test('retourne false si pas besoin d\'employés', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 0 });
            
            expect(employmentModule.needsWorkers()).toBe(false);
        });

        test('retourne false si sur-effectif', () => {
            employmentModule.updateFromEmployees({ worker: 5, worker_need: 3 });
            
            expect(employmentModule.needsWorkers()).toBe(false);
        });
    });

    // ========================================================================
    // isFullyStaffed - Vérification si complètement pourvu
    // ========================================================================
    describe('isFullyStaffed', () => {
        
        test('retourne true si worker = worker_need', () => {
            employmentModule.updateFromEmployees({ worker: 3, worker_need: 3 });
            
            expect(employmentModule.isFullyStaffed()).toBe(true);
        });

        test('retourne true si worker > worker_need (sur-effectif)', () => {
            employmentModule.updateFromEmployees({ worker: 5, worker_need: 3 });
            
            expect(employmentModule.isFullyStaffed()).toBe(true);
        });

        test('retourne false si worker < worker_need', () => {
            employmentModule.updateFromEmployees({ worker: 1, worker_need: 3 });
            
            expect(employmentModule.isFullyStaffed()).toBe(false);
        });

        test('retourne true si worker_need = 0', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 0 });
            
            expect(employmentModule.isFullyStaffed()).toBe(true);
        });
    });

    // ========================================================================
    // getEmploymentRate - Calcul du taux d'emploi (0-100%)
    // ========================================================================
    describe('getEmploymentRate', () => {
        
        test('retourne 100% si complètement pourvu', () => {
            employmentModule.updateFromEmployees({ worker: 3, worker_need: 3 });
            
            expect(employmentModule.getEmploymentRate()).toBe(100);
        });

        test('retourne 100% si worker_need = 0 (pas besoin d\'employés)', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 0 });
            
            expect(employmentModule.getEmploymentRate()).toBe(100);
        });

        test('calcule le pourcentage correctement', () => {
            employmentModule.updateFromEmployees({ worker: 2, worker_need: 4 });
            
            expect(employmentModule.getEmploymentRate()).toBe(50); // 2/4 = 50%
        });

        test('retourne 33% pour 1/3', () => {
            employmentModule.updateFromEmployees({ worker: 1, worker_need: 3 });
            
            expect(employmentModule.getEmploymentRate()).toBe(33); // Arrondi
        });

        test('retourne 67% pour 2/3', () => {
            employmentModule.updateFromEmployees({ worker: 2, worker_need: 3 });
            
            expect(employmentModule.getEmploymentRate()).toBe(67); // Arrondi
        });

        test('retourne 0% si aucun travailleur', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 3 });
            
            expect(employmentModule.getEmploymentRate()).toBe(0);
        });

        test('retourne maximum 100% même si sur-effectif', () => {
            employmentModule.updateFromEmployees({ worker: 10, worker_need: 3 });
            
            expect(employmentModule.getEmploymentRate()).toBe(100); // Capped à 100%
        });
    });

    // ========================================================================
    // hasWorkers - Vérification si le bâtiment a des travailleurs
    // ========================================================================
    describe('hasWorkers', () => {
        
        test('retourne true si worker > 0', () => {
            employmentModule.updateFromEmployees({ worker: 1, worker_need: 3 });
            
            expect(employmentModule.hasWorkers()).toBe(true);
        });

        test('retourne false si worker = 0', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 3 });
            
            expect(employmentModule.hasWorkers()).toBe(false);
        });

        test('retourne false si worker est undefined', () => {
            employmentModule.updateFromEmployees({ worker_need: 3 });
            
            expect(employmentModule.hasWorkers()).toBe(false);
        });
    });

    // ========================================================================
    // getWorkerCount / getWorkerNeed - Getters simples
    // ========================================================================
    describe('getWorkerCount / getWorkerNeed', () => {
        
        test('getWorkerCount retourne le nombre de travailleurs', () => {
            employmentModule.updateFromEmployees({ worker: 2, worker_need: 3 });
            
            expect(employmentModule.getWorkerCount()).toBe(2);
        });

        test('getWorkerNeed retourne le besoin en travailleurs', () => {
            employmentModule.updateFromEmployees({ worker: 2, worker_need: 3 });
            
            expect(employmentModule.getWorkerNeed()).toBe(3);
        });

        test('retourne 0 si la propriété est undefined', () => {
            employmentModule.updateFromEmployees({});
            
            expect(employmentModule.getWorkerCount()).toBe(0);
            expect(employmentModule.getWorkerNeed()).toBe(0);
        });
    });

    // ========================================================================
    // toHTML - Génération HTML pour les panneaux d'info
    // ========================================================================
    describe('toHTML', () => {
        
        test('affiche "N/A" si pas besoin d\'employés', () => {
            employmentModule.updateFromEmployees({ worker: 0, worker_need: 0 });
            
            const html = employmentModule.toHTML();
            
            expect(html).toContain('N/A');
        });

        test('affiche le ratio worker / worker_need', () => {
            employmentModule.updateFromEmployees({ worker: 2, worker_need: 3 });
            
            const html = employmentModule.toHTML();
            
            expect(html).toContain('2 / 3');
        });

        test('affiche le taux d\'emploi en pourcentage', () => {
            employmentModule.updateFromEmployees({ worker: 2, worker_need: 4 });
            
            const html = employmentModule.toHTML();
            
            expect(html).toContain('50%'); // 2/4 = 50%
        });

        test('affiche "Ouvriers" et "Taux d\'emploi"', () => {
            employmentModule.updateFromEmployees({ worker: 1, worker_need: 3 });
            
            const html = employmentModule.toHTML();
            
            expect(html).toContain('Ouvriers');
            expect(html).toContain('Taux d\'emploi');
        });
    });
});

