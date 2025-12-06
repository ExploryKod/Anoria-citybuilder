# WebGL Test Mode - Instructions

Ce document explique comment tester le système de détection des ressources WebGL sur une machine qui n'a pas de problèmes de ressources.

## Mode Test

Le système inclut un mode test qui simule des ressources WebGL limitées pour tester les avertissements et la réduction automatique de la taille de ville.

## Comment activer le mode test

### Option 1: Via la console du navigateur (Recommandé)

1. Ouvrez la console du navigateur (F12)
2. Utilisez le helper `webglTestMode` :

```javascript
// Simuler un système très limité (max 12x12)
webglTestMode.set('limited');

// Simuler un système modérément limité (max 16x16)
webglTestMode.set('moderate');

// Désactiver le mode test (détection normale)
webglTestMode.set('none');
// ou
webglTestMode.disable();

// Voir l'aide
webglTestMode.help();

// Vérifier le mode actuel
webglTestMode.get();
```

3. Rechargez la page (F5) pour que les changements prennent effet

### Option 2: Via localStorage directement

1. Ouvrez la console du navigateur (F12)
2. Exécutez une des commandes suivantes :

```javascript
// Simuler un système très limité (max 12x12)
localStorage.setItem('webgl-test-mode', 'limited');

// Simuler un système modérément limité (max 16x16)
localStorage.setItem('webgl-test-mode', 'moderate');

// Désactiver le mode test (détection normale)
localStorage.setItem('webgl-test-mode', 'none');
// ou
localStorage.removeItem('webgl-test-mode');
```

3. Rechargez la page (F5)

## Scénarios de test

### Test 1: Système très limité (12x12 max)

1. Activez le mode test : `localStorage.setItem('webgl-test-mode', 'limited')`
2. Rechargez la page
3. Ouvrez la sélection de taille de ville
4. Vous devriez voir :
   - Les options 16x16, 20x20, 24x24 désactivées avec un ⚠️
   - Un message d'avertissement dans la modal
   - Seule l'option 12x12 disponible
5. Si vous essayez de sélectionner une taille plus grande, vous verrez un avertissement
6. Après le chargement, une notification devrait apparaître expliquant les limitations

### Test 2: Système modérément limité (16x16 max)

1. Activez le mode test : `localStorage.setItem('webgl-test-mode', 'moderate')`
2. Rechargez la page
3. Ouvrez la sélection de taille de ville
4. Vous devriez voir :
   - Les options 20x20 et 24x24 désactivées
   - Un message d'avertissement dans la modal
   - Les options 12x12 et 16x16 disponibles
5. Une notification d'avertissement (moins sévère) devrait apparaître

### Test 3: Test avec taille personnalisée

1. Activez le mode test : `localStorage.setItem('webgl-test-mode', 'limited')`
2. Rechargez la page
3. Ouvrez la sélection de taille de ville
4. Essayez d'entrer une taille personnalisée de 20 ou 24
5. Vous devriez voir un message de confirmation demandant si vous voulez continuer malgré les limitations

### Test 4: Réduction automatique

1. Activez le mode test : `localStorage.setItem('webgl-test-mode', 'limited')`
2. Définissez une taille sauvegardée : `localStorage.setItem('selectedCitySize', '24')`
3. Rechargez la page
4. Le système devrait automatiquement réduire la taille à 12x12
5. Une notification devrait apparaître expliquant la réduction

### Test 5: Augmenter la taille maximale (pour tester la détection)

1. Activez le mode test : `localStorage.setItem('webgl-test-mode', 'limited')`
2. Le système permet maintenant des tailles jusqu'à 32x32 en mode test
3. Essayez de sélectionner une taille entre 13-32
4. Le système devrait détecter que c'est trop grand et réduire automatiquement

## Vérification dans la console

Quand le mode test est actif, vous verrez dans la console :
```
[WebGL Test Mode] Simulating limited resources. Max safe city size: 12×12
```

## Désactiver le mode test

Pour revenir à la détection normale :
```javascript
localStorage.removeItem('webgl-test-mode');
// ou
localStorage.setItem('webgl-test-mode', 'none');
```

Puis rechargez la page.

## Notes

- Le mode test simule uniquement les limitations détectées, pas les erreurs WebGL réelles
- Les erreurs de contexte WebGL perdu ne peuvent être testées que sur une machine réellement limitée
- Le mode test permet des tailles jusqu'à 32x32 pour tester la détection, même si normalement le maximum est 24x24

