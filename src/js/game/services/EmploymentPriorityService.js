import { SimService } from './SimService.js';
import config from '../config.js';

/**
 * EmploymentPriorityService - Manages employment priority settings
 * 
 * NEW SIMPLIFIED ARCHITECTURE:
 * - Priority is stored ONLY in localStorage (not in IndexedDB)
 * - Buildings store their sector in IndexedDB (static, set at creation)
 * - At worker distribution time, priority is looked up from localStorage based on sector
 * 
 * This service handles:
 * 1. Initializing localStorage with default priorities on first run
 * 2. Priority swapping when admin changes sector priority
 * 3. Providing priority data to UI
 * 
 * NO IndexedDB updates needed - priority changes are instant via localStorage!
 */
export class EmploymentPriorityService extends SimService {
    /**
     * Storage key for employment priorities
     */
    PRIORITIES_STORAGE_KEY = 'employment_priorities';
    
    /**
     * Ensures localStorage has priority data initialized
     * Called each game tick to ensure defaults are set
     * 
     * @param {City} city - City object
     * @param {HousesStore} housesStore - Database store (not used for priority anymore)
     * @param {number} time - Current simulation time
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        try {
            // Ensure localStorage has priorities initialized
            const userPriorities = this.getUserPriorities();
            
            if (!userPriorities || Object.keys(userPriorities).length === 0) {
                // First run - initialize with defaults from config
                const defaultPriorities = config.employment?.defaultPriorities || {};
                this.saveUserPriorities(defaultPriorities);
                console.log('[EmploymentPriorityService] Initialized localStorage with default priorities:', defaultPriorities);
            }
            
            // No IndexedDB updates needed anymore!
            // Priority is looked up at runtime by EmploymentDistributionService
            
        } catch (error) {
            console.error('[EmploymentPriorityService] Error:', {
                error: error?.message || error,
                time
            });
        }
    }

    /**
     * Get user-set priorities from localStorage
     * @returns {Object} Map of sector number -> priority value
     */
    getUserPriorities() {
        try {
            const stored = localStorage.getItem(this.PRIORITIES_STORAGE_KEY);
            if (stored) {
                return JSON.parse(stored);
            }
        } catch (err) {
            console.warn('[EmploymentPriorityService] Error reading priorities from localStorage:', err);
        }
        return {};
    }

    /**
     * Save user-set priorities to localStorage
     * @param {Object} priorities - Map of sector number -> priority value
     */
    saveUserPriorities(priorities) {
        try {
            localStorage.setItem(this.PRIORITIES_STORAGE_KEY, JSON.stringify(priorities));
            console.log('[EmploymentPriorityService] Saved priorities to localStorage:', priorities);
        } catch (err) {
            console.error('[EmploymentPriorityService] Error saving priorities to localStorage:', err);
        }
    }

    /**
     * Update priority for a specific sector with Caesar 3-style swapping
     * When a priority is changed, it swaps with the sector that had the old priority
     * 
     * INSTANT UPDATE - Only localStorage, no IndexedDB needed!
     * 
     * @param {number} sector - Sector number
     * @param {number} newPriority - New priority value (1 to max sectors, 1 = highest)
     */
    updateSectorPrioritySync(sector, newPriority) {
        const priorities = this.getUserPriorities();
        const maxSectors = config.employment?.maxSectors || 6;
        
        // Clamp priority to valid range (1 to max sectors)
        const clampedPriority = Math.max(1, Math.min(maxSectors, newPriority));
        
        // Get current priority for this sector
        const defaultPriorities = config.employment?.defaultPriorities || {};
        const currentPriority = priorities[sector] !== undefined 
            ? priorities[sector] 
            : (defaultPriorities[sector] || 1);
        
        console.log(`[EmploymentPriorityService] Updating sector ${sector}: ${currentPriority} → ${clampedPriority}`);
        
        // If priority hasn't changed, do nothing
        if (currentPriority === clampedPriority) {
            return;
        }
        
        // Find which sector currently has the new priority (for swapping)
        const sectors = config.employment?.sectors || {};
        let sectorWithNewPriority = null;
        
        for (const [secNumStr] of Object.entries(sectors)) {
            const secNum = parseInt(secNumStr, 10);
            if (secNum === sector) continue;
            
            const currentSecPriority = priorities[secNum] !== undefined 
                ? priorities[secNum] 
                : (defaultPriorities[secNum] || 1);
            
            if (currentSecPriority === clampedPriority) {
                sectorWithNewPriority = secNum;
                break;
            }
        }
        
        // Perform the swap
        priorities[sector] = clampedPriority;
        if (sectorWithNewPriority !== null) {
            priorities[sectorWithNewPriority] = currentPriority;
            console.log(`[EmploymentPriorityService] Swapped: Sector ${sector} ↔ Sector ${sectorWithNewPriority}`);
        }
        
        // Save immediately to localStorage
        this.saveUserPriorities(priorities);
        
        // Effect is INSTANT - next worker distribution will use new priorities!
        console.log('[EmploymentPriorityService] ✅ Priority updated instantly in localStorage');
    }

    /**
     * Get priority for a specific sector
     * @param {number} sector - Sector number
     * @returns {number} Priority value (1 = highest priority)
     */
    getSectorPriority(sector) {
        const priorities = this.getUserPriorities();
        const defaultPriorities = config.employment?.defaultPriorities || {};
        return priorities[sector] !== undefined 
            ? priorities[sector] 
            : (defaultPriorities[sector] || 1);
    }

    /**
     * Get all sector priorities
     * @returns {Object} Map of sector number -> priority value
     */
    getAllPriorities() {
        const userPriorities = this.getUserPriorities();
        const defaultPriorities = config.employment?.defaultPriorities || {};
        const sectors = config.employment?.sectors || {};
        
        // Merge user priorities with defaults (user takes precedence)
        const allPriorities = {};
        for (const [sectorNum] of Object.entries(sectors)) {
            const secNum = parseInt(sectorNum, 10);
            allPriorities[secNum] = userPriorities[secNum] !== undefined 
                ? userPriorities[secNum] 
                : (defaultPriorities[secNum] || 1);
        }
        
        return allPriorities;
    }
}
