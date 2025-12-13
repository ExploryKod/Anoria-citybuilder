# Intégration Multijoueur - Guide

## Installation

### 1. Installer le serveur

```bash
cd server
npm install
```

### 2. Démarrer le serveur

```bash
npm start
# ou en mode développement avec auto-reload
npm run dev
```

Le serveur écoute sur `ws://localhost:9876`

## Intégration dans le jeu

### 1. Modifier `src/js/game/game.js`

Ajoutez l'import et l'initialisation :

```javascript
import { getMultiplayerManager } from '../multiplayer/MultiplayerManager.js';

export function createGame(housesStore, gameStore, assetManager, citySize = null) {
    // ... code existant ...
    
    const scene = createScene(housesStore, gameStore, assetManager);
    const city = createCity(selectedCitySize);
    
    // Initialiser le gestionnaire multijoueur
    const multiplayerManager = getMultiplayerManager(game, scene, housesStore);
    
    // Activer le multijoueur (optionnel, peut être activé via UI)
    // await multiplayerManager.enable('ws://localhost:9876');
    
    // ... reste du code ...
}
```

### 2. Modifier le placement de bâtiment

Dans `src/js/game/game.js`, modifiez la fonction de placement :

```javascript
scene.onObjectSelected = async (selectedObject) => {
    // ... code existant ...
    
    // Si multijoueur activé, utiliser le gestionnaire multijoueur
    if (window.multiplayerManager && window.multiplayerManager.isMultiplayer) {
        try {
            await window.multiplayerManager.placeBuilding(
                activeToolId,
                selectedObject.userData.x,
                selectedObject.userData.y
            );
            // Le placement local se fait normalement
            // Le serveur confirmera et diffusera aux autres
        } catch (error) {
            showGenericErrorNotification(activeToolId, error.message);
            return;
        }
    }
    
    // ... reste du code de placement existant ...
};
```

### 3. Ajouter un bouton pour activer le multijoueur

Dans `src/js/ui/buttons.js` ou dans votre UI :

```javascript
// Bouton pour activer/désactiver le multijoueur
function createMultiplayerButton() {
    const btn = document.createElement('button');
    btn.textContent = 'Multijoueur';
    btn.onclick = async () => {
        if (!window.multiplayerManager) {
            const { getMultiplayerManager } = await import('../multiplayer/MultiplayerManager.js');
            window.multiplayerManager = getMultiplayerManager(window.game, window.game.scene, window.housesStore);
        }
        
        if (window.multiplayerManager.isMultiplayer) {
            window.multiplayerManager.disable();
            btn.textContent = 'Activer Multijoueur';
        } else {
            try {
                await window.multiplayerManager.enable('ws://localhost:9876');
                btn.textContent = 'Désactiver Multijoueur';
            } catch (error) {
                alert('Erreur de connexion: ' + error.message);
            }
        }
    };
    return btn;
}
```

## Test

1. Démarrer le serveur : `cd server && npm start`
2. Ouvrir deux onglets/navigateurs avec le jeu
3. Activer le multijoueur dans les deux
4. Placer des bâtiments dans l'un, ils devraient apparaître dans l'autre

## Déploiement

### Serveur de production

Pour déployer en production, vous pouvez utiliser :

- **Heroku** : Déployez le dossier `server/`
- **Railway** : Même chose
- **VPS** : Utilisez PM2 pour gérer le processus Node.js
- **Docker** : Créez un Dockerfile pour le serveur

### Configuration

Modifiez l'URL dans `MultiplayerManager.js` ou passez-la en paramètre :

```javascript
await multiplayerManager.enable('wss://votre-serveur.com');
```

Note : En production, utilisez `wss://` (WebSocket sécurisé) au lieu de `ws://`.

## Améliorations futures

- [ ] Authentification des joueurs
- [ ] Noms de joueurs personnalisés
- [ ] Chat en temps réel
- [ ] Synchronisation du budget partagé
- [ ] Gestion des tours (si nécessaire)
- [ ] Sauvegarde de l'état du jeu
- [ ] Rooms/salles de jeu

