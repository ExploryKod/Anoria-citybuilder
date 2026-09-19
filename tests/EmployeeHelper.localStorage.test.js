/**
 * Tests pour les priorités d'emploi stockées dans localStorage.
 *
 * 2026-09-10: priorités par SKILL (une par activité, scoped à l'onglet
 * groupe social qui la fournit), pas par secteur global — voir
 * SkillPriorityPolicy.js. Remplace l'ancienne clé `employment_priorities`
 * (secteur -> priorité) par `employment_skill_priorities` (skill id ->
 * priorité) ; l'ancienne clé n'est plus lue du tout.
 */

import {
    getSkillPriority,
    getAllSkillPriorities,
} from '../src/composition/employmentOps.js';

describe('Employment skill priorities — localStorage', () => {

    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('getSkillPriority', () => {

        test('retourne un rang par défaut (entier >= 1) si localStorage est vide', () => {
            const priority = getSkillPriority('fermier');

            expect(Number.isInteger(priority)).toBe(true);
            expect(priority).toBeGreaterThanOrEqual(1);
        });

        test('retourne la priorité depuis localStorage si elle existe', () => {
            localStorage.setItem(
                'employment_skill_priorities',
                JSON.stringify({ fermier: 1, artisanat: 2 }),
            );

            expect(getSkillPriority('fermier')).toBe(1);
            expect(getSkillPriority('artisanat')).toBe(2);
        });

        test('retourne 99 pour un id de skill vide/inconnu', () => {
            expect(getSkillPriority('')).toBe(99);
        });

        test('gère les erreurs de parsing JSON gracieusement', () => {
            const originalWarn = console.warn;
            const warnCalls = [];
            console.warn = (...args) => {
                warnCalls.push(args);
            };

            localStorage.setItem('employment_skill_priorities', 'invalid json{');

            expect(() => getSkillPriority('fermier')).not.toThrow();
            expect(warnCalls.length).toBeGreaterThan(0);

            console.warn = originalWarn;
        });
    });

    describe('getAllSkillPriorities', () => {

        test('couvre chaque skill de chaque onglet, avec des valeurs par défaut si vide', () => {
            const priorities = getAllSkillPriorities();

            // Un skill par onglet (artisans, merchants, scholars, commun).
            expect(priorities.fermier).toBeDefined();
            expect(priorities['vente-alimentaire']).toBeDefined();
            expect(priorities['stockage-alimentaire']).toBeDefined();
            expect(priorities.spiritual).toBeDefined();
        });

        test('reflète les priorités personnalisées stockées', () => {
            localStorage.setItem(
                'employment_skill_priorities',
                JSON.stringify({ fermier: 2, artisanat: 1 }),
            );

            const priorities = getAllSkillPriorities();

            expect(priorities.fermier).toBe(2);
            expect(priorities.artisanat).toBe(1);
        });
    });

    describe('Scénario : la priorité d\'un onglet n\'affecte pas les autres onglets', () => {

        test('deux skills de deux onglets différents peuvent partager le même rang', () => {
            // 'fermier' (onglet artisans) et 'vente-alimentaire' (onglet
            // commerçants) rang 1 chacun — pas de conflit, contrairement à
            // l'ancien système où les priorités étaient uniques sur TOUT le
            // tableau des 6 secteurs.
            localStorage.setItem(
                'employment_skill_priorities',
                JSON.stringify({ fermier: 1, 'vente-alimentaire': 1 }),
            );

            expect(getSkillPriority('fermier')).toBe(1);
            expect(getSkillPriority('vente-alimentaire')).toBe(1);
        });
    });
});
