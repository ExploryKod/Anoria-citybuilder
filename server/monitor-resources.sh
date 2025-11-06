#!/bin/bash

# Script de monitoring des ressources pour le serveur WebSocket
# Surveille l'utilisation CPU, RAM et arrête le conteneur si limites dépassées

CONTAINER_NAME="anoria-websocket"
MAX_CPU_PERCENT=80      # Arrêter si CPU > 80%
MAX_MEMORY_MB=200      # Arrêter si RAM > 200 MB
CHECK_INTERVAL=60       # Vérifier toutes les 60 secondes
LOG_FILE="./logs/resource-monitor.log"

# Créer le dossier logs si nécessaire
mkdir -p logs

log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_container() {
    if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        log_message "ERREUR: Le conteneur $CONTAINER_NAME n'est pas en cours d'exécution"
        return 1
    fi
    return 0
}

get_cpu_usage() {
    docker stats --no-stream --format "{{.CPUPerc}}" "$CONTAINER_NAME" | sed 's/%//'
}

get_memory_usage() {
    docker stats --no-stream --format "{{.MemUsage}}" "$CONTAINER_NAME" | awk '{print $1}' | sed 's/MiB//'
}

stop_container() {
    log_message "ARRÊT: Arrêt du conteneur $CONTAINER_NAME (limite de ressources dépassée)"
    docker stop "$CONTAINER_NAME"
    docker-compose down
}

# Fonction principale de monitoring
monitor() {
    log_message "Démarrage du monitoring pour $CONTAINER_NAME"
    
    while true; do
        if ! check_container; then
            sleep "$CHECK_INTERVAL"
            continue
        fi
        
        CPU_USAGE=$(get_cpu_usage)
        MEMORY_USAGE=$(get_memory_usage)
        
        # Convertir en nombre pour comparaison
        CPU_NUM=$(echo "$CPU_USAGE" | bc)
        MEMORY_NUM=$(echo "$MEMORY_USAGE" | bc)
        
        log_message "Ressources: CPU=${CPU_USAGE}%, RAM=${MEMORY_USAGE}MB"
        
        # Vérifier les limites
        if (( $(echo "$CPU_NUM > $MAX_CPU_PERCENT" | bc -l) )); then
            log_message "ALERTE: CPU à ${CPU_USAGE}% (limite: ${MAX_CPU_PERCENT}%)"
            stop_container
            break
        fi
        
        if (( $(echo "$MEMORY_NUM > $MAX_MEMORY_MB" | bc -l) )); then
            log_message "ALERTE: RAM à ${MEMORY_USAGE}MB (limite: ${MAX_MEMORY_MB}MB)"
            stop_container
            break
        fi
        
        sleep "$CHECK_INTERVAL"
    done
}

# Gérer l'arrêt propre
trap 'log_message "Arrêt du monitoring"; exit 0' SIGTERM SIGINT

# Démarrer le monitoring
monitor

