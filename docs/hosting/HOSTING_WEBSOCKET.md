# Guide d'hébergement du serveur WebSocket

## ⚠️ Limitation de Vercel (et solution)

**Vercel Functions ne supporte PAS les WebSockets natifs directement** car :
- Les fonctions serverless s'exécutent à la demande (pas de connexions longues)
- Les WebSockets nécessitent des connexions persistantes maintenues en mémoire
- Vercel est optimisé pour HTTP/HTTPS, pas pour les protocoles WebSocket natifs

**MAIS** : Vercel recommande d'utiliser des **services tiers spécialisés** qui gèrent les WebSockets côté serveur et fournissent une API HTTP pour vos Vercel Functions. Ces services agissent comme un proxy/relais WebSocket.

**Services recommandés par Vercel :**
- [Ably](https://vercel.com/guides/do-vercel-serverless-functions-support-websocket-connections) - Pub/Sub messaging
- [Pusher](https://vercel.com/guides/deploying-pusher-channels-with-vercel) - Real-time channels
- [Convex](https://www.convex.dev/) - Backend as a service
- [Liveblocks](https://liveblocks.io/) - Collaborative features
- [Partykit](https://partykit.io/) - Multiplayer infrastructure
- [PubNub](https://www.pubnub.com/) - Real-time messaging
- [Supabase Realtime](https://supabase.com/docs/guides/realtime) - Real-time subscriptions

**Avantages de cette approche :**
- ✅ Tout reste sur Vercel (site statique + fonctions)
- ✅ Pas besoin d'un serveur séparé
- ✅ Services gérés (pas de maintenance)
- ✅ Scalabilité automatique

**Inconvénients :**
- ⚠️ Coût supplémentaire (gratuit jusqu'à un certain seuil, puis payant)
- ⚠️ Dépendance à un service tiers
- ⚠️ Nécessite de modifier votre code serveur pour utiliser leur API

---

## 🔄 Option : Adapter votre code pour utiliser Ably/Pusher avec Vercel

Si vous voulez tout garder sur Vercel, vous pouvez adapter votre serveur WebSocket pour utiliser Ably ou Pusher. Voici comment :

## ✅ Solutions recommandées (gratuites ou peu coûteuses)

### 0. **Hostinger VPS** (⭐ Si vous avez déjà un plan)

**⚠️ Important :** Hostinger supporte Node.js et WebSockets **uniquement sur les plans VPS**, pas sur l'hébergement web partagé.

**Avantages :**
- ✅ Vous avez déjà un plan (pas de coût supplémentaire)
- ✅ Contrôle total sur le serveur (accès root)
- ✅ Support WebSocket natif
- ✅ Performance dédiée
- ✅ Pas de limitations de temps d'exécution
- ✅ Pas d'endormissement

**Prérequis :**
- ⚠️ Vous devez avoir un **VPS Hostinger** (pas l'hébergement partagé)
- ⚠️ Accès SSH requis
- ⚠️ Node.js doit être installé (ou utilisez un template avec Node.js préinstallé)

**Déploiement sur Hostinger VPS :**

#### Option A : Via CloudPanel (Recommandé - Plus simple)

1. **Accédez à CloudPanel**
   - Connectez-vous à `https://votre-ip-vps:8443`
   - Ou utilisez votre domaine si configuré

2. **Créez une application Node.js**
   - Dans "Sites" → "Ajouter un site"
   - Sélectionnez "Node.js" comme type d'application
   - Entrez un nom de domaine (ex: `ws.votre-domaine.com`)
   - Sélectionnez la version de Node.js (20.x recommandé)
   - Spécifiez le port : `9876` (ou celui de votre choix)

3. **Déployez votre application**
   - Téléchargez les fichiers du dossier `server/` via le gestionnaire de fichiers
   - Ou utilisez Git : `git clone https://github.com/votre-repo.git`
   - Placez les fichiers dans le répertoire de l'application Node.js

4. **Installez les dépendances**
   ```bash
   cd /home/cloudpanel/htdocs/ws.votre-domaine.com
   npm install
   ```

5. **Démarrez avec PM2** (via SSH)
   ```bash
   npm install -g pm2
   pm2 start websocket-server.js --name "anoria-websocket"
   pm2 save
   pm2 startup  # Suivez les instructions
   ```

6. **Configurez SSL** (via CloudPanel ou Let's Encrypt)
   - CloudPanel peut configurer SSL automatiquement
   - Ou utilisez Certbot manuellement

#### Option B : Configuration avec Docker (⭐ Recommandé si vous utilisez Docker)

**Avantages Docker :**
- ✅ Isolation des ressources (ne peut pas dépasser les limites)
- ✅ Facile à redémarrer/arrêter
- ✅ Pas de conflit avec d'autres services
- ✅ Monitoring intégré

1. **Connectez-vous en SSH**
   ```bash
   ssh root@votre-ip-hostinger
   ```

2. **Vérifiez que Docker est installé**
   ```bash
   docker --version
   docker-compose --version
   ```

3. **Clonez/transférez votre projet**
   ```bash
   cd /var/www  # ou votre répertoire préféré
   git clone https://github.com/votre-username/votre-repo.git
   cd votre-repo/server
   ```

4. **Construisez et démarrez avec Docker Compose**
   ```bash
   # Construire l'image
   docker-compose build
   
   # Démarrer en arrière-plan (avec limites de ressources)
   docker-compose up -d
   
   # Vérifier que ça fonctionne
   docker-compose ps
   docker-compose logs -f anoria-websocket
   ```

5. **Surveillez les ressources** (important !)
   ```bash
   # Voir l'utilisation en temps réel
   docker stats anoria-websocket
   
   # Ou utilisez le script de monitoring automatique
   chmod +x monitor-resources.sh
   nohup ./monitor-resources.sh > /dev/null 2>&1 &
   ```

**Limites configurées dans `docker-compose.yml` :**
- CPU : Maximum 0.5 core (50%)
- RAM : Maximum 256 MB
- Le conteneur sera automatiquement limité à ces valeurs

**Guide complet Docker :** Voir `server/README_DOCKER.md`

#### Option C : Configuration manuelle avec PM2 (Sans Docker)

1. **Connectez-vous en SSH**
   ```bash
   ssh root@votre-ip-hostinger
   ```

2. **Installez Node.js** (si pas déjà installé)
   ```bash
   # Pour Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Vérifiez
   node --version
   npm --version
   ```

3. **Clonez/transférez votre projet**
   ```bash
   cd /var/www  # ou votre répertoire préféré
   git clone https://github.com/votre-username/votre-repo.git
   cd votre-repo/server
   npm install
   ```

4. **Installez PM2** (gestionnaire de processus)
   ```bash
   npm install -g pm2
   ```

5. **Démarrez le serveur avec PM2** (avec limites)
   ```bash
   cd /var/www/votre-repo/server
   
   # PM2 avec limites de ressources
   pm2 start websocket-server.js \
     --name "anoria-websocket" \
     --max-memory-restart 200M \
     --node-args="--max-old-space-size=200"
   
   # Sauvegardez et configurez le démarrage automatique
   pm2 save
   pm2 startup  # Suivez les instructions affichées
   ```
   
   **Note :** PM2 redémarrera automatiquement si la mémoire dépasse 200MB

6. **Configurez Nginx comme reverse proxy** (pour SSL/WSS)
   Créez `/etc/nginx/sites-available/anoria-websocket` :
   ```nginx
   server {
       listen 80;
       server_name ws.votre-domaine.com;  # Sous-domaine pour WebSocket
       
       location / {
           proxy_pass http://localhost:9876;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```
   
   Activez le site :
   ```bash
   sudo ln -s /etc/nginx/sites-available/anoria-websocket /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

7. **Configurez SSL avec Let's Encrypt** (gratuit)
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d ws.votre-domaine.com
   ```

8. **Ouvrez le port dans le firewall** (si nécessaire)
   ```bash
   # Pour UFW
   sudo ufw allow 9876/tcp
   sudo ufw reload
   ```

9. **Mettez à jour votre configuration client**
   Dans `src/config/websocket.js` :
   ```javascript
   const PRODUCTION_WS_URL = 'wss://ws.votre-domaine.com';
   ```

**Avantages spécifiques Hostinger VPS :**
- ✅ Pas de coût supplémentaire si vous avez déjà un VPS
- ✅ Performance dédiée (pas de partage de ressources)
- ✅ Contrôle total (root access)
- ✅ Pas de limitations de temps d'exécution
- ✅ Support de plusieurs services sur le même serveur
- ✅ Templates préconfigurés disponibles (Node.js + OpenLiteSpeed)

**Inconvénients :**
- ⚠️ Nécessite des connaissances en administration système
- ⚠️ Vous devez gérer les mises à jour et la sécurité
- ⚠️ Pas de déploiement automatique depuis GitHub (sauf si configuré manuellement)

**Coût :** Gratuit si vous avez déjà un plan VPS Hostinger

**Fichier PM2 inclus :** `server/ecosystem.config.js` pour faciliter la gestion

---

### 1. **Railway** (⭐ Recommandé - Plan gratuit généreux)

**Avantages :**
- ✅ Plan gratuit : $5 de crédit/mois (suffisant pour un petit jeu)
- ✅ Support WebSocket natif
- ✅ Déploiement automatique depuis GitHub
- ✅ Variables d'environnement faciles
- ✅ Logs en temps réel
- ✅ Régions disponibles (choisissez la même que Vercel)

**Déploiement :**
1. Créez un compte sur [railway.app](https://railway.app)
2. Connectez votre repo GitHub
3. Créez un nouveau projet
4. Ajoutez un service "Empty Service"
5. Configurez :
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node websocket-server.js`
   - **Root Directory**: `/` (racine du projet)
6. Ajoutez la variable d'environnement `PORT` (Railway l'injecte automatiquement)

**Coût :** Gratuit jusqu'à $5/mois, puis $0.000463/GB-heure

---

### 2. **Render** (⭐ Alternative solide - Plan gratuit)

**Avantages :**
- ✅ Plan gratuit : 750 heures/mois (suffisant si < 1 instance)
- ✅ Support WebSocket natif
- ✅ Déploiement automatique depuis GitHub
- ✅ SSL automatique
- ✅ Régions disponibles

**Limitations du plan gratuit :**
- ⚠️ Le service s'endort après 15 min d'inactivité (première connexion lente)
- ⚠️ Redémarre automatiquement à la première requête

**Déploiement :**
1. Créez un compte sur [render.com](https://render.com)
2. Créez un nouveau "Web Service"
3. Connectez votre repo GitHub
4. Configurez :
   - **Environment**: Node
   - **Build Command**: `cd server && npm install`
   - **Start Command**: `cd server && node websocket-server.js`
   - **Root Directory**: `/server`
5. Dans "Advanced", ajoutez la variable `PORT` (Render l'injecte automatiquement)

**Coût :** Gratuit (avec limitations), puis $7/mois pour le plan "Starter"

---

### 3. **Fly.io** (⭐ Performant - Plan gratuit)

**Avantages :**
- ✅ Plan gratuit : 3 VMs partagées (suffisant pour un petit jeu)
- ✅ Support WebSocket natif
- ✅ Très performant (edge computing)
- ✅ Déploiement depuis GitHub
- ✅ Régions multiples possibles

**Déploiement :**
1. Installez `flyctl` : `curl -L https://fly.io/install.sh | sh`
2. Créez un compte : `fly auth signup`
3. Dans le dossier `server/`, créez `fly.toml` :
```toml
app = "anoria-websocket"
primary_region = "cdg"  # Paris (proche de Vercel EU)

[build]

[http_service]
  internal_port = 9876
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 1

[[services]]
  protocol = "tcp"
  internal_port = 9876
  processes = ["app"]

  [[services.ports]]
    port = 80
    handlers = ["http"]
    force_https = true

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]

  [[services.ports]]
    port = 9876
    handlers = ["tls", "http"]
```

4. Déployez : `fly deploy`

**Coût :** Gratuit jusqu'à 3 VMs, puis payant

---

## 🔧 Configuration du client pour la production

Une fois votre serveur WebSocket déployé, modifiez l'URL dans le code client :

### Option 1 : Variable d'environnement (recommandé)

Dans `src/js/ui/buttons.js` et `src/js/multiplayer/MultiplayerManager.js`, remplacez :
```javascript
const WS_URL = process.env.NODE_ENV === 'production' 
  ? 'wss://votre-serveur.railway.app'  // ou render.com, fly.dev
  : 'ws://localhost:9876';
```

### Option 2 : Configuration dynamique

Créez un fichier `src/config/websocket.js` :
```javascript
// Détection automatique de l'environnement
const getWebSocketUrl = () => {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'ws://localhost:9876';
  }
  
  // En production, utilisez votre URL de serveur
  // Remplacez par votre URL Railway/Render/Fly.io
  return 'wss://votre-serveur.railway.app';
};

export default getWebSocketUrl;
```

Puis importez dans `MultiplayerManager.js` :
```javascript
import getWebSocketUrl from '../config/websocket.js';

// Dans enable() :
await multiplayerManager.enable(getWebSocketUrl(), playerPseudo, ...);
```

---

## 📊 Comparaison des solutions

| Solution | Plan gratuit | WebSocket | Latence | Endormissement | Recommandation |
|----------|--------------|-----------|---------|----------------|----------------|
| **Hostinger VPS** | Si déjà possédé | ✅ | Très faible | ❌ Non | ⭐⭐⭐⭐⭐ (si VPS) |
| **Railway** | $5 crédit/mois | ✅ | Faible | ❌ Non | ⭐⭐⭐⭐⭐ |
| **Render** | 750h/mois | ✅ | Faible | ⚠️ 15 min | ⭐⭐⭐⭐ |
| **Fly.io** | 3 VMs | ✅ | Très faible | ❌ Non | ⭐⭐⭐⭐⭐ |
| **Vercel** | Illimité | ❌ | - | - | ❌ Non compatible |

---

## 🚀 Déploiement recommandé : Railway

### Étapes détaillées pour Railway :

1. **Préparer le projet**
   - Assurez-vous que `server/package.json` existe
   - Vérifiez que `server/websocket-server.js` est prêt

2. **Créer le fichier Railway**
   Créez `railway.json` à la racine :
   ```json
   {
     "$schema": "https://railway.app/railway.schema.json",
     "build": {
       "builder": "NIXPACKS",
       "buildCommand": "cd server && npm install"
     },
     "deploy": {
       "startCommand": "cd server && node websocket-server.js",
       "restartPolicyType": "ON_FAILURE",
       "restartPolicyMaxRetries": 10
     }
   }
   ```

3. **Déployer sur Railway**
   - Allez sur [railway.app](https://railway.app)
   - "New Project" → "Deploy from GitHub repo"
   - Sélectionnez votre repo
   - Railway détectera automatiquement Node.js
   - Configurez :
     - **Root Directory**: `/server`
     - **Start Command**: `node websocket-server.js`
   - Railway générera automatiquement une URL : `votre-app.railway.app`

4. **Configurer les variables d'environnement**
   - Railway injecte automatiquement `PORT`
   - Pas besoin de configuration supplémentaire

5. **Obtenir l'URL WebSocket**
   - Railway vous donne une URL HTTPS : `https://votre-app.railway.app`
   - Pour WebSocket, utilisez : `wss://votre-app.railway.app`
   - (Railway gère automatiquement le SSL)

6. **Mettre à jour le client**
   - Remplacez `ws://localhost:9876` par `wss://votre-app.railway.app`
   - Testez en production !

---

## 🔒 Sécurité (important pour la production)

### 1. Ajouter CORS (si nécessaire)
Dans `server/websocket-server.js`, ajoutez :
```javascript
const wss = new WebSocket.Server({ 
  port: PORT,
  verifyClient: (info) => {
    // Vérifier l'origine si nécessaire
    const origin = info.origin;
    const allowedOrigins = [
      'https://votre-site.vercel.app',
      'https://votre-domaine.com'
    ];
    return !origin || allowedOrigins.includes(origin);
  }
});
```

### 2. Rate limiting (recommandé)
Ajoutez une limite de connexions par IP pour éviter les abus.

---

## 💡 Optimisation de la latence

Pour réduire la latence entre Vercel et votre serveur WebSocket :

1. **Choisissez la même région**
   - Vercel : choisissez la région EU (Europe)
   - Railway/Render/Fly.io : choisissez aussi EU (Paris, Frankfurt, etc.)

2. **Utilisez un CDN pour les assets statiques**
   - Vercel le fait déjà automatiquement

3. **WebSocket over HTTPS (WSS)**
   - Tous les services recommandés supportent WSS automatiquement
   - Utilisez `wss://` au lieu de `ws://` en production

---

## 📝 Checklist de déploiement

- [ ] Compte créé sur Railway/Render/Fly.io
- [ ] Repo GitHub connecté
- [ ] Service WebSocket déployé
- [ ] URL WebSocket obtenue (format `wss://...`)
- [ ] Variables d'environnement configurées
- [ ] Code client mis à jour avec la nouvelle URL
- [ ] Test en production réussi
- [ ] CORS configuré (si nécessaire)
- [ ] Monitoring activé (logs Railway/Render)

---

## 🆘 Dépannage

### Le serveur ne démarre pas
- Vérifiez les logs dans Railway/Render
- Assurez-vous que `PORT` est bien utilisé (pas de port hardcodé)
- Vérifiez que `npm install` s'exécute correctement

### Connexion WebSocket échoue
- Vérifiez que vous utilisez `wss://` (pas `ws://`) en HTTPS
- Vérifiez les CORS si configurés
- Vérifiez les logs du serveur

### Latence élevée
- Choisissez la même région que Vercel
- Vérifiez la distance géographique entre les serveurs

---

## 💰 Coûts estimés

**Railway (recommandé) :**
- Plan gratuit : $5 crédit/mois
- Pour un petit jeu (< 100 joueurs/jour) : **GRATUIT**
- Au-delà : ~$5-10/mois

**Render :**
- Plan gratuit : 750h/mois (suffisant si < 1 instance)
- Plan Starter : $7/mois (sans endormissement)

**Fly.io :**
- Plan gratuit : 3 VMs partagées
- Au-delà : ~$2-5/mois par VM

---

## 🎯 Recommandation finale

**Pour votre cas d'usage (jeu multijoueur simple, 2 joueurs max par salon) :**

### Option 1 : Tout sur Vercel avec Ably/Pusher (⭐ Si vous voulez tout centraliser)
- ✅ Site statique + API sur Vercel
- ✅ Pas de serveur séparé
- ✅ Déploiement automatique
- ⚠️ Nécessite de réécrire le code pour utiliser Ably/Pusher
- ⚠️ Coût Ably après le seuil gratuit
- **Guide détaillé :** Voir `HOSTING_VERCEL_ABLY.md`

### Option 2 : Serveur WebSocket dédié (⭐ Plus simple, code existant fonctionne)

#### Si vous avez déjà un VPS Hostinger :
1. **Utilisez Hostinger VPS** (⭐ Meilleure option si vous l'avez déjà) :
   - Pas de coût supplémentaire
   - Performance dédiée
   - Contrôle total
   - Configuration en ~30 minutes avec PM2 + Nginx
   - **Votre code actuel fonctionne sans modification**

#### Si vous n'avez pas de VPS :
1. **Railway** est la meilleure option :
   - Plan gratuit généreux ($5 crédit/mois)
   - Pas d'endormissement
   - Facile à configurer
   - Support WebSocket natif
   - Déploiement en 10 minutes
   - **Votre code actuel fonctionne sans modification**

2. **Fly.io** si vous voulez des performances maximales :
   - Edge computing
   - Très faible latence
   - Un peu plus complexe à configurer

3. **Render** comme alternative :
   - Plus simple que Fly.io
   - Mais endormissement après 15 min (première connexion lente)

**Action immédiate :** 
- **Si vous voulez tout sur Vercel** → Suivez `HOSTING_VERCEL_ABLY.md` (nécessite adaptation du code)
- **Si vous préférez garder votre code actuel** → Utilisez Hostinger VPS ou Railway (code fonctionne tel quel)

