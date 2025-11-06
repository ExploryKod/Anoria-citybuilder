# Déploiement Docker sur Hostinger VPS

## 📋 Prérequis

- VPS Hostinger avec Docker et Docker Compose installés
- Accès SSH au serveur
- Port 9876 disponible (ou modifiez dans docker-compose.yml)

## 🚀 Installation rapide

### 1. Préparer le serveur

```bash
# Se connecter en SSH
ssh root@votre-ip-hostinger

# Installer Docker (si pas déjà installé)
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Installer Docker Compose (si pas déjà installé)
apt install docker-compose-plugin
# ou
pip install docker-compose
```

### 2. Cloner/transférer le projet

```bash
cd /var/www  # ou votre répertoire préféré
git clone https://github.com/votre-username/votre-repo.git
cd votre-repo/server
```

### 3. Construire et démarrer avec Docker Compose

```bash
# Construire l'image
docker-compose build

# Démarrer en arrière-plan
docker-compose up -d

# Vérifier que ça fonctionne
docker-compose ps
docker-compose logs -f anoria-websocket
```

## 🔒 Limites de ressources (IMPORTANT)

Le fichier `docker-compose.yml` configure des limites strictes :

- **CPU** : Maximum 0.5 core (50% d'un CPU)
- **RAM** : Maximum 256 MB
- **CPU garanti** : 0.1 core minimum
- **RAM garantie** : 128 MB minimum

### Ajuster les limites

Éditez `docker-compose.yml` :

```yaml
deploy:
  resources:
    limits:
      cpus: '0.3'        # Réduire à 30% si nécessaire
      memory: 200M       # Réduire à 200 MB si nécessaire
```

## 📊 Monitoring des ressources

### Option 1 : Monitoring automatique (recommandé)

Le script `monitor-resources.sh` surveille et arrête automatiquement le conteneur si les limites sont dépassées :

```bash
# Rendre exécutable
chmod +x monitor-resources.sh

# Démarrer en arrière-plan
nohup ./monitor-resources.sh > /dev/null 2>&1 &

# Ou utiliser docker-compose avec monitoring
docker-compose -f docker-compose.monitoring.yml up -d
```

### Option 2 : Monitoring manuel

```bash
# Voir l'utilisation en temps réel
docker stats anoria-websocket

# Voir les logs
docker-compose logs -f anoria-websocket

# Voir l'utilisation des ressources
docker stats --no-stream anoria-websocket
```

### Option 3 : Alertes par email (optionnel)

Créez `send-alert.sh` :

```bash
#!/bin/bash
# Envoyer une alerte par email si ressources élevées
CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" anoria-websocket | sed 's/%//')
MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" anoria-websocket | awk '{print $1}')

if (( $(echo "$CPU > 70" | bc -l) )); then
    echo "CPU élevé: ${CPU}%" | mail -s "Alerte Anoria WebSocket" votre@email.com
fi
```

## 🔧 Commandes utiles

```bash
# Démarrer
docker-compose up -d

# Arrêter
docker-compose down

# Redémarrer
docker-compose restart

# Voir les logs
docker-compose logs -f

# Reconstruire après modification
docker-compose up -d --build

# Voir l'utilisation des ressources
docker stats anoria-websocket

# Arrêter si ressources trop élevées
docker stop anoria-websocket
```

## 🌐 Configuration Nginx (pour SSL/WSS)

Créez `/etc/nginx/sites-available/anoria-websocket` :

```nginx
server {
    listen 80;
    server_name ws.votre-domaine.com;
    
    location / {
        proxy_pass http://localhost:9876;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts pour WebSocket
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
```

Activez et configurez SSL :

```bash
sudo ln -s /etc/nginx/sites-available/anoria-websocket /etc/nginx/sites-enabled/
sudo nginx -t
sudo certbot --nginx -d ws.votre-domaine.com
```

## 🛡️ Sécurité

### 1. Limiter les connexions par IP (dans Nginx)

```nginx
limit_conn_zone $binary_remote_addr zone=websocket_limit:10m;

server {
    limit_conn websocket_limit 5;  # Max 5 connexions par IP
    # ... reste de la config
}
```

### 2. Firewall

```bash
# Autoriser uniquement le port 9876 depuis Nginx (localhost)
# Le port 9876 ne doit pas être accessible depuis l'extérieur
# Seul Nginx (port 80/443) doit être accessible

sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
# Ne PAS ouvrir 9876 publiquement
```

### 3. Rate limiting dans le code

Ajoutez dans `websocket-server.js` :

```javascript
const rateLimiter = new Map(); // IP -> { count, resetTime }

function checkRateLimit(ip) {
  const now = Date.now();
  const limit = rateLimiter.get(ip);
  
  if (!limit || now > limit.resetTime) {
    rateLimiter.set(ip, { count: 1, resetTime: now + 60000 }); // 1 min
    return true;
  }
  
  if (limit.count >= 10) { // Max 10 connexions/min par IP
    return false;
  }
  
  limit.count++;
  return true;
}
```

## 📈 Optimisations pour économiser les ressources

### 1. Réduire la fréquence des broadcasts

```javascript
// Au lieu de broadcaster immédiatement, batch les messages
const messageQueue = [];
setInterval(() => {
  if (messageQueue.length > 0) {
    broadcastBatch(messageQueue);
    messageQueue = [];
  }
}, 100); // Toutes les 100ms
```

### 2. Nettoyer les salons inactifs

```javascript
// Nettoyer les salons vides toutes les 5 minutes
setInterval(() => {
  for (const [roomId, room] of rooms.entries()) {
    if (room.players.size === 0 && Date.now() - room.createdAt > 300000) {
      rooms.delete(roomId);
    }
  }
}, 300000);
```

### 3. Limiter le nombre de salons

```javascript
const MAX_ROOMS = 10; // Maximum 10 salons simultanés

function createRoom(...) {
  if (rooms.size >= MAX_ROOMS) {
    throw new Error('Maximum number of rooms reached');
  }
  // ...
}
```

## 🚨 Alertes et notifications

### Script d'alerte simple

Créez `check-resources.sh` :

```bash
#!/bin/bash
CPU=$(docker stats --no-stream --format "{{.CPUPerc}}" anoria-websocket | sed 's/%//')
MEMORY=$(docker stats --no-stream --format "{{.MemUsage}}" anoria-websocket | awk '{print $1}' | sed 's/MiB//')

if (( $(echo "$CPU > 70" | bc -l) )) || (( $(echo "$MEMORY > 200" | bc -l) )); then
    echo "ALERTE: CPU=${CPU}%, RAM=${MEMORY}MB" >> /var/log/anoria-alerts.log
    # Optionnel: envoyer un email ou notification
fi
```

Ajoutez dans crontab :

```bash
# Vérifier toutes les 5 minutes
*/5 * * * * /var/www/votre-repo/server/check-resources.sh
```

## 📝 Logs

Les logs sont automatiquement limités par Docker :

- Taille max : 10 MB par fichier
- Nombre max : 3 fichiers (rotation automatique)
- Emplacement : `./logs/` dans le conteneur

Voir les logs :

```bash
docker-compose logs -f --tail=100 anoria-websocket
```

## 🔄 Mise à jour

```bash
# Arrêter
docker-compose down

# Mettre à jour le code
git pull

# Reconstruire et redémarrer
docker-compose up -d --build
```

## 💡 Conseils pour économiser les ressources

1. **Limitez le nombre de salons simultanés** (déjà fait : MAX_PLAYERS_PER_ROOM = 2)
2. **Nettoyez les salons vides** régulièrement
3. **Utilisez des timeouts** pour fermer les connexions inactives
4. **Limitez la taille des messages** WebSocket
5. **Surveillez régulièrement** avec `docker stats`

## 🆘 Dépannage

### Le conteneur s'arrête tout seul
- Vérifiez les logs : `docker-compose logs anoria-websocket`
- Vérifiez les ressources : `docker stats anoria-websocket`
- Augmentez légèrement les limites si nécessaire

### Trop de mémoire utilisée
- Réduisez `MAX_PLAYERS_PER_ROOM` ou `MAX_ROOMS`
- Ajoutez plus de nettoyage des salons inactifs
- Réduisez la taille des messages

### CPU trop élevé
- Réduisez la fréquence des broadcasts
- Optimisez le code de synchronisation
- Limitez le nombre de connexions simultanées

