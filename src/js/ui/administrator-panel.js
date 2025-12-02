/**
 * Administrator Panel Manager
 * Gère l'ouverture, la fermeture et la navigation entre les sections du panneau administrateur
 */

function initAdministratorPanel() {
    const administratorPanel = document.getElementById('administrator-panel');
    const administratorCloseBtn = document.getElementById('administrator-panel-close-btn');
    const navButtons = document.querySelectorAll('.administrator-nav-btn');
    const sections = document.querySelectorAll('.administrator-section');

    if (!administratorPanel || !administratorCloseBtn) {
        console.warn('Administrator panel elements not found');
        return;
    }

    // Function to open the panel
    function openPanel() {
        administratorPanel.classList.add('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceOpenPopup('administrator-panel');
        }
        
        // Show first section by default
        if (sections.length > 0) {
            showSection('finances');
        }
    }

    // Function to close the panel
    function closePanel() {
        administratorPanel.classList.remove('active');
        
        // Utiliser PopupManager pour gérer les événements
        if (window.popupManager) {
            window.popupManager.forceClosePopup('administrator-panel');
        }
    }

    // Function to show a specific section
    function showSection(sectionId) {
        // Hide all sections
        sections.forEach(section => {
            section.classList.remove('active');
        });

        // Remove selected class from all nav buttons
        navButtons.forEach(btn => {
            btn.classList.remove('selected');
        });

        // Show the selected section
        const targetSection = document.getElementById(`admin-section-${sectionId}`);
        if (targetSection) {
            targetSection.classList.add('active');
        }

        // Add selected class to the corresponding nav button
        const targetButton = document.querySelector(`[data-section="${sectionId}"]`);
        if (targetButton) {
            targetButton.classList.add('selected');
        }
    }

    // Close button event listener
    administratorCloseBtn.addEventListener('click', () => {
        closePanel();
    });

    // Navigation buttons event listeners
    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = btn.dataset.section;
            if (sectionId) {
                showSection(sectionId);
            }
        });
    });

    // Close panel when clicking outside
    administratorPanel.addEventListener('click', (e) => {
        if (e.target === administratorPanel) {
            closePanel();
        }
    });

    // Expose openPanel function globally for use by other components
    window.openAdministratorPanel = openPanel;
    window.closeAdministratorPanel = closePanel;
    window.showAdministratorSection = showSection;

    // Add event listener for the administrator button in info-box-stats
    const administratorBtn = document.getElementById('administrator-btn');
    if (administratorBtn) {
        administratorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openPanel();
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdministratorPanel);
} else {
    initAdministratorPanel();
}

