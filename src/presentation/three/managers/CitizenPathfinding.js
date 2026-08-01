import * as THREE from 'three';

/**
 * Helper functions for citizen pathfinding
 */
export class CitizenPathfinding {
    constructor(buildings, terrain) {
        this.buildings = buildings;
        this.terrain = terrain;
    }

    /**
     * Checks if a tile at (x, y) is a road
     */
    isRoadTile(x, y) {
        if (x < 0 || x >= this.buildings.length || y < 0 || y >= this.buildings[0]?.length) {
            return false;
        }
        const building = this.buildings[x][y];
        const terrainTile = this.terrain[x]?.[y];
        
        return (building && (building.userData?.isRoad || building.userData?.type === 'roads' || building.name === 'roads')) ||
               (terrainTile && (terrainTile.userData?.isRoad || terrainTile.name === 'roads'));
    }

    /**
     * Checks if a tile at (x, y) has a building (non-road)
     */
    hasBuilding(x, y) {
        if (x < 0 || x >= this.buildings.length || y < 0 || y >= this.buildings[0]?.length) {
            return false;
        }
        const building = this.buildings[x][y];
        return building && !building.userData?.isRoad && building.userData?.type !== 'roads' && building.name !== 'roads';
    }

    /**
     * Gets adjacent road tiles (up, down, left, right)
     */
    getAdjacentRoads(x, y) {
        const adjacent = [];
        const directions = [
            { x: 0, y: -1 }, // Up
            { x: 0, y: 1 },  // Down
            { x: -1, y: 0 }, // Left
            { x: 1, y: 0 }   // Right
        ];
        
        for (const dir of directions) {
            const newX = x + dir.x;
            const newY = y + dir.y;
            if (this.isRoadTile(newX, newY) && !this.hasBuilding(newX, newY)) {
                adjacent.push({ x: newX, y: newY });
            }
        }
        
        return adjacent;
    }

    /**
     * Finds road tiles on the border of the map
     */
    findBorderRoads(city) {
        const borderRoads = [];
        const size = city.size;
        
        for (let i = 0; i < size; i++) {
            if (this.isRoadTile(i, 0)) {
                borderRoads.push({ x: i, y: 0 });
            }
            if (this.isRoadTile(i, size - 1)) {
                borderRoads.push({ x: i, y: size - 1 });
            }
            if (this.isRoadTile(0, i)) {
                borderRoads.push({ x: 0, y: i });
            }
            if (this.isRoadTile(size - 1, i)) {
                borderRoads.push({ x: size - 1, y: i });
            }
        }
        
        return borderRoads;
    }

    /**
     * Gets the tile coordinates from a world position
     */
    worldToTile(position) {
        return {
            x: Math.round(position.x),
            y: Math.round(position.z)
        };
    }

    /**
     * Validates if the current path is still valid
     */
    validatePath(path) {
        if (!path || path.length === 0) {
            return false;
        }
        
        for (const tile of path) {
            if (!this.isRoadTile(tile.x, tile.y) || this.hasBuilding(tile.x, tile.y)) {
                return false;
            }
        }
        
        return true;
    }

    /**
     * Creates a linear path following roads
     */
    createRoadPath(startX, startY, maxPathLength = 50) {
        const path = [{ x: startX, y: startY }];
        const visited = new Set();
        visited.add(`${startX},${startY}`);
        
        let currentX = startX;
        let currentY = startY;
        let attempts = 0;
        const maxAttempts = maxPathLength * 2;
        
        while (path.length < maxPathLength && attempts < maxAttempts) {
            const adjacent = this.getAdjacentRoads(currentX, currentY);
            
            const unvisited = adjacent.filter(road => {
                const key = `${road.x},${road.y}`;
                return !visited.has(key);
            });
            
            if (unvisited.length === 0) {
                break;
            } else {
                const next = unvisited[0];
                currentX = next.x;
                currentY = next.y;
                path.push({ x: currentX, y: currentY });
                visited.add(`${currentX},${currentY}`);
            }
            
            attempts++;
        }
        
        return path;
    }

    /**
     * Recalculates the citizen path from current position
     */
    recalculateCitizenPath(citizen, citizenManager) {
        if (!citizen || !citizen.character || !citizen.onRoad) {
            return false;
        }
        
        const currentTile = this.worldToTile(citizen.character.position);
        
        if (!this.isRoadTile(currentTile.x, currentTile.y) || this.hasBuilding(currentTile.x, currentTile.y)) {
            const adjacentRoads = this.getAdjacentRoads(currentTile.x, currentTile.y);
            if (adjacentRoads.length > 0) {
                const nearestRoad = adjacentRoads[0];
                citizen.path = this.createRoadPath(nearestRoad.x, nearestRoad.y);
                citizen.character.position.set(nearestRoad.x, 0.21, nearestRoad.y);
                citizen.currentPathIndex = 0;
                citizen.pathDirection = 1;
                if (citizen.path.length > 1) {
                    const nextTile = citizen.path[1];
                    citizen.targetPosition = new THREE.Vector3(nextTile.x, 0.21, nextTile.y);
                }
                return true;
            } else {
                citizen.isWalking = false;
                citizen.targetPosition = null;
                citizen.onRoad = false;
                const animationsToUse = citizenManager.getCitizenAnimations(citizen);
                const idleNames = ['idle', 'Idle', 'Standing Idle', 'standing_idle', 'mixamo.com'];
                let idleAnimation = null;
                for (const name of idleNames) {
                    if (animationsToUse[name]) {
                        idleAnimation = name;
                        break;
                    }
                }
                if (idleAnimation) {
                    citizenManager.switchCitizenAnimation(citizen, idleAnimation, true, 0.3);
                }
                return false;
            }
        }
        
        citizen.path = this.createRoadPath(currentTile.x, currentTile.y);
        
        if (citizen.path.length > 1) {
            let closestIndex = 0;
            let minDistance = Infinity;
            for (let i = 0; i < citizen.path.length; i++) {
                const tile = citizen.path[i];
                const distance = Math.abs(tile.x - currentTile.x) + Math.abs(tile.y - currentTile.y);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestIndex = i;
                }
            }
            
            citizen.currentPathIndex = closestIndex;
            citizen.pathDirection = 1;
            
            if (citizen.currentPathIndex < citizen.path.length - 1) {
                const nextTile = citizen.path[citizen.currentPathIndex + 1];
                citizen.targetPosition = new THREE.Vector3(nextTile.x, 0.21, nextTile.y);
            } else if (citizen.currentPathIndex > 0) {
                citizen.pathDirection = -1;
                const nextTile = citizen.path[citizen.currentPathIndex - 1];
                citizen.targetPosition = new THREE.Vector3(nextTile.x, 0.21, nextTile.y);
            }
            
            return true;
        } else {
            citizen.isWalking = false;
            citizen.targetPosition = null;
            return false;
        }
    }
}
