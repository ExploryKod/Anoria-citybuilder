/**
 * LoaderManager - Gestion réutilisable de la modal de chargement Chronos
 */

class LoaderManager {
    constructor() {
        this.modal = document.getElementById('chronos-loader-modal');
        this.isVisible = false;
    }

    /**
     * Affiche la modal de chargement
     * @param {Object} options - Options de configuration
     * @param {string} options.title - Titre de la modal (défaut: "Chronos crée le temps")
     * @param {string} options.message - Message à afficher (défaut: "Votre monde est bientôt prêt...")
     * @param {boolean} options.semiTransparent - Si true, fond semi-transparent, sinon opaque (défaut: false)
     */
    show({ 
        title = "Chronos crée le temps", 
        message = "Votre monde est bientôt prêt...",
        semiTransparent = false 
    } = {}) {
        if (!this.modal) {
            console.warn('Loader modal not found');
            return;
        }

        // Update content
        const titleEl = this.modal.querySelector('.chronos-loader-title');
        const messageEl = this.modal.querySelector('.chronos-loader-message');
        
        if (titleEl) titleEl.textContent = title;
        if (messageEl) messageEl.textContent = message;

        // Set background opacity
        if (semiTransparent) {
            this.modal.classList.remove('opaque');
            this.modal.classList.add('semi-transparent');
        } else {
            this.modal.classList.remove('semi-transparent');
            this.modal.classList.add('opaque');
        }

        // Show modal
        this.modal.classList.remove('hidden');
        this.isVisible = true;
    }

    /**
     * Cache la modal de chargement
     * @param {number} delay - Délai en ms avant de cacher (défaut: 0)
     */
    hide(delay = 0) {
        if (!this.modal) {
            return;
        }

        if (delay > 0) {
            setTimeout(() => {
                this.modal.classList.add('hidden');
                this.isVisible = false;
            }, delay);
        } else {
            this.modal.classList.add('hidden');
            this.isVisible = false;
        }
    }

    /**
     * Vérifie si la modal est visible
     * @returns {boolean}
     */
    isShowing() {
        return this.isVisible;
    }
}

// Export singleton instance
const loaderManager = new LoaderManager();

export default loaderManager;

