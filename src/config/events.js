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
 * Configuration du temps via localStorage
 */
const STORAGE_KEY_DAYS_PER_MONTH = 'days_per_month';

/**
 * Récupère la valeur par défaut de VITE_DAYS_PER_MONTH depuis les variables d'environnement
 * @returns {number} Nombre de jours par mois (par défaut 1)
 */
function getDefaultDaysPerMonth() {
    if (typeof import.meta !== 'undefined' && import.meta.env && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_DAYS_PER_MONTH')) {
        const envValue = import.meta.env.VITE_DAYS_PER_MONTH;
        const parsed = parseInt(envValue, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    // Fallback
    if (typeof window !== 'undefined' && window.__VITE_DAYS_PER_MONTH__ !== undefined) {
        const parsed = parseInt(window.__VITE_DAYS_PER_MONTH__, 10);
        if (!isNaN(parsed) && parsed > 0) {
            return parsed;
        }
    }
    // Par défaut, 1 jour par mois
    return 1;
}

/**
 * Récupère le nombre de jours par mois depuis localStorage
 * @returns {number} Nombre de jours par mois (1-30)
 */
export function getDaysPerMonth() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return getDefaultDaysPerMonth();
    }
    
    const stored = localStorage.getItem(STORAGE_KEY_DAYS_PER_MONTH);
    if (stored !== null) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= 30) {
            return parsed;
        }
    }
    
    // Initialiser avec la valeur par défaut
    const defaultValue = getDefaultDaysPerMonth();
    localStorage.setItem(STORAGE_KEY_DAYS_PER_MONTH, String(defaultValue));
    return defaultValue;
}

/**
 * Définit le nombre de jours par mois
 * @param {number} days - Nombre de jours entre 1 et 30
 */
export function setDaysPerMonth(days) {
    const clamped = Math.max(1, Math.min(30, Math.floor(days)));
    if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(STORAGE_KEY_DAYS_PER_MONTH, String(clamped));
    }
}