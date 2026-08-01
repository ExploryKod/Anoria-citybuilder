import webglDetector from '../../utils/WebGLResourceDetector.js';

export function showCitySizeSelection() {

    return new Promise((resolve) => {
        const modal = document.getElementById('city-size-selection-modal');
        const options = modal?.querySelectorAll('.city-size-option');
        const customInput = modal?.querySelector('#custom-city-size');
        const customButton = modal?.querySelector('#custom-size-apply');
        const messageEl = modal?.querySelector('.city-size-selection-message');
        const multiplayerToggle = modal?.querySelector('#multiplayer-toggle');
        
        if (!modal || !options) {
            // Fallback: return default size if modal doesn't exist
            resolve({ size: 16, multiplayer: false });
            return;
        }
        
        // Detect WebGL capabilities (doit être fait en premier)
        const webglCapabilities = webglDetector.detectCapabilities();
        const maxSafeCitySize = webglDetector.getMaxSafeCitySize();
        
        // Check if mobile device (used throughout the function)
        const isMobile = window.innerWidth <= 1024;
        // In test mode, allow larger sizes to test detection
        const testMode = localStorage.getItem('webgl-test-mode');
        const theoreticalMaxSize = testMode ? (isMobile ? 18 : 24) : (isMobile ? 16 : 18);
        // Use the lower of theoretical max or WebGL-safe max
        const maxSize = Math.min(theoreticalMaxSize, maxSafeCitySize);
        
        // Fonction pour activer/désactiver les options solo (définie AVANT utilisation)
        const toggleSoloOptions = (enabled) => {
            const optionsContainer = modal?.querySelector('.city-size-options');
            const customContainer = modal?.querySelector('.city-size-custom');
            
            if (enabled) {
                // Réactiver les options solo - les afficher
                options.forEach(option => {
                    option.style.pointerEvents = '';
                    option.style.opacity = option.disabled ? '0.5' : '1';
                    option.style.cursor = option.disabled ? 'not-allowed' : 'pointer';
                    option.style.display = '';
                });
                if (optionsContainer) {
                    optionsContainer.classList.remove('disabled');
                    optionsContainer.style.display = '';
                }
                if (customContainer) {
                    customContainer.classList.remove('disabled');
                    customContainer.style.display = '';
                }
                if (customInput) {
                    customInput.disabled = false;
                    customButton.disabled = false;
                }
            } else {
                // Désactiver les options solo - les masquer complètement
                options.forEach(option => {
                    option.style.pointerEvents = 'none';
                    option.style.display = 'none';
                });
                if (optionsContainer) {
                    optionsContainer.classList.add('disabled');
                    optionsContainer.style.display = 'none';
                }
                if (customContainer) {
                    customContainer.classList.add('disabled');
                    customContainer.style.display = 'none';
                }
                if (customInput) {
                    customInput.disabled = true;
                    customButton.disabled = true;
                }
            }
        }
        
        // Restaurer l'état multijoueur sauvegardé (par défaut: solo)
        const savedMultiplayer = localStorage.getItem('multiplayer-enabled') === 'true';
        const savedPseudo = localStorage.getItem('multiplayer-pseudo') || '';
        const savedRoomName = localStorage.getItem('multiplayer-room-name') || '';
        const pseudoContainer = modal?.querySelector('#multiplayer-pseudo-container');
        const pseudoInput = modal?.querySelector('#multiplayer-pseudo');
        const roomNameContainer = modal?.querySelector('#multiplayer-room-name-container');
        const roomNameInput = modal?.querySelector('#multiplayer-room-name');
        
        // Configurer le toggle multijoueur (démarre en mode solo par défaut)
        if (multiplayerToggle) {
            multiplayerToggle.checked = savedMultiplayer;
            // Afficher/masquer les champs multijoueur
            if (pseudoContainer) {
                pseudoContainer.style.display = savedMultiplayer ? 'block' : 'none';
            }
            if (roomNameContainer) {
                roomNameContainer.style.display = savedMultiplayer ? 'block' : 'none';
            }
            if (pseudoInput && savedPseudo) {
                pseudoInput.value = savedPseudo;
            }
            if (roomNameInput && savedRoomName) {
                roomNameInput.value = savedRoomName;
            }
            
            // Toggle du mode multijoueur
            multiplayerToggle.addEventListener('change', () => {
                const isMultiplayer = multiplayerToggle.checked;
                const multiplayerSection = modal?.querySelector('#multiplayer-section');
                
                // Afficher/masquer toute la section multijoueur
                if (multiplayerSection) {
                    multiplayerSection.style.display = isMultiplayer ? 'block' : 'none';
                }
                
                if (isMultiplayer) {
                    // Charger les salons disponibles
                    loadAvailableRooms(modal, maxSafeCitySize);
                }
                
                // Désactiver/activer les options solo selon le mode
                toggleSoloOptions(!isMultiplayer);
            });
            
            // Initialiser l'affichage de la section multijoueur
            const multiplayerSection = modal?.querySelector('#multiplayer-section');
            if (multiplayerSection) {
                multiplayerSection.style.display = savedMultiplayer ? 'block' : 'none';
            }
            
            // Initialiser l'état des options solo (par défaut: solo activé)
            toggleSoloOptions(!savedMultiplayer);
        }
        
        // Fonction pour charger et afficher les salons disponibles
        const loadAvailableRooms = async (modal, maxSafeCitySizeParam) => {
            const maxSafeCitySizeToUse = maxSafeCitySizeParam;
            const roomsList = modal?.querySelector('#multiplayer-rooms-list');
            if (!roomsList) return;
            
            roomsList.innerHTML = '<div class="multiplayer-rooms-loading">Chargement des salons...</div>';
            
            try {
                // Importer la configuration WebSocket
                const getWebSocketUrl = (await import('../../config/websocket.js')).default;
                const wsUrl = getWebSocketUrl();
                
                // Se connecter temporairement au WebSocket pour recevoir la liste des salons
                const ws = new WebSocket(wsUrl);
                let roomsReceived = false;
                let connectionClosed = false;
                
                const timeout = setTimeout(() => {
                    if (!roomsReceived && !connectionClosed) {
                        connectionClosed = true;
                        ws.close();
                        // Afficher un message mais permettre quand même de créer un salon
                        roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Serveur non disponible. Vous pouvez créer un nouveau salon en choisissant une taille ci-dessus.</div>';
                    }
                }, 3000);
                
                ws.onopen = () => {
                    // La liste sera envoyée automatiquement par le serveur
                };
                
                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'AVAILABLE_ROOMS') {
                            roomsReceived = true;
                            connectionClosed = true;
                            clearTimeout(timeout);
                            displayRooms(roomsList, data.rooms, maxSafeCitySizeToUse, modal);
                            // Ne pas fermer immédiatement, attendre un peu pour recevoir d'autres mises à jour
                            setTimeout(() => {
                                if (ws.readyState === WebSocket.OPEN) {
                                    ws.close();
                                }
                            }, 1000);
                        }
                    } catch (error) {
                        console.error('[Rooms] Erreur parsing:', error);
                    }
                };
                
                ws.onerror = (error) => {
                    console.error('[Rooms] Erreur WebSocket:', error);
                    if (!connectionClosed) {
                        connectionClosed = true;
                        clearTimeout(timeout);
                        // Afficher un message mais permettre quand même de créer un salon
                        roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Serveur non disponible. Vous pouvez créer un nouveau salon en choisissant une taille ci-dessus.</div>';
                    }
                };
                
                ws.onclose = () => {
                    connectionClosed = true;
                };
            } catch (error) {
                console.error('[Rooms] Erreur:', error);
                // Afficher un message mais permettre quand même de créer un salon
                roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Erreur de connexion. Vous pouvez créer un nouveau salon en choisissant une taille ci-dessus.</div>';
            }
        };
        
        // Fonction pour afficher les salons
        const displayRooms = (roomsList, rooms, maxSafeCitySize, modal) => {
            if (!rooms || rooms.length === 0) {
                roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Aucun salon disponible. Créez-en un en choisissant une taille ci-dessus.</div>';
                return;
            }
            
            roomsList.innerHTML = '';
            rooms.forEach(room => {
                const roomEl = document.createElement('div');
                const isCompatible = room.citySize <= maxSafeCitySize;
                const isFull = room.currentPlayers >= room.maxPlayers;
                
                roomEl.className = `multiplayer-room-item ${!isCompatible ? 'room-incompatible' : ''} ${isFull ? 'room-full' : ''}`;
                const roomDisplayName = room.roomName || `Salon ${room.citySize}×${room.citySize}`;
                roomEl.innerHTML = `
                    <div class="room-info">
                        <div class="room-name">${roomDisplayName}</div>
                        <div class="room-details">
                            <div class="room-size">${room.citySize} × ${room.citySize}</div>
                            <div class="room-players">${room.currentPlayers}/${room.maxPlayers} joueurs</div>
                        </div>
                    </div>
                    ${!isCompatible ? '<div class="room-warning">⚠️ Taille non compatible avec votre système</div>' : ''}
                    ${isFull ? '<div class="room-status">Plein</div>' : '<button class="room-join-btn" data-room-id="${room.id}" data-city-size="${room.citySize}">Rejoindre</button>'}
                `;
                
                // Toujours afficher le salon, même s'il est plein ou incompatible
                // Mais seulement permettre de rejoindre si compatible et pas plein
                if (!isFull && isCompatible) {
                    const joinBtn = roomEl.querySelector('.room-join-btn');
                    joinBtn.addEventListener('click', () => {
                        const playerPseudo = pseudoInput ? (pseudoInput.value.trim() || 'Joueur' + Math.floor(Math.random() * 1000)) : 'Joueur';
                        // Fermer la modale et résoudre avec les paramètres du salon
                        modal.classList.remove('active');
                        const chronosLoader = document.getElementById('chronos-loader-modal');
                        if (chronosLoader) {
                            chronosLoader.classList.remove('hidden');
                            chronosLoader.classList.add('opaque');
                        }
                        setTimeout(() => resolve({
                            size: room.citySize,
                            multiplayer: true,
                            pseudo: playerPseudo,
                            roomId: room.id,
                            action: 'join'
                        }), 300);
                    });
                } else if (isFull) {
                    // Salon plein - désactiver visuellement mais toujours afficher
                    const statusEl = roomEl.querySelector('.room-status');
                    if (statusEl) {
                        statusEl.style.fontWeight = '600';
                        statusEl.style.color = '#999';
                    }
                } else if (!isCompatible) {
                    // Salon incompatible - afficher mais avec avertissement
                    const warningEl = roomEl.querySelector('.room-warning');
                    if (warningEl) {
                        warningEl.style.fontWeight = '600';
                    }
                }
                
                roomsList.appendChild(roomEl);
            });
        };
        
        // Charger les salons si le mode multijoueur est déjà activé
        if (savedMultiplayer) {
            const roomsContainer = modal?.querySelector('#multiplayer-rooms-container');
            if (roomsContainer) {
                roomsContainer.style.display = 'block';
                loadAvailableRooms(modal, maxSafeCitySize);
            }
        }
        
        // Configurer les boutons de création de salon
        const createRoomButtons = modal?.querySelectorAll('.multiplayer-create-room-btn');
        if (createRoomButtons) {
            createRoomButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    if (!multiplayerToggle || !multiplayerToggle.checked) {
                        return;
                    }
                    const size = parseInt(btn.dataset.size, 10);
                    // Vérifier la compatibilité WebGL
                    if (size > maxSafeCitySize) {
                        alert(`La taille ${size}×${size} dépasse les capacités de votre système.\nTaille maximale recommandée: ${maxSafeCitySize}×${maxSafeCitySize}.`);
                        return;
                    }
                    createRoom(size);
                });
            });
        }
        
        // Update modal message if system has limitations
        if (messageEl && (webglCapabilities.issues?.length > 0 || webglCapabilities.warnings?.length > 0)) {
            const originalMessage = messageEl.innerHTML;
            let warningText = '';
            if (maxSafeCitySize < theoreticalMaxSize) {
                warningText = `<br><br><strong style="color: #ff9800;">⚠️ Limitation système détectée:</strong> `;
                warningText += `Votre système a des ressources WebGL limitées. `;
                warningText += `Taille maximale recommandée: <strong>${maxSafeCitySize} × ${maxSafeCitySize}</strong>. `;
                if (webglCapabilities.issues?.length > 0) {
                    warningText += `Les tailles supérieures peuvent causer des problèmes de performance ou des erreurs.`;
                }
            }
            messageEl.innerHTML = originalMessage + warningText;
        }
        
        // Helper function to select a size and close modal (SOLO uniquement)
        const selectSize = (size) => {
            // Vérifier que le mode multijoueur n'est pas activé
            if (multiplayerToggle && multiplayerToggle.checked) {
                console.warn('[CitySize] Tentative de sélection solo alors que multijoueur est activé');
                return;
            }
            
            // Clamp size to valid range based on device type
            size = Math.max(12, Math.min(maxSize, size));
            
            // Remove selected class from all options
            options.forEach(opt => opt.classList.remove('selected'));
            
            // Check if it matches a preset option
            const matchingOption = Array.from(options).find(opt => 
                parseInt(opt.dataset.size, 10) === size
            );
            
            if (matchingOption) {
                matchingOption.classList.add('selected');
            } else {
                // Custom size - update input value
                if (customInput) {
                    customInput.value = size;
                }
            }
            
            // Save to localStorage (mode solo)
            localStorage.setItem('selectedCitySize', size.toString());
            localStorage.setItem('multiplayer-enabled', 'false');
            
            // Hide modal
            modal.classList.remove('active');
            
            // Show chronos loader
            const chronosLoader = document.getElementById('chronos-loader-modal');
            if (chronosLoader) {
                chronosLoader.classList.remove('hidden');
                chronosLoader.classList.add('opaque');
            }
            
            // Resolve with selected size (solo)
            setTimeout(() => resolve({ 
                size, 
                multiplayer: false,
                pseudo: null,
                roomId: null,
                action: 'solo'
            }), 300); // Small delay for animation
        };
        
        // Fonction pour créer un salon en mode multijoueur
        const createRoom = (size) => {
            if (!multiplayerToggle || !multiplayerToggle.checked) {
                console.warn('[CitySize] Tentative de créer un salon alors que multijoueur n\'est pas activé');
                return;
            }
            
            const playerPseudo = pseudoInput ? (pseudoInput.value.trim() || 'Joueur' + Math.floor(Math.random() * 1000)) : 'Joueur';
            const roomName = roomNameInput ? roomNameInput.value.trim() : '';
            
            // Clamp size to valid range
            size = Math.max(12, Math.min(maxSize, size));
            
            // Save to localStorage
            localStorage.setItem('selectedCitySize', size.toString());
            localStorage.setItem('multiplayer-enabled', 'true');
            localStorage.setItem('multiplayer-pseudo', playerPseudo);
            if (roomName) {
                localStorage.setItem('multiplayer-room-name', roomName);
            }
            
            // Hide modal
            modal.classList.remove('active');
            
            // Show chronos loader
            const chronosLoader = document.getElementById('chronos-loader-modal');
            if (chronosLoader) {
                chronosLoader.classList.remove('hidden');
                chronosLoader.classList.add('opaque');
            }
            
            // Resolve with selected size for creating a room
            setTimeout(() => resolve({ 
                size, 
                multiplayer: true,
                pseudo: playerPseudo,
                roomId: null,
                roomName: roomName || null,
                action: 'create'
            }), 300);
        };
        
        // Check if user has a saved preference
        const savedSize = parseInt(localStorage.getItem('selectedCitySize'), 10);
        const minSize = 12;
        
        if (savedSize && savedSize >= minSize && savedSize <= maxSize) {
            // Pre-select the saved size (clamp to mobile max if needed)
            const clampedSize = Math.min(savedSize, maxSize);
            const matchingOption = Array.from(options).find(opt => 
                parseInt(opt.dataset.size, 10) === clampedSize
            );
            if (matchingOption) {
                matchingOption.classList.add('selected');
            } else if (customInput && !isMobile) {
                customInput.value = clampedSize;
            }
        } else {
            // Default to 16 on mobile, 24 on desktop
            const defaultSize = isMobile ? 16 : 24;
            const defaultOption = Array.from(options).find(opt => parseInt(opt.dataset.size, 10) === defaultSize);
            if (defaultOption) {
                defaultOption.classList.add('selected');
            }
        }
        
        // Update option buttons based on WebGL capabilities
        options.forEach(option => {
            const size = parseInt(option.dataset.size, 10);
            const isSafe = size <= maxSafeCitySize;
            
            if (!isSafe) {
                // Disable options that exceed system capabilities
                option.disabled = true;
                option.style.opacity = '0.5';
                option.style.cursor = 'not-allowed';
                option.title = `Cette taille dépasse les capacités de votre système (max: ${maxSafeCitySize}×${maxSafeCitySize})`;
                
                // Add warning indicator
                const label = option.querySelector('.city-size-label');
                if (label && !label.querySelector('.webgl-warning')) {
                    const warning = document.createElement('span');
                    warning.className = 'webgl-warning';
                    warning.textContent = ' ⚠️';
                    warning.style.color = '#ff9800';
                    label.appendChild(warning);
                }
            } else {
                option.disabled = false;
                option.style.opacity = '1';
                option.style.cursor = 'pointer';
                option.title = '';
                
                // Remove warning indicator if present
                const warning = option.querySelector('.webgl-warning');
                if (warning) {
                    warning.remove();
                }
            }
        });
        
        // Handle preset option clicks
        options.forEach(option => {
            option.addEventListener('click', () => {
                // Vérifier si le mode multijoueur est activé
                if (multiplayerToggle && multiplayerToggle.checked) {
                    // En mode multijoueur, on ne peut pas utiliser les options solo
                    alert('En mode multijoueur, vous devez créer ou rejoindre un salon. Désactivez le mode multijoueur pour jouer en solo.');
                    return;
                }
                
                if (option.disabled) {
                    // Show alert if user tries to select disabled option
                    const size = parseInt(option.dataset.size, 10);
                    alert(`La taille ${size}×${size} dépasse les capacités de votre système.\nTaille maximale recommandée: ${maxSafeCitySize}×${maxSafeCitySize}.`);
                    return;
                }
                const size = parseInt(option.dataset.size, 10);
                // Mode solo uniquement
                selectSize(size);
            });
        });
        
        // Handle custom input
        if (customInput && customButton) {
            // Update input when preset is selected
            options.forEach(option => {
                option.addEventListener('click', () => {
                    customInput.value = parseInt(option.dataset.size, 10);
                });
            });
            
            // Handle apply button
            customButton.addEventListener('click', () => {
                // Vérifier si le mode multijoueur est activé
                if (multiplayerToggle && multiplayerToggle.checked) {
                    // En mode multijoueur, on ne peut pas utiliser l'input personnalisé solo
                    alert('En mode multijoueur, vous devez créer ou rejoindre un salon. Désactivez le mode multijoueur pour jouer en solo.');
                    return;
                }
                
                const customSize = parseInt(customInput.value, 10);
                    if (!isNaN(customSize) && customSize >= 12 && customSize <= maxSize) {
                        // Check if size is safe for WebGL
                        const safetyCheck = webglDetector.isCitySizeSafe(customSize);
                        if (!safetyCheck.safe) {
                            const proceed = confirm(`${safetyCheck.reason}\n\nVoulez-vous continuer quand même? (Non recommandé)`);
                            if (!proceed) {
                                customInput.value = maxSafeCitySize;
                                customInput.focus();
                                return;
                            }
                        }
                        // Mode solo uniquement
                        selectSize(customSize);
                } else {
                    alert(`Veuillez entrer une taille entre 12 et ${maxSize}${maxSize < theoreticalMaxSize ? ` (limité par les capacités de votre système)` : ''}.`);
                    customInput.focus();
                }
            });
            
            // Update input max attribute
            if (customInput) {
                customInput.max = maxSize;
                customInput.setAttribute('max', maxSize.toString());
            }
            
            // Handle Enter key in input
            customInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    customButton.click();
                }
            });
        }
    });
}
