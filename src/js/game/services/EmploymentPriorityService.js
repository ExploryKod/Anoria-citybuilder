import { SimService } from './SimService.js';
import config from '../config.js';

/**
 * EmploymentPriorityService - Updates building employee priorities based on user settings
 * 
 * This service runs at each game turn and updates all buildings' employee priorities
 * based on the user-set priorities for each employment sector in the work board panel.
 * 
 * Priority values are stored in localStorage and applied to all buildings matching
 * each sector. Priorities are unique (1 to max sectors) and managed by priority swapping.
 */
export class EmploymentPriorityService extends SimService {
    /**
     * Storage key for employment priorities
     */
    PRIORITIES_STORAGE_KEY = 'employment_priorities';
    
    /**
     * HousesStore reference (set during initialization)
     * @type {HousesStore|null}
     */
    housesStore = null;
    
    /**
     * Set housesStore reference for immediate updates
     * @param {HousesStore} housesStore - Database store
     */
    setHousesStore(housesStore) {
        this.housesStore = housesStore;
    }

    /**
     * Processes employment priority updates city-wide
     * 
     * @param {City} city - City object
     * @param {HousesStore} housesStore - Database store (IndexedDB source of truth)
     * @param {number} time - Current simulation time (number of days)
     * @returns {Promise<void>}
     */
    async simulate(city, housesStore, time = 0) {
        try {
            // Get user-set priorities from localStorage
            const userPriorities = this.getUserPriorities();
            
            // If no priorities set, use defaults from config
            if (!userPriorities || Object.keys(userPriorities).length === 0) {
                const defaultPriorities = config.employment?.defaultPriorities || {};
                this.saveUserPriorities(defaultPriorities);
                return; // First run, just save defaults, don't update buildings yet
            }

            // Get all buildings from IndexedDB
            const houses = await housesStore.listAllHouses();
            
            // Update priorities for each building based on its sector
            const updatePromises = [];
            
            for (const house of houses) {
                if (!house.employees) {
                    // Skip buildings without employee data (shouldn't happen, but safety check)
                    continue;
                }
                
                const buildingSector = house.employees.sector || 0;
                
                // Skip residential buildings (sector 0) - they don't need priority updates
                if (buildingSector === 0) {
                    continue;
                }
                
                // Get priority for this sector from user settings
                const sectorPriority = userPriorities[buildingSector];
                
                // Only update if priority has changed
                if (sectorPriority !== undefined && house.employees.priority !== sectorPriority) {
                    updatePromises.push(
                        housesStore.updateHouseFields(house.name, {
                            employees: {
                                ...house.employees,
                                priority: sectorPriority
                            }
                        }).catch(err => {
                            console.warn('[EmploymentPriorityService] Failed to update priority for building:', {
                                buildingId: house.name,
                                sector: buildingSector,
                                error: err?.message || err
                            });
                        })
                    );
                }
            }
            
            // Wait for all updates to complete
            await Promise.allSettled(updatePromises);
            
            if (updatePromises.length > 0) {
                console.log('[EmploymentPriorityService] Updated priorities for', updatePromises.length, 'buildings');
            }
        } catch (error) {
            console.error('[EmploymentPriorityService] Error processing priority updates:', {
                error: error?.message || error,
                time,
                stack: error?.stack
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
        } catch (err) {
            console.error('[EmploymentPriorityService] Error saving priorities to localStorage:', err);
        }
    }

    /**
     * Update priority for a specific sector with Caesar 3-style swapping
     * When a priority is changed, it swaps with the sector that had the old priority
     * @param {number} sector - Sector number
     * @param {number} newPriority - New priority value (1 to max sectors)
     * @param {HousesStore} housesStore - Database store (optional, for immediate updates)
     */
    async updateSectorPriority(sector, newPriority, housesStore = null) {
        const priorities = this.getUserPriorities();
        // Get max sectors directly from config (source of truth)
        const maxSectors = config.employment?.maxSectors || 6;
        
        // Clamp priority to valid range (1 to max sectors)
        const clampedPriority = Math.max(1, Math.min(maxSectors, newPriority));
        
        // Get current priority for this sector
        const currentPriority = priorities[sector] || config.employment?.defaultPriorities?.[sector] || 1;
        
        // If priority hasn't changed, do nothing
        if (currentPriority === clampedPriority) {
            return; // No change needed
        }
        
        // Find which sector currently has the new priority (if any)
        let sectorWithNewPriority = null;
        for (const [secNum, secPriority] of Object.entries(priorities)) {
            if (parseInt(secNum, 10) !== sector && secPriority === clampedPriority) {
                sectorWithNewPriority = parseInt(secNum, 10);
                break;
            }
        }
        
        // If no sector has the new priority, check defaults
        if (!sectorWithNewPriority) {
            const defaultPriorities = config.employment?.defaultPriorities || {};
            for (const [secNum, secPriority] of Object.entries(defaultPriorities)) {
                const sec = parseInt(secNum, 10);
                if (sec !== sector && 
                    secPriority === clampedPriority && 
                    priorities[sec] === undefined) {
                    sectorWithNewPriority = sec;
                    break;
                }
            }
        }
        
        // Swap priorities: this sector gets new priority, other sector gets old priority
        priorities[sector] = clampedPriority;
        if (sectorWithNewPriority !== null) {
            priorities[sectorWithNewPriority] = currentPriority;
        }
        
        this.saveUserPriorities(priorities);
        
        console.log('[EmploymentPriorityService] Updated priority for sector', sector, 'to', clampedPriority, 
                   sectorWithNewPriority !== null ? `(swapped with sector ${sectorWithNewPriority})` : '');
        
        // Immediately update all buildings with the new priority (don't wait for next turn)
        await this.updateBuildingsImmediately(sector, clampedPriority, sectorWithNewPriority, currentPriority, housesStore);
    }
    
    /**
     * Immediately update all buildings' priorities when sector priority changes
     * This ensures buildings are updated right away, not waiting for next game turn
     * @param {number} changedSector - Sector that had its priority changed
     * @param {number} newPriority - New priority value
     * @param {number|null} swappedSector - Sector that was swapped (if any)
     * @param {number} oldPriority - Old priority value (for swapped sector)
     * @param {HousesStore} housesStore - Database store (optional, will try to get from window if not provided)
     */
    async updateBuildingsImmediately(changedSector, newPriority, swappedSector, oldPriority, housesStore = null) {
        try {
            // Get housesStore from parameter, instance variable, window, or app registry
            if (!housesStore) {
                housesStore = this.housesStore;
            }
            
            if (!housesStore) {
                if (window.app && window.app.housesStore) {
                    housesStore = window.app.housesStore;
                } else if (window.housesStore) {
                    housesStore = window.housesStore;
                } else if (window.game && window.game.housesStore) {
                    housesStore = window.game.housesStore;
                } else {
                    console.warn('[EmploymentPriorityService] Cannot update buildings immediately: housesStore not available');
                    return;
                }
            }
            
            // Get all buildings from IndexedDB
            const houses = await housesStore.listAllHouses();
            const updatePromises = [];
            
            for (const house of houses) {
                if (!house.employees) continue;
                
                const buildingSector = house.employees.sector || 0;
                
                // Skip residential buildings (sector 0)
                if (buildingSector === 0) continue;
                
                // Update building if it matches the changed sector
                if (buildingSector === changedSector && house.employees.priority !== newPriority) {
                    updatePromises.push(
                        housesStore.updateHouseFields(house.name, {
                            employees: {
                                ...house.employees,
                                priority: newPriority
                            }
                        }).catch(err => {
                            console.warn('[EmploymentPriorityService] Failed to update building priority:', {
                                buildingId: house.name,
                                sector: buildingSector,
                                error: err?.message || err
                            });
                        })
                    );
                }
                
                // Update building if it matches the swapped sector
                if (swappedSector !== null && buildingSector === swappedSector && house.employees.priority !== oldPriority) {
                    updatePromises.push(
                        housesStore.updateHouseFields(house.name, {
                            employees: {
                                ...house.employees,
                                priority: oldPriority
                            }
                        }).catch(err => {
                            console.warn('[EmploymentPriorityService] Failed to update swapped building priority:', {
                                buildingId: house.name,
                                sector: buildingSector,
                                error: err?.message || err
                            });
                        })
                    );
                }
            }
            
            // Wait for all updates to complete
            await Promise.allSettled(updatePromises);
            
            if (updatePromises.length > 0) {
                console.log('[EmploymentPriorityService] Immediately updated priorities for', updatePromises.length, 'buildings');
            }
        } catch (error) {
            console.error('[EmploymentPriorityService] Error updating buildings immediately:', {
                error: error?.message || error,
                changedSector,
                newPriority
            });
        }
    }

    /**
     * Get priority for a specific sector
     * @param {number} sector - Sector number
     * @returns {number} Priority value (1 to max sectors)
     */
    getSectorPriority(sector) {
        const priorities = this.getUserPriorities();
        return priorities[sector] !== undefined 
            ? priorities[sector] 
            : (config.employment?.defaultPriorities?.[sector] || 1);
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
        for (const [sectorNum, sectorName] of Object.entries(sectors)) {
            const secNum = parseInt(sectorNum, 10);
            allPriorities[secNum] = userPriorities[secNum] !== undefined 
                ? userPriorities[secNum] 
                : (defaultPriorities[secNum] || 1);
        }
        
        return allPriorities;
    }
}

