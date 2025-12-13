# Guide de Test des Optimisations de Performance

Ce guide explique comment tester et mesurer les gains de performance obtenus avec les optimisations implémentées.

## 🎯 Méthodes de Test

### 1. **Statistiques de Performance Intégrées** (Recommandé)

Les statistiques sont déjà intégrées dans le code. Pour les activer :

#### Dans la Console du Navigateur (F12) :

```javascript
// Activer les statistiques de performance
togglePerformanceStats();

// Les stats s'affichent automatiquement toutes les secondes dans la console
// Format : [Performance] FPS: ~60 | Draw Calls: 45 | Triangles: 12,345 | Geometries: 8 | Textures: 15
```

#### Ce que vous verrez :
- **FPS** : Images par seconde (idéalement 60)
- **Draw Calls** : Nombre d'appels de rendu (moins = mieux)
- **Triangles** : Nombre de triangles rendus (moins = mieux)
- **Geometries** : Nombre de géométries en mémoire
- **Textures** : Nombre de textures chargées

---

### 2. **Outils de Développement du Navigateur**

#### Chrome/Edge DevTools :

1. **Ouvrir les DevTools** : `F12` ou `Ctrl+Shift+I`
2. **Onglet Performance** :
   - Cliquer sur "Record" (cercle rouge)
   - Jouer pendant 10-30 secondes
   - Cliquer sur "Stop"
   - Analyser le graphique FPS (devrait être stable autour de 60)

3. **Onglet Performance Monitor** :
   - Activer dans les paramètres DevTools
   - Affiche FPS, CPU, GPU en temps réel

#### Firefox DevTools :

1. **Ouvrir les DevTools** : `F12`
2. **Onglet Performance** :
   - Cliquer sur "Start Recording"
   - Jouer pendant 10-30 secondes
   - Cliquer sur "Stop"
   - Analyser le graphique FPS

---

### 3. **Test Avant/Après les Optimisations**

Pour comparer les performances avant et après :

#### Étape 1 : Tester AVANT (si vous avez une version précédente)
```javascript
// Dans la console
togglePerformanceStats();
// Noter les valeurs : Draw Calls, Triangles, FPS
```

#### Étape 2 : Tester APRÈS
```javascript
// Dans la console
togglePerformanceStats();
// Comparer les valeurs
```

---

### 4. **Test des Optimisations Spécifiques**

#### A. Test du Frustum Culling

Les logs du frustum culling apparaissent automatiquement dans la console :
```
[Frustum Culling] Visible: 8 zones | Hidden: 8 zones
```

**Comment tester :**
1. Ouvrir la console
2. Déplacer la caméra (zoom in/out, rotation)
3. Observer les logs qui montrent combien de zones sont cachées

**Résultat attendu :** Plus vous zoomez, plus de zones devraient être cachées.

---

#### B. Test des Ombres Dynamiques

Les logs des ombres apparaissent automatiquement :
```
[Performance] Updated shadows for 45 meshes | Shadow map: 512px (distance threshold: 50)
```

**Comment tester :**
1. Ouvrir la console
2. Déplacer la caméra loin/près des bâtiments
3. Observer les changements de résolution des shadow maps (256px, 512px, 1024px)

**Résultat attendu :** 
- Caméra proche = shadow map haute résolution (512-1024px)
- Caméra éloignée = shadow map basse résolution (256px)

---

#### C. Test du Raycasting Optimisé

**Comment tester :**
1. Ouvrir la console
2. Déplacer la souris sur la scène
3. Observer la réactivité (devrait être instantanée)

**Résultat attendu :** Pas de lag lors du survol des objets.

---

### 5. **Test sur Différentes Configurations**

#### Test sur Machine Faible :

1. **Chrome DevTools** → **Performance** → **CPU Throttling**
   - Activer "6x slowdown" pour simuler une machine faible
   - Observer les FPS (devrait rester > 30 FPS)

2. **Test avec différentes tailles de ville :**
   ```javascript
   // Tester avec une ville 16x16
   // Puis tester avec une ville 24x24
   // Comparer les FPS
   ```

---

### 6. **Métriques à Surveiller**

#### ✅ Bonnes Performances :
- **FPS** : 55-60 (stable)
- **Draw Calls** : < 100 pour une ville 16x16
- **Triangles** : < 50,000 pour une ville 16x16
- **Lag** : Aucun lors du déplacement de la caméra

#### ⚠️ Performances Moyennes :
- **FPS** : 30-55 (variable)
- **Draw Calls** : 100-200
- **Triangles** : 50,000-100,000

#### ❌ Performances Faibles :
- **FPS** : < 30
- **Draw Calls** : > 200
- **Triangles** : > 100,000
- **Lag** : Visible lors du déplacement

---

### 7. **Commandes Utiles dans la Console**

```javascript
// Activer/désactiver les stats de performance
togglePerformanceStats();

// Voir les informations du renderer Three.js
console.log(window.scene?.renderer?.info);

// Voir le nombre d'objets dans la scène
console.log(window.scene?.children?.length);

// Voir les stats du frustum culling (si activé)
// Les logs apparaissent automatiquement

// Voir les stats des ombres (si activé)
// Les logs apparaissent automatiquement
```

---

### 8. **Test de Charge**

Pour tester sous charge :

1. **Créer une grande ville** (16x16 ou 24x24)
2. **Placer beaucoup de bâtiments** (100+ maisons)
3. **Observer les FPS** pendant le placement
4. **Déplacer la caméra** rapidement
5. **Zoomer in/out** rapidement

**Résultat attendu :** Les FPS devraient rester stables (> 45 FPS).

---

### 9. **Comparaison avec d'Autres Sites**

Pour référence, voici des métriques typiques :

- **Jeux 3D simples** : 60 FPS, < 50 draw calls
- **Jeux 3D moyens** : 45-60 FPS, 50-150 draw calls
- **Jeux 3D complexes** : 30-45 FPS, 150-300 draw calls

**Votre jeu devrait être dans la catégorie "moyen" après optimisations.**

---

## 📊 Résultats Attendus Après Optimisations

### Avant Optimisations :
- ❌ 80+ lumières (bug)
- ❌ Raycasting sur tous les objets (300+ objets)
- ❌ Ombres activées partout
- ❌ Pas de frustum culling
- ❌ Shadow maps haute résolution partout

### Après Optimisations :
- ✅ 5 lumières seulement
- ✅ Raycasting sur objets interactifs seulement (~256 objets)
- ✅ Ombres désactivées pour objets >50 unités
- ✅ Frustum culling actif (zones cachées)
- ✅ Shadow maps dynamiques selon distance

**Gain attendu :** 2-3x meilleures performances, surtout sur machines tierces.

---

## 🐛 Dépannage

### Les stats ne s'affichent pas ?
```javascript
// Vérifier si la fonction existe
console.log(typeof togglePerformanceStats);
// Si "undefined", recharger la page
```

### Les FPS sont toujours faibles ?
1. Vérifier la taille de la ville (essayer 12x12)
2. Vérifier le nombre de bâtiments
3. Vérifier les logs de frustum culling (zones cachées ?)
4. Vérifier les logs d'ombres (shadow maps réduites ?)

### La console est trop remplie ?
```javascript
// Désactiver les stats
togglePerformanceStats();
// Les logs s'arrêteront
```

---

## 📝 Notes

- Les optimisations sont **automatiques** et **actives par défaut**
- Les stats de performance sont **optionnelles** (activées via `togglePerformanceStats()`)
- Les logs de frustum culling et ombres apparaissent **automatiquement** (20% de chance par frame)

---

**Bon test ! 🚀**

