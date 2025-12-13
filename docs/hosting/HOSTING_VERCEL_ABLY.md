# Hébergement WebSocket sur Vercel avec Ably

## 📋 Vue d'ensemble

Cette approche permet de garder **tout sur Vercel** en utilisant **Ably** comme service de relais WebSocket. Vercel Functions gèrent la logique métier via HTTP, et Ably gère les connexions WebSocket persistantes.

**Références :**
- [Guide Vercel sur WebSockets](https://vercel.com/guides/do-vercel-serverless-functions-support-websocket-connections)
- [Exemple Ably + Next.js + Vercel](https://github.com/ably-labs/NextJS-chat-app)

---

## 🎯 Architecture

```
Client (Browser) 
    ↓ WebSocket
Ably (gère les connexions persistantes)
    ↓ HTTP API
Vercel Functions (logique métier)
    ↓
Votre jeu (état, validation, etc.)
```

---

## 📦 Installation

### 1. Créer un compte Ably

1. Allez sur [ably.com](https://ably.com) et créez un compte gratuit
2. Créez une nouvelle app
3. Copiez votre **API Key** (format: `xxxxx:xxxxx`)

**Plan gratuit Ably :**
- 200M messages/mois
- 200 connexions simultanées
- Suffisant pour un petit jeu multijoueur

### 2. Installer les dépendances

```bash
cd server
npm install ably
```

---

## 🔧 Adaptation du code serveur

### Option A : Utiliser Ably directement (Recommandé)

Créez `server/ably-server.js` :

```javascript
/**
 * Serveur Ably pour Anoria City Builder - Multijoueur
 * 
 * Ce serveur utilise Ably comme relais WebSocket
 * et Vercel Functions pour la logique métier
 */

const Ably = require('ably');

const ABLY_API_KEY = process.env.ABLY_API_KEY;
const MAX_PLAYERS_PER_ROOM = 2;

if (!ABLY_API_KEY) {
  throw new Error('ABLY_API_KEY environment variable is required');
}

const ably = new Ably.Realtime(ABLY_API_KEY);

// Gestion des salons (en mémoire ou dans une base de données)
const rooms = new Map();
let nextRoomId = 1;

/**
 * Vercel Function : Créer un salon
 * POST /api/multiplayer/create-room
 */
async function createRoom(req, res) {
  const { citySize, playerPseudo, roomName } = req.body;
  
  if (!citySize || citySize < 12 || citySize > 24) {
    return res.status(400).json({ error: 'Invalid city size' });
  }
  
  const roomId = `room_${nextRoomId++}`;
  const room = {
    id: roomId,
    citySize,
    roomName: roomName || null,
    players: [],
    buildings: [],
    createdAt: Date.now()
  };
  
  rooms.set(roomId, room);
  
  // Publier sur le channel Ably pour notifier les clients
  const channel = ably.channels.get('rooms');
  await channel.publish('room-created', {
    roomId,
    citySize,
    roomName,
    currentPlayers: 1,
    maxPlayers: MAX_PLAYERS_PER_ROOM
  });
  
  return res.status(200).json({
    roomId,
    channel: `room:${roomId}`,
    token: await getAblyToken(playerPseudo)
  });
}

/**
 * Vercel Function : Rejoindre un salon
 * POST /api/multiplayer/join-room
 */
async function joinRoom(req, res) {
  const { roomId, playerPseudo } = req.body;
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  if (room.players.length >= MAX_PLAYERS_PER_ROOM) {
    return res.status(403).json({ error: 'Room is full' });
  }
  
  // Ajouter le joueur
  const player = {
    id: `player_${Date.now()}`,
    pseudo: playerPseudo
  };
  room.players.push(player);
  
  // Notifier via Ably
  const channel = ably.channels.get(`room:${roomId}`);
  await channel.publish('player-joined', {
    playerId: player.id,
    playerPseudo,
    totalPlayers: room.players.length
  });
  
  return res.status(200).json({
    roomId,
    channel: `room:${roomId}`,
    token: await getAblyToken(playerPseudo),
    players: room.players
  });
}

/**
 * Vercel Function : Placer un bâtiment
 * POST /api/multiplayer/build
 */
async function placeBuilding(req, res) {
  const { roomId, playerId, buildingType, x, y } = req.body;
  
  const room = rooms.get(roomId);
  if (!room) {
    return res.status(404).json({ error: 'Room not found' });
  }
  
  // Valider et ajouter le bâtiment
  const building = {
    id: `building_${Date.now()}`,
    playerId,
    type: buildingType,
    x,
    y,
    timestamp: Date.now()
  };
  
  room.buildings.push(building);
  
  // Diffuser via Ably
  const channel = ably.channels.get(`room:${roomId}`);
  await channel.publish('building-placed', building);
  
  return res.status(200).json({ success: true, building });
}

/**
 * Vercel Function : Obtenir la liste des salons
 * GET /api/multiplayer/rooms
 */
async function getRooms(req, res) {
  const allRooms = Array.from(rooms.values()).map(room => ({
    id: room.id,
    citySize: room.citySize,
    roomName: room.roomName,
    currentPlayers: room.players.length,
    maxPlayers: MAX_PLAYERS_PER_ROOM
  }));
  
  return res.status(200).json({ rooms: allRooms });
}

/**
 * Générer un token Ably pour un joueur
 */
async function getAblyToken(playerPseudo) {
  // Utiliser Ably Token Authentication
  // Pour la production, utilisez Ably Token Authentication
  // Ici, on retourne l'API key (non sécurisé pour la prod)
  return ABLY_API_KEY;
}

module.exports = {
  createRoom,
  joinRoom,
  placeBuilding,
  getRooms
};
```

### Créer les Vercel Functions

Créez `api/multiplayer/create-room.js` :

```javascript
const { createRoom } = require('../../server/ably-server.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  return createRoom(req, res);
}
```

Créez `api/multiplayer/join-room.js` :

```javascript
const { joinRoom } = require('../../server/ably-server.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  return joinRoom(req, res);
}
```

Créez `api/multiplayer/build.js` :

```javascript
const { placeBuilding } = require('../../server/ably-server.js');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  return placeBuilding(req, res);
}
```

Créez `api/multiplayer/rooms.js` :

```javascript
const { getRooms } = require('../../server/ably-server.js');

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  return getRooms(req, res);
}
```

---

## 🔧 Adaptation du client

### Modifier `src/js/multiplayer/WebSocketClient.js` pour utiliser Ably

Créez `src/js/multiplayer/AblyClient.js` :

```javascript
/**
 * Client Ably pour le multijoueur
 * Remplace WebSocketClient pour utiliser Ably au lieu de WebSocket natif
 */

export class AblyClient {
  constructor(ablyKey, playerPseudo = 'Joueur') {
    this.ablyKey = ablyKey;
    this.playerPseudo = playerPseudo;
    this.ably = null;
    this.channel = null;
    this.connected = false;
    this.listeners = new Map();
    this.roomId = null;
  }

  /**
   * Connecte à Ably
   */
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Charger Ably depuis CDN ou npm
        if (typeof Ably === 'undefined') {
          // Si Ably n'est pas chargé, le charger dynamiquement
          const script = document.createElement('script');
          script.src = 'https://cdn.ably.io/lib/ably.min-1.js';
          script.onload = () => this.initAbly(resolve, reject);
          script.onerror = reject;
          document.head.appendChild(script);
        } else {
          this.initAbly(resolve, reject);
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  initAbly(resolve, reject) {
    try {
      this.ably = new Ably.Realtime({ key: this.ablyKey });
      
      this.ably.connection.on('connected', () => {
        console.log('[Ably] Connecté');
        this.connected = true;
        this.emit('connected');
        resolve();
      });

      this.ably.connection.on('disconnected', () => {
        console.log('[Ably] Déconnecté');
        this.connected = false;
        this.emit('disconnected');
      });

      this.ably.connection.on('failed', (error) => {
        console.error('[Ably] Erreur de connexion:', error);
        this.connected = false;
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  }

  /**
   * Rejoint un channel (salon)
   */
  subscribeToRoom(roomId) {
    if (this.channel) {
      this.channel.unsubscribe();
    }
    
    this.roomId = roomId;
    this.channel = this.ably.channels.get(`room:${roomId}`);
    
    // Écouter les événements du salon
    this.channel.subscribe('building-placed', (message) => {
      this.emit('buildBroadcast', { building: message.data });
    });

    this.channel.subscribe('player-joined', (message) => {
      this.emit('playerJoined', message.data);
    });

    this.channel.subscribe('player-left', (message) => {
      this.emit('playerLeft', message.data);
    });
  }

  /**
   * Envoie un message via HTTP à Vercel Function
   */
  async sendToServer(endpoint, data) {
    const response = await fetch(`/api/multiplayer/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }
    
    return response.json();
  }

  /**
   * Crée un salon
   */
  async createRoom(citySize, playerPseudo, roomName) {
    const result = await this.sendToServer('create-room', {
      citySize,
      playerPseudo,
      roomName
    });
    
    this.subscribeToRoom(result.roomId);
    this.emit('roomCreated', { roomId: result.roomId });
    
    return result;
  }

  /**
   * Rejoint un salon
   */
  async joinRoom(roomId, playerPseudo) {
    const result = await this.sendToServer('join-room', {
      roomId,
      playerPseudo
    });
    
    this.subscribeToRoom(roomId);
    this.emit('roomJoined', { roomId });
    
    return result;
  }

  /**
   * Place un bâtiment
   */
  async placeBuilding(buildingType, x, y) {
    const result = await this.sendToServer('build', {
      roomId: this.roomId,
      playerId: this.ably.auth.clientId,
      buildingType,
      x,
      y
    });
    
    this.emit('buildConfirmed', result);
    return result;
  }

  /**
   * Écouteurs d'événements
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  /**
   * Déconnecte
   */
  disconnect() {
    if (this.channel) {
      this.channel.unsubscribe();
    }
    if (this.ably) {
      this.ably.close();
    }
    this.connected = false;
  }
}
```

---

## 🔐 Sécurité : Token Authentication

Pour la production, utilisez Ably Token Authentication au lieu de l'API key directement :

Créez `api/ably-token.js` :

```javascript
const Ably = require('ably');

export default async function handler(req, res) {
  const ably = new Ably.Rest(process.env.ABLY_API_KEY);
  
  // Générer un token pour le client
  const tokenRequest = await ably.auth.createTokenRequest({
    clientId: req.query.clientId || 'anonymous'
  });
  
  return res.status(200).json(tokenRequest);
}
```

Puis dans le client, récupérez le token avant de se connecter :

```javascript
const tokenResponse = await fetch('/api/ably-token?clientId=' + playerPseudo);
const tokenRequest = await tokenResponse.json();

this.ably = new Ably.Realtime({ 
  authUrl: '/api/ably-token',
  authMethod: 'GET'
});
```

---

## 📝 Configuration Vercel

### Variables d'environnement

Dans Vercel Dashboard → Settings → Environment Variables :

```
ABLY_API_KEY=your-ably-api-key:here
```

### Structure des fichiers

```
/
├── api/
│   └── multiplayer/
│       ├── create-room.js
│       ├── join-room.js
│       ├── build.js
│       └── rooms.js
├── server/
│   └── ably-server.js
└── src/
    └── js/
        └── multiplayer/
            └── AblyClient.js
```

---

## 💰 Coûts Ably

**Plan gratuit :**
- 200M messages/mois
- 200 connexions simultanées
- Suffisant pour un petit jeu

**Plan payant :** À partir de $25/mois pour plus de capacité

---

## ✅ Avantages de cette approche

- ✅ Tout sur Vercel (site + API)
- ✅ Pas de serveur séparé à gérer
- ✅ Scalabilité automatique
- ✅ SSL/HTTPS géré par Vercel
- ✅ Déploiement automatique depuis GitHub

## ⚠️ Inconvénients

- ⚠️ Coût Ably après le seuil gratuit
- ⚠️ Nécessite de réécrire le code serveur
- ⚠️ Dépendance à Ably
- ⚠️ Latence légèrement supérieure (HTTP → Ably → WebSocket)

---

## 🎯 Recommandation

**Si vous voulez tout sur Vercel :** Utilisez Ably (ou Pusher) avec cette approche

**Si vous préférez un serveur dédié :** Utilisez Railway/Render/Fly.io ou votre VPS Hostinger

Les deux approches fonctionnent, choisissez selon vos préférences !

