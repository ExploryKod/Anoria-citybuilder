# Test du serveur WebSocket

## ✅ Vérification rapide

### 1. Vérifier que le conteneur Docker tourne

```bash
docker compose ps
```

Vous devriez voir :
```
NAME                STATUS
anoria-websocket    Up (healthy)
```

### 2. Vérifier les logs

```bash
docker compose logs -f anoria-websocket
```

Vous devriez voir :
```
🚀 Serveur WebSocket démarré sur ws://localhost:9876
📡 Connectez vos clients à: ws://localhost:9876
```

## 🌐 Page de test WebSocket

### Option 1 : Ouvrir directement le fichier HTML

1. Ouvrez `test-websocket.html` directement dans votre navigateur :
   ```bash
   # Sur Linux
   xdg-open test-websocket.html
   
   # Sur Mac
   open test-websocket.html
   
   # Ou double-cliquez sur le fichier dans votre explorateur
   ```

2. Cliquez sur "Se connecter"
3. Vous devriez voir "🟢 Connecté au serveur!" en vert

### Option 2 : Utiliser le serveur de test

1. Démarrer le serveur de test :
   ```bash
   cd server
   node test-server.js
   ```

2. Ouvrir dans votre navigateur :
   ```
   http://localhost:8888/test-websocket.html
   ```

3. Cliquez sur "Se connecter"
4. Vous devriez voir "🟢 Connecté au serveur!" en vert

## 🔍 Test manuel avec curl

```bash
# Vérifier que le serveur répond
curl http://localhost:9877/rooms
```

Vous devriez recevoir une réponse JSON avec la liste des salons (probablement vide au début).

## 📊 Vérifier les ressources utilisées

```bash
docker stats anoria-websocket
```

Vous devriez voir l'utilisation CPU et RAM (limitée à 0.5 CPU et 256 MB max).

## ✅ Signes que le serveur fonctionne

1. ✅ Le conteneur Docker est "Up" et "healthy"
2. ✅ Les logs montrent "Serveur WebSocket démarré"
3. ✅ La page de test se connecte avec succès
4. ✅ Le statut passe à "🟢 Connecté au serveur!"
5. ✅ Vous recevez un message "AVAILABLE_ROOMS" avec la liste des salons

## 🐛 Dépannage

### Le conteneur ne démarre pas
```bash
docker compose logs anoria-websocket
```

### Le port 9876 est déjà utilisé
```bash
# Trouver le processus
lsof -i :9876
# ou
sudo fuser 9876/tcp

# Arrêter le processus ou changer le port dans docker-compose.yml
```

### La page de test ne se connecte pas
- Vérifiez que le conteneur tourne : `docker compose ps`
- Vérifiez les logs : `docker compose logs anoria-websocket`
- Vérifiez que le port 9876 est bien mappé : `docker ps | grep 9876`

