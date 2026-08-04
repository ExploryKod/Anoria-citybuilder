/**
 * Construction / WebGL toast notifications (DOM).
 */

const BUILDING_TRANSLATIONS = {
    grass: 'Herbe',
    roads: 'Route',
    Road: 'Route',
    'StonePath-001': 'Chemin de pierre',
    'StonePath-Right-001': 'Chemin de pierre',
    'StonePath-Left-001': 'Chemin de pierre',
    'StonePath-Cross-001': 'Chemin de pierre',

    'House-Blue': 'Maison bleue',
    'House-Red': 'Maison rouge',
    'House-Purple': 'Maison violette',
    'House-2Story': 'Palais',

    'Tombstone-1': 'Pierre tombale',
    'Tombstone-2': 'Pierre tombale',
    'Tombstone-3': 'Pierre tombale',
    'Grave-1': 'Tombe',
    'Grave-2': 'Tombe',
    Tomb: 'Tombeau',
    Coffin: 'Cercueil',

    'Farm-Wheat': 'Champ de blé',
    'Farm-Carrot': 'Champ de carottes',
    'Farm-Cabbage': 'Champ de choux',
    'Hay-Bale': 'Botte de foin',
    'Hay-Cart': 'Chariot de foin',
    'Hay-Pile': 'Meule de foin',

    'Windmill-001': 'Moulin',
    'Barn-001': 'Grange',
    'Crate-001': 'Caisse',
    'Winery-001': 'Chai',
    Cylinder: 'Silo à blé',

    'Market-Stall': 'Étal',
    'Market-Stall-Blue': 'Étal bleu',
    'Market-Stall-Red': 'Étal rouge',

    'Well-001': 'Puits',
    'Fountain-001': 'Fontaine',
    'Streetlight-001': 'Réverbère',
    'Fence-001': 'Clôture',
    'Pond-001': 'Étang',
    'Plane-001': 'Dalle petite',
    'Plane-004': 'Dalle moyenne',
    'Plane-007': 'Dalle grande',
    Cube: 'Bloc',
    'Sphere-001': 'Sphère',
    'Sphere-002': 'Sphère sombre',

    Chapel: 'Chapelle',
    'Church-002': 'Chapelle',
    'BookShop-001': 'Librairie',

    'Tree-Pine-001': 'Sapin',
    'Tree-Square-001': 'Arbuste',
    'Tree-Tall-001': 'Chêne',
    'Tree-Sapin': 'Sapin',
    'Tree-Arbuste': 'Arbuste',
    'Tree-Chene': 'Chêne',
    'Boulder-001': 'Rocher',

    Bench: 'Banc',
    'Picnic-Table': 'Table de pique-nique',
    'Potted-Bush': 'Buisson en pot',
    Daisy: 'Marguerite',
    Shroom: 'Champignon',
    Arch: 'Arche',
    Obelisk: 'Obélisque',
    Pillar: 'Pilier',
    Garland: 'Guirlande',
    Barrell: 'Tonneau',
};

export function getBuildingDisplayName(buildingId) {
    if (!buildingId) return buildingId;
    if (BUILDING_TRANSLATIONS[buildingId]) {
        return BUILDING_TRANSLATIONS[buildingId];
    }
    for (const [key, value] of Object.entries(BUILDING_TRANSLATIONS)) {
        if (buildingId.startsWith(key)) {
            return value;
        }
    }
    return String(buildingId)
        .replace(/-\d+$/g, '')
        .replace(/-/g, ' ');
}

function translateErrorReason(reason) {
    const translations = {
        'area_not_available': 'Espace non disponible',
        'insufficient_funds': 'Fonds insuffisants',
        'building_already_exists': 'Un bâtiment existe déjà à cet emplacement',
        'database_error': "Erreur lors de l'enregistrement du bâtiment",
        'persistence_conflict': 'Conflit de sauvegarde — réessaie dans un instant',
    };
    return translations[reason] || reason;
}

function ensureBuildingNotificationStyles() {
    if (document.querySelector('#building-notification-styles')) return;
    const style = document.createElement('style');
    style.id = 'building-notification-styles';
    style.textContent = `
        @keyframes slideDown {
            from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
            to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes slideUp {
            from { opacity: 1; transform: translateX(-50%) translateY(0); }
            to { opacity: 0; transform: translateX(-50%) translateY(-20px); }
        }
        .building-notification .notification-content {
            display: flex; align-items: center; gap: 12px;
        }
        .building-notification .notification-icon { font-size: 20px; flex-shrink: 0; }
        .building-notification .notification-text { flex: 1; }
        .building-notification .notification-title {
            font-weight: 600; font-size: 16px; margin-bottom: 4px;
        }
        .building-notification .notification-message { font-size: 13px; opacity: 0.9; }
    `;
    document.head.appendChild(style);
}

function dismissNotification(notification, delayMs) {
    setTimeout(() => {
        notification.style.animation = 'slideUp 0.3s ease-out';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, delayMs);
}

export function showInsufficientFundsNotification(buildingType, price) {
    ensureBuildingNotificationStyles();
    const displayName = getBuildingDisplayName(buildingType);
    const notification = document.createElement('div');
    notification.className = 'building-notification insufficient-funds';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">💰</div>
            <div class="notification-text">
                <div class="notification-title">Fonds Insuffisants</div>
                <div class="notification-message">Impossible de construire ${displayName}. Coût : ${price}€</div>
            </div>
        </div>
    `;
    notification.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a52 100%);
        color: white; padding: 15px 25px; border-radius: 12px;
        box-shadow: 0 8px 25px rgba(255, 107, 107, 0.3); z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px; font-weight: 500; max-width: 350px;
        animation: slideDown 0.3s ease-out; border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    document.body.appendChild(notification);
    dismissNotification(notification, 4000);
}

export function showGenericErrorNotification(buildingType, reason) {
    ensureBuildingNotificationStyles();
    const displayName = getBuildingDisplayName(buildingType);
    const translatedReason = translateErrorReason(reason);
    const notification = document.createElement('div');
    notification.className = 'building-notification generic-error';
    notification.innerHTML = `
        <div class="notification-content">
            <div class="notification-icon">⚠️</div>
            <div class="notification-text">
                <div class="notification-title">Erreur de Construction</div>
                <div class="notification-message">Impossible de construire ${displayName}. ${translatedReason}</div>
            </div>
        </div>
    `;
    notification.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: linear-gradient(135deg, #ffa726 0%, #ff9800 100%);
        color: white; padding: 15px 25px; border-radius: 12px;
        box-shadow: 0 8px 25px rgba(255, 167, 38, 0.3); z-index: 10000;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px; font-weight: 500; max-width: 350px;
        animation: slideDown 0.3s ease-out; border: 1px solid rgba(255, 255, 255, 0.2);
    `;
    document.body.appendChild(notification);
    dismissNotification(notification, 4000);
}

/**
 * @param {object} _capabilities
 * @param {number} requestedSize
 * @param {number} maxSafeSize
 */
export function showWebGLResourceWarning(_capabilities, requestedSize, maxSafeSize) {
    ensureBuildingNotificationStyles();
    const warningKey = `webgl-warning-dismissed-${maxSafeSize}`;
    if (localStorage.getItem(warningKey) === 'true') {
        return;
    }

    const notification = document.createElement('div');
    notification.className = 'building-notification webgl-resource-warning';

    const simpleMessage = requestedSize > maxSafeSize
        ? `Taille réduite à ${maxSafeSize}×${maxSafeSize} (limite système)`
        : `Taille maximale recommandée: ${maxSafeSize}×${maxSafeSize}`;

    notification.innerHTML = `
        <div class="notification-content" style="display: flex; align-items: flex-start; gap: 12px; position: relative; padding-right: 30px;">
            <div class="notification-icon" style="font-size: 24px; flex-shrink: 0; margin-top: 2px;">⚠️</div>
            <div class="notification-text" style="flex: 1;">
                <div class="notification-message" style="color: #000; font-size: 14px; line-height: 1.4;">${simpleMessage}</div>
            </div>
            <button type="button" class="notification-close" style="
                position: absolute; top: 4px; right: 4px; background: none; border: none;
                color: #666; font-size: 22px; line-height: 1; cursor: pointer; padding: 0;
                width: 24px; height: 24px; display: flex; align-items: center; justify-content: center;
                opacity: 0.6; transition: opacity 0.2s;
            "
            onmouseover="this.style.opacity='1'"
            onmouseout="this.style.opacity='0.6'"
            onclick="this.closest('.webgl-resource-warning').remove(); localStorage.setItem('${warningKey}', 'true');">×</button>
        </div>
    `;
    notification.style.cssText = `
        position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
        background: #ffffff; color: #000000; padding: 16px 20px; border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15); z-index: 10001;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        font-size: 14px; max-width: 400px; animation: slideDown 0.3s ease-out;
        border: 2px solid #ff9800;
    `;
    document.body.appendChild(notification);
    dismissNotification(notification, 6000);
}
