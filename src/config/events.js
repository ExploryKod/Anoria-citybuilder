import db from '../core/persistence/dexie/db.js';

/**
 * Configuration des événements aléatoires via localStorage
 * Permet de contrôler la probabilité et l'activation des événements
 */

const STORAGE_KEY_EVENTS_ENABLED = 'events_enabled';
const STORAGE_KEY_EVENT_PROBABILITY = 'event_probability';

/**
 * Récupère la valeur par défaut de VITE_IS_EVENTS depuis les variables d'environnement
 * @returns {boolean} true si les événements sont activés par défaut
 */
function getDefaultEventsEnabled() {
    if (typeof import.meta !== 'undefined' && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_IS_EVENTS')) {
        return String(import.meta.env.VITE_IS_EVENTS).toLowerCase() !== 'false';
    }
    // Fallback (utile dans certains contextes de tests)
    if (typeof window !== 'undefined' && window.__VITE_IS_EVENTS__ !== undefined) {
        return String(window.__VITE_IS_EVENTS__).toLowerCase() !== 'false';
    }
    // Par défaut, les événements sont activés
    return true;
}

/**
 * Récupère la valeur par défaut de la probabilité depuis les variables d'environnement
 * Si VITE_IS_EVENTS_TEST est true, retourne 100 (100%), sinon 5 (5%)
 * @returns {number} Probabilité entre 0 et 100
 */
function getDefaultEventProbability() {
    // Vérifier si on est en mode test
    let isTestMode = false;
    if (typeof import.meta !== 'undefined' && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_IS_EVENTS_TEST')) {
        isTestMode = String(import.meta.env.VITE_IS_EVENTS_TEST).toLowerCase() === 'true';
    } else if (typeof window !== 'undefined' && window.__VITE_IS_EVENTS_TEST__ !== undefined) {
        isTestMode = String(window.__VITE_IS_EVENTS_TEST__).toLowerCase() === 'true';
    }
    
    // Si mode test, 100% de probabilité, sinon 5%
    return isTestMode ? 100 : 5;
}

/**
 * Vérifie si les événements sont activés
 * Lit depuis localStorage, avec fallback sur les variables d'environnement
 * @returns {boolean} true si les événements sont activés
 */
export function isEventsEnabled() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return getDefaultEventsEnabled();
    }
    
    const stored = localStorage.getItem(STORAGE_KEY_EVENTS_ENABLED);
    if (stored !== null) {
        return stored === 'true';
    }
    
    // Initialiser avec la valeur par défaut
    const defaultValue = getDefaultEventsEnabled();
    localStorage.setItem(STORAGE_KEY_EVENTS_ENABLED, String(defaultValue));
    return defaultValue;
}

/**
 * Active ou désactive les événements
 * @param {boolean} enabled - true pour activer, false pour désactiver
 */
export function setEventsEnabled(enabled) {
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_EVENTS_ENABLED, String(enabled));
    }
}

/**
 * Récupère la probabilité d'événement (en pourcentage, 0-100)
 * Lit depuis localStorage, avec fallback sur les variables d'environnement
 * @returns {number} Probabilité entre 0 et 100
 */
export function getEventProbability() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return getDefaultEventProbability();
    }
    
    const stored = localStorage.getItem(STORAGE_KEY_EVENT_PROBABILITY);
    if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
            return parsed;
        }
    }
    
    // Initialiser avec la valeur par défaut
    const defaultValue = getDefaultEventProbability();
    localStorage.setItem(STORAGE_KEY_EVENT_PROBABILITY, String(defaultValue));
    return defaultValue;
}

/**
 * Définit la probabilité d'événement (en pourcentage, 0-100)
 * @param {number} probability - Probabilité entre 0 et 100
 */
export function setEventProbability(probability) {
    const clamped = Math.max(0, Math.min(100, Math.floor(probability)));
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_EVENT_PROBABILITY, String(clamped));
    }
}

/**
 * Calendrier : nombre de jours (tours) par mois — UNE seule source de vérité par moment de vie :
 *
 *  - `.env` (VITE_DAYS_PER_MONTH) : la valeur par défaut, source de vérité des données transverses du jeu.
 *  - Avant la partie : le joueur peut la changer dans les paramètres de la page racine
 *    (`getPregameDaysPerMonth` / `setPregameDaysPerMonth`, localStorage). Sans choix du joueur, c'est `.env`.
 *  - À la création de la partie (`initGameCalendar`, appelé quand les hameaux sont créés) la valeur est
 *    FIGÉE dans IndexedDB (`gameSettings`/`calendar`). Pendant la partie, `getDaysPerMonth()` rend cette valeur
 *    et rien ne peut la modifier : une année vaut `jours/mois × MONTHS_PER_YEAR` tours, et changer ce nombre
 *    réinterpréterait tout l'historique (journal, saisons, échéances).
 *  - Réinitialiser la partie efface IndexedDB et localStorage : on repart de `.env`.
 */
const STORAGE_KEY_DAYS_PER_MONTH = 'days_per_month';
export const CALENDAR_SETTING_NAME = 'calendar';

export const DAYS_PER_MONTH_MIN = 1;
export const DAYS_PER_MONTH_MAX = 30;

/** @param {unknown} days @param {string} source */
function assertDaysPerMonthInRange(days, source) {
    if (!Number.isInteger(days) || days < DAYS_PER_MONTH_MIN || days > DAYS_PER_MONTH_MAX) {
        throw new Error(
            `[calendar] days per month from ${source} must be an integer in ${DAYS_PER_MONTH_MIN}..${DAYS_PER_MONTH_MAX}, got ${days}`
        );
    }
    return days;
}

/** @type {number | null} */
let envDaysPerMonthForTests = null;

/**
 * La valeur de `.env` (VITE_DAYS_PER_MONTH). Lève si elle manque ou est invalide : aucune valeur de repli.
 * @returns {number}
 */
export function getEnvDaysPerMonth() {
    let raw;
    if (envDaysPerMonthForTests !== null) {
        raw = envDaysPerMonthForTests;
    } else if (typeof import.meta !== 'undefined' && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_DAYS_PER_MONTH')) {
        raw = import.meta.env.VITE_DAYS_PER_MONTH;
    } else if (typeof window !== 'undefined' && window.__VITE_DAYS_PER_MONTH__ !== undefined) {
        raw = window.__VITE_DAYS_PER_MONTH__;
    }
    if (raw === undefined || raw === '') {
        throw new Error('[calendar] VITE_DAYS_PER_MONTH is not set: declare it in .env');
    }
    return assertDaysPerMonthInRange(Number(raw), 'VITE_DAYS_PER_MONTH');
}

/**
 * La valeur choisie avant la partie (paramètres de la page racine), sinon celle de `.env`.
 * @returns {number}
 */
export function getPregameDaysPerMonth() {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY_DAYS_PER_MONTH) ?? null;
    if (stored === null) {
        return getEnvDaysPerMonth();
    }
    return assertDaysPerMonthInRange(Number(stored), `localStorage "${STORAGE_KEY_DAYS_PER_MONTH}"`);
}

/** @returns {Promise<boolean>} true once a game exists: the calendar is then frozen. */
export async function isCalendarFrozen() {
    return Boolean(await db.gameSettings.get(CALENDAR_SETTING_NAME));
}

/**
 * Change the pre-game choice. Refused once the game exists.
 * @param {number} days
 */
export async function setPregameDaysPerMonth(days) {
    assertDaysPerMonthInRange(days, 'the settings form');
    if (await isCalendarFrozen()) {
        throw new Error('[calendar] days per month is frozen: a game is in progress, reset the game to change it');
    }
    globalThis.localStorage.setItem(STORAGE_KEY_DAYS_PER_MONTH, String(days));
}

/**
 * What the settings screens show, without creating the game: the frozen value when a game exists,
 * otherwise the value that will be frozen (the pre-game choice, `.env` by default).
 * @returns {Promise<{ daysPerMonth: number, frozen: boolean }>}
 */
export async function describeCalendar() {
    const row = await db.gameSettings.get(CALENDAR_SETTING_NAME);
    if (row) {
        return { daysPerMonth: assertDaysPerMonthInRange(row.daysPerMonth, 'the frozen game calendar'), frozen: true };
    }
    return { daysPerMonth: getPregameDaysPerMonth(), frozen: false };
}

/** @type {number | null} */
let gameDaysPerMonth = null;

/**
 * Load the game's calendar; freeze it from the pre-game value when the game has none yet.
 * @returns {Promise<number>}
 */
export async function initGameCalendar() {
    const row = await db.gameSettings.get(CALENDAR_SETTING_NAME);
    if (row) {
        gameDaysPerMonth = assertDaysPerMonthInRange(row.daysPerMonth, 'the frozen game calendar');
        return gameDaysPerMonth;
    }
    const days = getPregameDaysPerMonth();
    await db.gameSettings.put({ name: CALENDAR_SETTING_NAME, daysPerMonth: days });
    gameDaysPerMonth = days;
    return days;
}

/**
 * The game's days (turns) per month. Throws until `initGameCalendar()` has run: the game must not start
 * with a guessed calendar.
 * @returns {number}
 */
export function getDaysPerMonth() {
    if (gameDaysPerMonth === null) {
        throw new Error('[calendar] the game calendar is not loaded: initGameCalendar() must run before the game reads the time');
    }
    return gameDaysPerMonth;
}

/**
 * Test seam: stand in for the `.env` value (Jest has no Vite env).
 * @param {number | null} days
 */
export function useEnvDaysPerMonthForTests(days) {
    envDaysPerMonthForTests = days;
}

/**
 * Test seam: set the game's calendar in memory, without the database (null = not loaded).
 * @param {number | null} days
 */
export function useDaysPerMonthForTests(days) {
    gameDaysPerMonth = days === null ? null : assertDaysPerMonthInRange(days, 'the test seam');
}

/**
 * Récupère les fonds initiaux depuis les variables d'environnement
 * @returns {number} Montant des fonds initiaux (par défaut 500)
 */
export function getInitialFunds() {
    if (typeof import.meta !== 'undefined' && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_INITIAL_FUNDS')) {
        const envValue = import.meta.env.VITE_INITIAL_FUNDS;
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed >= 0) {
            return parsed;
        }
    }
    // Fallback
    if (typeof window !== 'undefined' && window.__VITE_INITIAL_FUNDS__ !== undefined) {
        const parsed = parseInt(window.__VITE_INITIAL_FUNDS__, 10);
        if (!isNaN(parsed) && parsed >= 0) {
            return parsed;
        }
    }
    // Par défaut, 500 fonds
    return 500;
}