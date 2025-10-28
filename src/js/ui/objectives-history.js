/**
 * Gestion de l'historique des objectifs (succès et échecs)
 */

class ObjectivesHistory {
    constructor() {
        this.isOpen = false;
        this.init();
    }

    init() {
    }

    /**
     * Affiche l'historique des objectifs
     */
    async showHistory() {
        if (this.isOpen) return;

        try {
            // Récupérer toutes les données du store
            const allRecords = await window.objectivesStore.getAllFailures();
            
            const failures = allRecords.filter(r => r.name?.startsWith('failure_'));
            const successes = allRecords.filter(r => r.name?.startsWith('success_'));

            // Créer l'overlay
            const overlay = document.createElement('div');
            overlay.className = 'objectives-history-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 2, 53, 0.85);
                z-index: 10000;
                backdrop-filter: blur(3px);
            `;

            // Créer la modal
            const modal = document.createElement('div');
            modal.className = 'objectives-history-modal';
            modal.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: #fafafa;
                border: 3px solid var(--cta);
                border-radius: 10px;
                padding: 20px;
                max-width: 700px;
                width: 90%;
                max-height: 80vh;
                overflow-y: auto;
                z-index: 10001;
                color: var(--primary);
                box-shadow: 0 8px 40px rgba(0, 0, 0, 0.5);
            `;

            let html = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 3px solid var(--cta); padding-bottom: 12px;">
                    <h2 style="margin: 0; color: var(--cta); font-size: 22px;">📜 Historique des Objectifs</h2>
                    <button id="close-history-btn" style="background: var(--cta); color: white; border: none; border-radius: 10px; padding: 8px 16px; cursor: pointer; font-weight: 600; font-size: 14px;">Fermer</button>
                </div>
            `;

            // Section des succès
            if (successes.length > 0) {
                html += `
                    <div style="margin-bottom: 30px;">
                        <h3 style="color: #28a745; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #28a745; padding-bottom: 8px;">✅ Succès (${successes.length})</h3>
                        ${successes.map((success, index) => this.renderSuccess(success)).join('')}
                    </div>
                `;
            }

            // Section des échecs
            if (failures.length > 0) {
                html += `
                    <div>
                        <h3 style="color: #dc3545; margin: 0 0 15px 0; font-size: 18px; border-bottom: 2px solid #dc3545; padding-bottom: 8px;">❌ Échecs (${failures.length})</h3>
                        ${failures.map((failure, index) => this.renderFailure(failure)).join('')}
                    </div>
                `;
            }

            // Message si aucune donnée
            if (failures.length === 0 && successes.length === 0) {
                html += `
                    <div style="text-align: center; padding: 40px; color: var(--primary); opacity: 0.6;">
                        <p style="margin: 0; font-size: 16px;">Aucun historique disponible pour le moment.</p>
                    </div>
                `;
            }

            modal.innerHTML = html;
            document.body.appendChild(overlay);
            document.body.appendChild(modal);

            // Gestionnaire de fermeture
            const closeBtn = modal.querySelector('#close-history-btn');
            closeBtn.addEventListener('click', () => this.closeHistory());
            
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeHistory();
            });

            this.isOpen = true;

            // Désactiver les événements Three.js
            if (window.tutorialManager && window.tutorialManager.disableThreeJSEvents) {
                window.tutorialManager.disableThreeJSEvents();
            }
        } catch (error) {
            console.error('Error showing objectives history:', error);
        }
    }

    /**
     * Affiche un succès
     */
    renderSuccess(success) {
        const date = new Date(success.recordedAt).toLocaleString('fr-FR');
        const details = success.successDetails || {};
        
        return `
            <div style="background: rgba(40, 167, 69, 0.05); border: 2px solid rgba(40, 167, 69, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #28a745; font-size: 16px;">🎉 ${details.title || 'Objectif réussi'}</strong>
                    <span style="color: var(--primary); font-size: 12px; opacity: 0.7;">Tour ${success.successTurn}</span>
                </div>
                <p style="margin: 5px 0; color: var(--primary); font-size: 14px;">${details.description || ''}</p>
                ${details.minNetFlow !== undefined ? `
                    <div style="margin-top: 10px; font-size: 13px; color: var(--primary);">
                        <strong>Résultats :</strong>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            ${details.minNetFlow !== Infinity ? `<li>Flux net minimum: ${details.minNetFlow}€</li>` : ''}
                            ${details.maxNetFlow !== -Infinity ? `<li>Flux net maximum: ${details.maxNetFlow}€</li>` : ''}
                            ${details.fundsAtTargetDay !== null && details.fundsAtTargetDay !== undefined ? `<li>Fonds à la date cible: ${details.fundsAtTargetDay}€</li>` : ''}
                            <li>Nombre de tentatives: ${details.totalAttempts || 1}</li>
                        </ul>
                    </div>
                ` : ''}
                <div style="margin-top: 8px; color: var(--primary); font-size: 11px; opacity: 0.6;">${date}</div>
            </div>
        `;
    }

    /**
     * Affiche un échec
     */
    renderFailure(failure) {
        const date = new Date(failure.recordedAt).toLocaleString('fr-FR');
        const details = failure.failureDetails || {};
        
        return `
            <div style="background: rgba(220, 53, 69, 0.05); border: 2px solid rgba(220, 53, 69, 0.3); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                    <strong style="color: #dc3545; font-size: 16px;">❌ Échec d'objectif</strong>
                    <span style="color: var(--primary); font-size: 12px; opacity: 0.7;">Tour ${failure.failureTurn}</span>
                </div>
                <p style="margin: 5px 0; color: var(--primary); font-size: 14px;"><strong>Raison:</strong> ${failure.failureReason || 'Inconnue'}</p>
                ${Object.keys(details).length > 0 ? `
                    <div style="margin-top: 10px; font-size: 13px; color: var(--primary);">
                        <strong>Détails:</strong>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            ${details.minNetFlow !== undefined && details.minNetFlow !== Infinity ? `<li>Flux net minimum: ${details.minNetFlow}€ (tour ${details.minNetFlowTurn || 'N/A'})</li>` : ''}
                            ${details.maxNetFlow !== undefined && details.maxNetFlow !== -Infinity ? `<li>Flux net maximum atteint: ${details.maxNetFlow}€ (tour ${details.maxNetFlowTurn || 'N/A'})</li>` : ''}
                            ${details.fundsAtTargetDay !== undefined && details.fundsAtTargetDay !== null ? `<li>Fonds max atteints: ${details.fundsAtTargetDay}€ (cible: ${details.requiredFunds || 600}€)</li>` : ''}
                            ${details.targetDay !== undefined ? `<li>Cible au tour: ${details.targetDay}</li>` : ''}
                            ${details.resetCount !== undefined ? `<li>Nombre de rééchelonnements: ${details.resetCount}</li>` : ''}
                        </ul>
                    </div>
                ` : ''}
                <div style="margin-top: 8px; color: var(--primary); font-size: 11px; opacity: 0.6;">${date}</div>
            </div>
        `;
    }

    /**
     * Ferme l'historique
     */
    closeHistory() {
        const overlay = document.querySelector('.objectives-history-overlay');
        const modal = document.querySelector('.objectives-history-modal');
        
        if (overlay) overlay.remove();
        if (modal) modal.remove();
        
        this.isOpen = false;

        // Réactiver les événements Three.js
        if (window.tutorialManager && window.tutorialManager.enableThreeJSEvents) {
            window.tutorialManager.enableThreeJSEvents();
        }
    }
}

const objectivesHistory = new ObjectivesHistory();
window.objectivesHistory = objectivesHistory;
export default objectivesHistory;

