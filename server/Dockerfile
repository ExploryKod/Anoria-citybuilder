# Dockerfile pour le serveur WebSocket Anoria
FROM node:20-alpine

# Créer le répertoire de travail
WORKDIR /app

# Copier les fichiers package
COPY package*.json ./

# Installer les dépendances
# Utiliser npm ci pour une installation reproductible (nécessite package-lock.json)
RUN npm ci --omit=dev

# Copier le code source
COPY . .

# Exposer le port WebSocket
EXPOSE 9876

# Utiliser l'utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# Démarrer le serveur
CMD ["node", "websocket-server.js"]

