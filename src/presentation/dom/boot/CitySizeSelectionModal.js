import webglDetector from '../shell/WebGLResourceDetector.js';

const OFFICIAL_CITY_SIZES = [12, 16];
const DEFAULT_CITY_SIZE = 16;

export function showCitySizeSelection() {
    return new Promise((resolve) => {
        const modal = document.getElementById('city-size-selection-modal');
        const options = modal?.querySelectorAll('.city-size-option');
        const messageEl = modal?.querySelector('.city-size-selection-message');
        const multiplayerToggle = modal?.querySelector('#multiplayer-toggle');

        if (!modal || !options) {
            resolve({ size: DEFAULT_CITY_SIZE, multiplayer: false });
            return;
        }

        const webglCapabilities = webglDetector.detectCapabilities();
        const maxSafeCitySize = webglDetector.getMaxSafeCitySize();
        const maxSize = Math.min(DEFAULT_CITY_SIZE, maxSafeCitySize);

        const pseudoInput = modal?.querySelector('#multiplayer-pseudo');
        const roomNameInput = modal?.querySelector('#multiplayer-room-name');

        const toggleSoloOptions = (enabled) => {
            const optionsContainer = modal?.querySelector('.city-size-options');
            if (enabled) {
                options.forEach((option) => {
                    option.style.pointerEvents = '';
                    option.style.opacity = option.disabled ? '0.5' : '1';
                    option.style.cursor = option.disabled ? 'not-allowed' : 'pointer';
                    option.style.display = '';
                });
                if (optionsContainer) {
                    optionsContainer.classList.remove('disabled');
                    optionsContainer.style.display = '';
                }
            } else {
                options.forEach((option) => {
                    option.style.pointerEvents = 'none';
                    option.style.display = 'none';
                });
                if (optionsContainer) {
                    optionsContainer.classList.add('disabled');
                    optionsContainer.style.display = 'none';
                }
            }
        };

        // Multijoueur : logique conservée mais non exposée dans l'UI officielle
        if (multiplayerToggle) {
            multiplayerToggle.checked = false;
            toggleSoloOptions(true);

            multiplayerToggle.addEventListener('change', () => {
                const isMultiplayer = multiplayerToggle.checked;
                const multiplayerSection = modal?.querySelector('#multiplayer-section');
                if (multiplayerSection) {
                    multiplayerSection.style.display = isMultiplayer ? 'block' : 'none';
                }
                if (isMultiplayer) {
                    loadAvailableRooms(modal, maxSafeCitySize);
                }
                toggleSoloOptions(!isMultiplayer);
            });
        }

        const loadAvailableRooms = async (modalEl, maxSafeCitySizeParam) => {
            const roomsList = modalEl?.querySelector('#multiplayer-rooms-list');
            if (!roomsList) return;

            roomsList.innerHTML = '<div class="multiplayer-rooms-loading">Chargement des salons...</div>';

            try {
                const getWebSocketUrl = (await import('../../../config/websocket.js')).default;
                const wsUrl = getWebSocketUrl();
                const ws = new WebSocket(wsUrl);
                let roomsReceived = false;
                let connectionClosed = false;

                const timeout = setTimeout(() => {
                    if (!roomsReceived && !connectionClosed) {
                        connectionClosed = true;
                        ws.close();
                        roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Serveur non disponible.</div>';
                    }
                }, 3000);

                ws.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        if (data.type === 'AVAILABLE_ROOMS') {
                            roomsReceived = true;
                            connectionClosed = true;
                            clearTimeout(timeout);
                            displayRooms(roomsList, data.rooms, maxSafeCitySizeParam, modalEl);
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

                ws.onerror = () => {
                    if (!connectionClosed) {
                        connectionClosed = true;
                        clearTimeout(timeout);
                        roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Serveur non disponible.</div>';
                    }
                };

                ws.onclose = () => {
                    connectionClosed = true;
                };
            } catch (error) {
                console.error('[Rooms] Erreur:', error);
                roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Erreur de connexion.</div>';
            }
        };

        const displayRooms = (roomsList, rooms, safeMaxSize, modalEl) => {
            if (!rooms || rooms.length === 0) {
                roomsList.innerHTML = '<div class="multiplayer-rooms-empty">Aucun salon disponible.</div>';
                return;
            }

            roomsList.innerHTML = '';
            rooms.forEach((room) => {
                const roomEl = document.createElement('div');
                const isCompatible = room.citySize <= safeMaxSize;
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
                    ${!isCompatible ? '<div class="room-warning">⚠️ Taille non compatible</div>' : ''}
                    ${isFull ? '<div class="room-status">Plein</div>' : `<button class="room-join-btn" data-room-id="${room.id}" data-city-size="${room.citySize}">Rejoindre</button>`}
                `;

                if (!isFull && isCompatible) {
                    const joinBtn = roomEl.querySelector('.room-join-btn');
                    joinBtn.addEventListener('click', () => {
                        const playerPseudo = pseudoInput?.value.trim() || `Joueur${Math.floor(Math.random() * 1000)}`;
                        modalEl.classList.remove('active');
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
                            action: 'join',
                        }), 300);
                    });
                }

                roomsList.appendChild(roomEl);
            });
        };

        const createRoomButtons = modal?.querySelectorAll('.multiplayer-create-room-btn');
        createRoomButtons?.forEach((btn) => {
            btn.addEventListener('click', () => {
                if (!multiplayerToggle?.checked) return;
                const size = parseInt(btn.dataset.size, 10);
                if (size > maxSafeCitySize) {
                    alert(`La taille ${size}×${size} dépasse les capacités de votre système.\nTaille maximale recommandée: ${maxSafeCitySize}×${maxSafeCitySize}.`);
                    return;
                }
                createRoom(size);
            });
        });

        if (messageEl && (webglCapabilities.issues?.length > 0 || webglCapabilities.warnings?.length > 0)) {
            if (maxSafeCitySize < DEFAULT_CITY_SIZE) {
                messageEl.innerHTML = `<strong style="color: #ff9800;">⚠️</strong> Taille maximale recommandée : <strong>${maxSafeCitySize} × ${maxSafeCitySize}</strong>.`;
            }
        }

        const selectSize = (size) => {
            if (multiplayerToggle?.checked) {
                return;
            }

            size = Math.max(12, Math.min(maxSize, size));
            if (!OFFICIAL_CITY_SIZES.includes(size)) {
                size = DEFAULT_CITY_SIZE;
            }

            options.forEach((opt) => opt.classList.remove('selected'));
            const matchingOption = Array.from(options).find(
                (opt) => parseInt(opt.dataset.size, 10) === size,
            );
            matchingOption?.classList.add('selected');

            localStorage.setItem('selectedCitySize', size.toString());
            localStorage.setItem('multiplayer-enabled', 'false');

            modal.classList.remove('active');

            const chronosLoader = document.getElementById('chronos-loader-modal');
            if (chronosLoader) {
                chronosLoader.classList.remove('hidden');
                chronosLoader.classList.add('opaque');
            }

            setTimeout(() => resolve({
                size,
                multiplayer: false,
                pseudo: null,
                roomId: null,
                action: 'solo',
            }), 300);
        };

        const createRoom = (size) => {
            if (!multiplayerToggle?.checked) return;

            const playerPseudo = pseudoInput?.value.trim() || `Joueur${Math.floor(Math.random() * 1000)}`;
            const roomName = roomNameInput?.value.trim() || '';

            size = Math.max(12, Math.min(maxSize, size));

            localStorage.setItem('selectedCitySize', size.toString());
            localStorage.setItem('multiplayer-enabled', 'true');
            localStorage.setItem('multiplayer-pseudo', playerPseudo);
            if (roomName) {
                localStorage.setItem('multiplayer-room-name', roomName);
            }

            modal.classList.remove('active');

            const chronosLoader = document.getElementById('chronos-loader-modal');
            if (chronosLoader) {
                chronosLoader.classList.remove('hidden');
                chronosLoader.classList.add('opaque');
            }

            setTimeout(() => resolve({
                size,
                multiplayer: true,
                pseudo: playerPseudo,
                roomId: null,
                roomName: roomName || null,
                action: 'create',
            }), 300);
        };

        const savedSize = parseInt(localStorage.getItem('selectedCitySize'), 10);
        const initialSize = OFFICIAL_CITY_SIZES.includes(savedSize) ? savedSize : DEFAULT_CITY_SIZE;

        options.forEach((opt) => opt.classList.remove('selected'));
        const initialOption = Array.from(options).find(
            (opt) => parseInt(opt.dataset.size, 10) === initialSize,
        );
        (initialOption || options[1])?.classList.add('selected');

        options.forEach((option) => {
            const size = parseInt(option.dataset.size, 10);
            const isSafe = size <= maxSafeCitySize;

            if (!isSafe) {
                option.disabled = true;
                option.style.opacity = '0.5';
                option.style.cursor = 'not-allowed';
                option.title = `Taille non compatible (max: ${maxSafeCitySize}×${maxSafeCitySize})`;

                const valueEl = option.querySelector('.city-size-value');
                if (valueEl && !valueEl.querySelector('.webgl-warning')) {
                    const warning = document.createElement('span');
                    warning.className = 'webgl-warning';
                    warning.textContent = ' ⚠️';
                    warning.style.color = '#ff9800';
                    valueEl.appendChild(warning);
                }
            } else {
                option.disabled = false;
                option.style.opacity = '1';
                option.style.cursor = 'pointer';
                option.title = '';
                option.querySelector('.webgl-warning')?.remove();
            }
        });

        options.forEach((option) => {
            option.addEventListener('click', () => {
                if (multiplayerToggle?.checked) return;
                if (option.disabled) {
                    const size = parseInt(option.dataset.size, 10);
                    alert(`La taille ${size}×${size} dépasse les capacités de votre système.\nTaille maximale recommandée: ${maxSafeCitySize}×${maxSafeCitySize}.`);
                    return;
                }
                selectSize(parseInt(option.dataset.size, 10));
            });
        });
    });
}
