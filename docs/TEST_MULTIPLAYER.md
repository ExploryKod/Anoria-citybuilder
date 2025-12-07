# Guide de Test Multijoueur

## Test avec deux navigateurs sur la même machine

### 1. Démarrer le serveur

```bash
cd server
npm start
```

Vous devriez voir :
```
🚀 Serveur WebSocket démarré sur ws://localhost:9876
📡 Connectez vos clients à: ws://localhost:9876
```

### 2. Ouvrir deux navigateurs différents

**Option A : Navigateurs différents**
- Chrome (fenêtre 1)
- Firefox (fenêtre 2)
- Edge (fenêtre 2)

**Option B : Même navigateur, fenêtres privées**
- Chrome normal + Chrome mode privé
- Firefox normal + Firefox mode privé

### 3. Tester le multijoueur

#### Étape 1 : Préparer les deux fenêtres
1. Ouvrez le jeu dans le premier navigateur
2. Ouvrez le jeu dans le deuxième navigateur
3. **Important** : Ne fermez pas les fenêtres pendant le test

#### Étape 2 : Activer le multijoueur
1. Dans les deux fenêtres :
   - Cochez "🎮 Mode Multijoueur" dans la modal de sélection
   - Choisissez une taille de ville (même taille recommandée)
   - Cliquez sur une taille pour démarrer

#### Étape 3 : Vérifier la connexion
- Ouvrez la console (F12) dans les deux navigateurs
- Vous devriez voir :
  ```
  [WebSocket] Connecté au serveur
  [Multiplayer] ID joueur: [uuid]
  [Multiplayer] Mode multijoueur activé
  ```

#### Étape 4 : Tester la synchronisation
1. Dans le navigateur 1 : Placez un bâtiment (maison, marché, etc.)
2. Dans le navigateur 2 : Le bâtiment devrait apparaître automatiquement
3. Dans le navigateur 2 : Placez un autre bâtiment
4. Dans le navigateur 1 : Vérifiez qu'il apparaît aussi

### 4. Vérifications

#### Console du serveur
Vous devriez voir :
```
[player1-uuid] Nouvelle connexion depuis ::1
[player2-uuid] Nouvelle connexion depuis ::1
[player1-uuid] Bâtiment placé: houses à (5, 3)
[player2-uuid] Bâtiment placé: markets à (7, 4)
```

#### Console des navigateurs
- Messages de connexion
- Messages de synchronisation
- Messages de placement de bâtiments

### 5. Problèmes courants

#### Le serveur ne démarre pas
- Vérifiez que le port 9876 n'est pas utilisé : `lsof -i :9876`
- Utilisez un autre port : `PORT=9877 npm start`

#### Les navigateurs ne se connectent pas
- Vérifiez que le serveur est bien démarré
- Vérifiez l'URL dans la console : doit être `ws://localhost:9876`
- Vérifiez les erreurs dans la console du navigateur

#### Les bâtiments ne s'affichent pas
- Vérifiez que le multijoueur est bien activé dans les deux fenêtres
- Vérifiez les messages dans la console
- Vérifiez que les deux joueurs ont la même taille de ville

#### Erreur "Position occupée"
- Normal si deux joueurs essaient de placer au même endroit
- Le premier gagne, le deuxième reçoit une erreur

### 6. Tests avancés

#### Test de déconnexion
1. Fermez un navigateur
2. L'autre devrait voir : "Joueur [id] est parti"

#### Test de reconnexion
1. Fermez un navigateur
2. Rouvrez-le et reconnectez
3. Le serveur devrait envoyer l'état complet

#### Test de conflit
1. Les deux joueurs essaient de placer au même endroit en même temps
2. Le serveur devrait accepter le premier et refuser le deuxième

### 7. Debug

#### Activer les logs détaillés
Dans la console du navigateur :
```javascript
// Voir tous les messages WebSocket
window.multiplayerManager.wsClient.on('*', console.log);
```

#### Vérifier l'état du serveur
Dans la console du serveur, vous pouvez voir :
- Nombre de joueurs connectés
- Nombre de bâtiments placés
- Messages échangés

### 8. Conseils

- **Même taille de ville** : Pour éviter les problèmes, utilisez la même taille dans les deux navigateurs
- **Console ouverte** : Gardez les consoles ouvertes pour voir les messages
- **Test progressif** : Testez d'abord la connexion, puis un bâtiment, puis plusieurs
- **Nettoyage** : Si vous testez plusieurs fois, rechargez les deux pages pour repartir à zéro

### 9. Prochaines étapes après test

Si tout fonctionne :
- ✅ Synchronisation des bâtiments
- ✅ Gestion des conflits
- ✅ Notifications des joueurs

À améliorer si nécessaire :
- Synchronisation du budget (si partagé)
- Synchronisation du temps de jeu
- Chat en temps réel
- Indicateurs visuels des autres joueurs

