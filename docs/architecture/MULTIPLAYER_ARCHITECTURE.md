# Architecture Multijoueur - Anoria City Builder

## Vue d'ensemble

Pour permettre à deux joueurs de jouer ensemble sur des ordinateurs séparés avec la même scène, vous avez **absolument besoin d'un serveur backend** car :

1. **WebSocket nécessite un serveur** : Les clients ne peuvent pas se connecter directement entre eux
2. **Synchronisation d'état** : Le serveur maintient l'état de jeu autoritaire
3. **Gestion des conflits** : Le serveur résout les conflits (deux joueurs placent un bâtiment au même endroit)
4. **Sécurité** : Le serveur valide les actions pour éviter la triche

## Architecture proposée

```
┌─────────────┐         WebSocket          ┌─────────────┐
│  Client 1   │◄──────────────────────────►│             │
│  (Joueur 1) │                              │   Serveur   │
└─────────────┘                              │   Backend   │
                                             │  (Node.js/  │
┌─────────────┐         WebSocket          │   Go/Python) │
│  Client 2   │◄──────────────────────────►│             │
│  (Joueur 2) │                              └─────────────┘
└─────────────┘
```

## Choix du serveur

### Option 1: Node.js (Recommandé pour du JS pur)
- ✅ Même langage que le client
- ✅ Facile à intégrer avec votre code existant
- ✅ Bibliothèque `ws` très simple
- ✅ Bon pour le prototypage

### Option 2: Go
- ✅ Performance excellente
- ✅ Gestion native des goroutines (concurrent)
- ✅ Bibliothèque `gorilla/websocket`
- ❌ Langage différent

### Option 3: Python
- ✅ Simple et rapide à développer
- ✅ Bibliothèque `websockets` ou `socket.io`
- ✅ Bon pour le prototypage
- ❌ Performance moindre que Go

**Recommandation : Node.js** pour commencer rapidement, puis migrer vers Go si besoin de performance.

## Structure des messages WebSocket

### Messages Client → Serveur

```javascript
// Placement de bâtiment
{
  type: 'BUILD',
  playerId: 'player1',
  buildingType: 'houses',
  x: 5,
  y: 3,
  timestamp: 1234567890
}

// Déconnexion
{
  type: 'DISCONNECT',
  playerId: 'player1'
}

// Synchronisation (demande d'état complet)
{
  type: 'SYNC_REQUEST',
  playerId: 'player1'
}
```

### Messages Serveur → Client

```javascript
// Confirmation de placement
{
  type: 'BUILD_CONFIRMED',
  buildingId: 'house_123',
  playerId: 'player1',
  buildingType: 'houses',
  x: 5,
  y: 3,
  timestamp: 1234567890
}

// Placement d'un autre joueur
{
  type: 'BUILD_BROADCAST',
  buildingId: 'house_124',
  playerId: 'player2',
  buildingType: 'markets',
  x: 7,
  y: 4,
  timestamp: 1234567891
}

// État complet de la ville (synchronisation)
{
  type: 'FULL_SYNC',
  citySize: 16,
  buildings: [
    { id: 'house_123', type: 'houses', x: 5, y: 3, playerId: 'player1' },
    { id: 'house_124', type: 'markets', x: 7, y: 4, playerId: 'player2' }
  ],
  players: ['player1', 'player2'],
  gameTime: 42
}

// Erreur
{
  type: 'ERROR',
  message: 'Insufficient funds',
  code: 'INSUFFICIENT_FUNDS'
}
```

## Implémentation

Voir les fichiers :
- `server/websocket-server.js` - Serveur Node.js
- `src/js/multiplayer/WebSocketClient.js` - Client WebSocket
- `src/js/multiplayer/MultiplayerManager.js` - Gestionnaire multijoueur

## Flux de synchronisation

1. **Connexion** : Client se connecte → Serveur envoie état complet
2. **Action locale** : Client place bâtiment → Envoie au serveur
3. **Validation serveur** : Serveur valide (fond, position, etc.)
4. **Broadcast** : Serveur envoie à tous les clients
5. **Mise à jour locale** : Chaque client met à jour sa scène

## Gestion des conflits

- **Même position** : Premier arrivé gagne, deuxième reçoit une erreur
- **Fonds insuffisants** : Serveur valide avant de confirmer
- **Déconnexion** : Serveur notifie les autres joueurs

## Sécurité

- Validation côté serveur de toutes les actions
- Rate limiting pour éviter le spam
- Authentification simple (tokens ou sessions)

