import { registerAppService } from '../acl/appRuntime.js';

class ReportSectionManager {
    constructor() {
        this.periodType = 'year';
        this.reportData = null;
    }

    init() {
        this.loadReportData();
    }

    async loadReportData() {
        this.reportData = this.generatePlaceholderReport();
        this.render();
    }

    generatePlaceholderReport() {
        return {
            period: {
                type: 'year',
                label: 'cette année'
            },
            items: [
                { category: 'Emploi', status: 'normal', message: 'La ville n\'a pas de problèmes d\'emploi' },
                { category: 'Finances', status: 'normal', message: 'Aucun changement prévu' },
                { category: 'Migration', status: 'danger', message: 'Le manque de logements empêche l\'immigration' },
                { category: 'Stocks alimentaires', status: 'danger', message: 'Nos niveaux de nourriture sont faibles' },
                { category: 'Consommation alimentaire', status: 'danger', message: 'AUCUNE NOURRITURE stockée le mois dernier !' },
                { category: 'Militaire', status: 'positive', message: 'Aucune menace signalée' },
                { category: 'Criminalité', status: 'positive', message: 'Aucun problème signalé' },
                { category: 'Santé', status: 'normal', message: 'La santé de la ville est moyenne' },
                { category: 'Éducation', status: 'positive', message: 'Aucun problème signalé' },
                { category: 'Religion', status: 'positive', message: 'Tous les besoins sont satisfaits' },
                { category: 'Divertissement', status: 'positive', message: 'Tous les besoins sont satisfaits' },
                { category: 'Sentiment de la ville', status: 'positive', message: 'Les habitants sont satisfaits de vous' }
            ]
        };
    }

    setPeriodType(type) {
        const periodLabels = {
            'month': 'ce mois',
            'season': 'cette saison',
            'year': 'cette année'
        };
        
        this.periodType = type;
        if (this.reportData) {
            this.reportData.period = {
                type: type,
                label: periodLabels[type] || 'cette année'
            };
            this.updatePeriodDisplay();
        }
    }

    updatePeriodDisplay() {
        const periodInfo = document.getElementById('report-period-info');
        if (periodInfo && this.reportData) {
            periodInfo.textContent = `Rapport basé sur les données de ${this.reportData.period.label}`;
        }
    }

    render() {
        if (!this.reportData) return;

        this.updatePeriodDisplay();
        this.renderReportItems();
    }

    renderReportItems() {
        const reportList = document.getElementById('report-list');
        if (!reportList || !this.reportData) return;

        reportList.innerHTML = this.reportData.items.map(item => {
            const statusClass = item.status || 'normal';
            const statusTextClass = `report-item-status ${statusClass}`;
            
            return `
                <div class="report-item ${statusClass}">
                    <div class="report-item-bullet"></div>
                    <div class="report-item-content">
                        <div class="report-item-label">${item.category}</div>
                        <div class="${statusTextClass}">${item.message}</div>
                    </div>
                </div>
            `;
        }).join('');
    }

    updateReportItem(category, status, message) {
        if (!this.reportData) return;

        const item = this.reportData.items.find(i => i.category === category);
        if (item) {
            item.status = status;
            item.message = message;
            this.renderReportItems();
        }
    }

    addReportItem(category, status, message) {
        if (!this.reportData) return;

        this.reportData.items.push({ category, status, message });
        this.renderReportItems();
    }
}

function initReportSection() {
    const reportSection = document.getElementById('admin-section-report');
    if (!reportSection) return;

    const manager = new ReportSectionManager();
    
    const observer = new MutationObserver(() => {
        if (reportSection.classList.contains('active')) {
            manager.init();
            observer.disconnect();
        }
    });

    observer.observe(reportSection, { attributes: true, attributeFilter: ['class'] });

    if (reportSection.classList.contains('active')) {
        manager.init();
        observer.disconnect();
    }

    registerAppService('reportSectionManager', manager);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReportSection);
} else {
    initReportSection();
}

