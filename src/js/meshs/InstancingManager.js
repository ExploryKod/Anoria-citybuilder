/**
 * InstancingManager - Gestion de l'instancing pour les bâtiments répétitifs
 * Utilise THREE.InstancedMesh pour réduire les draw calls
 * 
 * Bénéfices :
 * - 100 maisons identiques = 1 draw call au lieu de 100
 * - Réduction drastique du nombre de draw calls
 * - Meilleure performance sur machines tierces
 */

import * as THREE from 'three';

class InstancingManager {
    constructor() {
        // Map des InstancedMesh par type de bâtiment
        // Format: { 'House-Blue': InstancedMesh, 'House-Red': InstancedMesh, ... }
        this.instancedMeshes = new Map();
        
        // Map des instances actives par type
        // Format: { 'House-Blue': Map<instanceId, {x, y, matrix}>, ... }
        this.instances = new Map();
        
        // Compteur d'instances par type (pour générer des IDs uniques)
        this.instanceCounters = new Map();
        
        // Types de bâtiments qui bénéficient de l'instancing
        // Seulement les bâtiments très répétitifs (maisons, fermes, marchés)
        this.instancableTypes = new Set([
            'House-Blue',
            'House-Red', 
            'House-Purple',
            'House-2Story',
            'Market-Stall',
            'Farm-Wheat',
            'Farm-Carrot',
            'Farm-Cabbage',
            'Tombstone-1',
            'Tombstone-2',
            'Tombstone-3'
        ]);
        
        // Taille maximale d'une InstancedMesh (limite WebGL)
        this.MAX_INSTANCES = 10000; // Limite sûre pour la plupart des GPUs
    }
    
    /**
     * Vérifie si un type de bâtiment peut utiliser l'instancing
     * @param {string} buildingType - Type de bâtiment
     * @returns {boolean}
     */
    canInstance(buildingType) {
        return this.instancableTypes.has(buildingType);
    }
    
    /**
     * Crée ou récupère un InstancedMesh pour un type de bâtiment
     * @param {string} buildingType - Type de bâtiment
     * @param {THREE.BufferGeometry} geometry - Géométrie de base
     * @param {THREE.Material} material - Matériau partagé
     * @param {number} maxInstances - Nombre maximum d'instances (défaut: MAX_INSTANCES)
     * @returns {THREE.InstancedMesh}
     */
    getOrCreateInstancedMesh(buildingType, geometry, material, maxInstances = this.MAX_INSTANCES) {
        if (!this.instancedMeshes.has(buildingType)) {
            const instancedMesh = new THREE.InstancedMesh(geometry, material, maxInstances);
            instancedMesh.name = `instanced_${buildingType}`;
            instancedMesh.userData.buildingType = buildingType;
            instancedMesh.userData.instanceCount = 0;
            
            // Créer la map des instances pour ce type
            this.instances.set(buildingType, new Map());
            this.instanceCounters.set(buildingType, 0);
            
            this.instancedMeshes.set(buildingType, instancedMesh);
            console.log(`[Instancing] Created InstancedMesh for ${buildingType} (max ${maxInstances} instances)`);
        }
        
        return this.instancedMeshes.get(buildingType);
    }
    
    /**
     * Ajoute une instance d'un bâtiment à l'instanced mesh
     * @param {string} buildingType - Type de bâtiment
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {THREE.BufferGeometry} geometry - Géométrie (si nouvelle création)
     * @param {THREE.Material} material - Matériau (si nouvelle création)
     * @returns {string|null} Instance ID ou null si échec
     */
    addInstance(buildingType, x, y, geometry = null, material = null) {
        if (!this.canInstance(buildingType)) {
            return null; // Ne pas utiliser l'instancing pour ce type
        }
        
        const instancesMap = this.instances.get(buildingType);
        if (!instancesMap) {
            console.warn(`[Instancing] No InstancedMesh found for ${buildingType}, creating one...`);
            if (!geometry || !material) {
                console.error(`[Instancing] Cannot create InstancedMesh without geometry and material`);
                return null;
            }
            this.getOrCreateInstancedMesh(buildingType, geometry, material);
        }
        
        const instancedMesh = this.instancedMeshes.get(buildingType);
        const currentCount = instancedMesh.userData.instanceCount;
        
        // Vérifier si on peut ajouter plus d'instances
        if (currentCount >= instancedMesh.count) {
            console.warn(`[Instancing] Max instances reached for ${buildingType} (${currentCount}/${instancedMesh.count})`);
            return null;
        }
        
        // Générer un ID unique pour cette instance
        const instanceId = `${buildingType}_${x}_${y}`;
        
        // Vérifier si l'instance existe déjà
        if (instancesMap.has(instanceId)) {
            console.warn(`[Instancing] Instance ${instanceId} already exists`);
            return instanceId;
        }
        
        // Créer la matrice de transformation pour cette instance
        const matrix = new THREE.Matrix4();
        // Position: x, z (y dans Three.js), y (hauteur)
        // Rotation: 90° sur X, 180° sur Y et Z (comme dans AssetManager)
        matrix.compose(
            new THREE.Vector3(x, 0, y), // Position
            new THREE.Quaternion().setFromEuler(
                new THREE.Euler(
                    THREE.MathUtils.degToRad(90),
                    THREE.MathUtils.degToRad(180),
                    THREE.MathUtils.degToRad(180)
                )
            ),
            new THREE.Vector3(1, 1, 1) // Scale (sera ajusté selon le modèle)
        );
        
        // Définir la matrice pour cette instance
        instancedMesh.setMatrixAt(currentCount, matrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        // Stocker les données de l'instance
        instancesMap.set(instanceId, {
            index: currentCount,
            x,
            y,
            matrix: matrix.clone(),
            instanceId
        });
        
        // Incrémenter le compteur
        instancedMesh.userData.instanceCount++;
        
        return instanceId;
    }
    
    /**
     * Supprime une instance d'un bâtiment
     * @param {string} buildingType - Type de bâtiment
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @returns {boolean} True si supprimé avec succès
     */
    removeInstance(buildingType, x, y) {
        if (!this.canInstance(buildingType)) {
            return false;
        }
        
        const instancesMap = this.instances.get(buildingType);
        if (!instancesMap) {
            return false;
        }
        
        const instanceId = `${buildingType}_${x}_${y}`;
        const instanceData = instancesMap.get(instanceId);
        
        if (!instanceData) {
            return false;
        }
        
        const instancedMesh = this.instancedMeshes.get(buildingType);
        const lastIndex = instancedMesh.userData.instanceCount - 1;
        const removeIndex = instanceData.index;
        
        // Si ce n'est pas la dernière instance, déplacer la dernière à la position supprimée
        if (removeIndex < lastIndex) {
            const lastInstanceId = Array.from(instancesMap.values())
                .find(inst => inst.index === lastIndex)?.instanceId;
            
            if (lastInstanceId) {
                const lastInstanceData = instancesMap.get(lastInstanceId);
                // Copier la matrice de la dernière instance à la position supprimée
                instancedMesh.setMatrixAt(removeIndex, lastInstanceData.matrix);
                // Mettre à jour l'index de la dernière instance
                lastInstanceData.index = removeIndex;
            }
        }
        
        // Supprimer l'instance de la map
        instancesMap.delete(instanceId);
        
        // Décrémenter le compteur
        instancedMesh.userData.instanceCount--;
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        return true;
    }
    
    /**
     * Met à jour la matrice d'une instance existante
     * @param {string} buildingType - Type de bâtiment
     * @param {number} x - Position X
     * @param {number} y - Position Y
     * @param {THREE.Matrix4} newMatrix - Nouvelle matrice de transformation
     * @returns {boolean} True si mis à jour avec succès
     */
    updateInstance(buildingType, x, y, newMatrix) {
        if (!this.canInstance(buildingType)) {
            return false;
        }
        
        const instancesMap = this.instances.get(buildingType);
        if (!instancesMap) {
            return false;
        }
        
        const instanceId = `${buildingType}_${x}_${y}`;
        const instanceData = instancesMap.get(instanceId);
        
        if (!instanceData) {
            return false;
        }
        
        const instancedMesh = this.instancedMeshes.get(buildingType);
        instancedMesh.setMatrixAt(instanceData.index, newMatrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
        
        // Mettre à jour la matrice stockée
        instanceData.matrix.copy(newMatrix);
        
        return true;
    }
    
    /**
     * Récupère tous les InstancedMesh créés
     * @returns {Array<THREE.InstancedMesh>}
     */
    getAllInstancedMeshes() {
        return Array.from(this.instancedMeshes.values());
    }
    
    /**
     * Nettoie toutes les instances (pour réinitialisation)
     */
    clear() {
        this.instancedMeshes.forEach(mesh => {
            mesh.dispose();
        });
        this.instancedMeshes.clear();
        this.instances.clear();
        this.instanceCounters.clear();
    }
    
    /**
     * Obtient les statistiques d'instancing
     * @returns {Object} Statistiques
     */
    getStats() {
        const stats = {
            totalTypes: this.instancedMeshes.size,
            totalInstances: 0,
            byType: {}
        };
        
        this.instancedMeshes.forEach((mesh, type) => {
            const count = mesh.userData.instanceCount || 0;
            stats.totalInstances += count;
            stats.byType[type] = {
                instances: count,
                maxInstances: mesh.count,
                drawCalls: count > 0 ? 1 : 0 // 1 draw call pour toutes les instances
            };
        });
        
        return stats;
    }
}

// Export singleton instance
const instancingManager = new InstancingManager();
export default instancingManager;

