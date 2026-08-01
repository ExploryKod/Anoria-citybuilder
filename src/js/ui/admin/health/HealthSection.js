import { registerAppService } from '../../../acl/appRuntime.js';

class HealthSectionPresenter {
    constructor() {
        this.healthData = null;
    }

    init() {
        this.loadHealthData();
    }

    async loadHealthData() {
        this.healthData = this.generatePlaceholderHealthData();
        this.render();
    }

    generatePlaceholderHealthData() {
        return {
            coverage: {
                doctor: 75,
                hospital: 60,
                medicines: 80
            },
            risks: {
                depression: 12,
                suicide: 3
            },
            nutrition: {
                hungry: { percentage: 8, absolute: 240 },
                nourished: { percentage: 65, absolute: 1950 },
                wellBalanced: { percentage: 27, absolute: 810 }
            },
            sickness: {
                light: 15,
                medium: 5,
                fatal: 1
            },
            death: {
                rate: 2.3,
                majorDisease: 'Pneumonie'
            }
        };
    }

    getCoverageStatus(coverage) {
        if (coverage >= 70) return { class: '', fillClass: '' };
        if (coverage >= 40) return { class: 'medium-risk', fillClass: 'medium' };
        return { class: 'low-risk', fillClass: 'low' };
    }

    getRiskStatus(risk) {
        if (risk < 5) return { class: 'low-risk', valueClass: 'low-risk' };
        if (risk < 15) return { class: 'medium-risk', valueClass: 'medium-risk' };
        return { class: 'high-risk', valueClass: 'high-risk' };
    }

    render() {
        if (!this.healthData) return;

        const healthSections = document.getElementById('health-sections');
        if (!healthSections) return;

        const doctorStatus = this.getCoverageStatus(this.healthData.coverage.doctor);
        const hospitalStatus = this.getCoverageStatus(this.healthData.coverage.hospital);
        const medicinesStatus = this.getCoverageStatus(this.healthData.coverage.medicines);
        const depressionStatus = this.getRiskStatus(this.healthData.risks.depression);
        const suicideStatus = this.getRiskStatus(this.healthData.risks.suicide);

        healthSections.innerHTML = `
            <div class="health-section">
                <div class="health-section-title">Couverture médicale</div>
                <div class="health-items">
                    <div class="health-item ${doctorStatus.class}">
                        <span class="health-item-label">Couverture médicale</span>
                        <div class="health-coverage-bar">
                            <div class="health-coverage-fill ${doctorStatus.fillClass}" style="width: ${this.healthData.coverage.doctor}%"></div>
                        </div>
                        <span class="health-item-value percentage">${this.healthData.coverage.doctor}%</span>
                    </div>
                    <div class="health-item ${hospitalStatus.class}">
                        <span class="health-item-label">Couverture hospitalière</span>
                        <div class="health-coverage-bar">
                            <div class="health-coverage-fill ${hospitalStatus.fillClass}" style="width: ${this.healthData.coverage.hospital}%"></div>
                        </div>
                        <span class="health-item-value percentage">${this.healthData.coverage.hospital}%</span>
                    </div>
                    <div class="health-item ${medicinesStatus.class}">
                        <span class="health-item-label">Accès médicaments</span>
                        <div class="health-coverage-bar">
                            <div class="health-coverage-fill ${medicinesStatus.fillClass}" style="width: ${this.healthData.coverage.medicines}%"></div>
                        </div>
                        <span class="health-item-value percentage">${this.healthData.coverage.medicines}%</span>
                    </div>
                </div>
            </div>

            <div class="health-section">
                <div class="health-section-title">Risques psychologiques</div>
                <div class="health-items">
                    <div class="health-item ${depressionStatus.class}">
                        <span class="health-item-label">Risque de dépression</span>
                        <span class="health-item-value percentage ${depressionStatus.valueClass}">${this.healthData.risks.depression}%</span>
                    </div>
                    <div class="health-item ${suicideStatus.class}">
                        <span class="health-item-label">Risque de suicide</span>
                        <span class="health-item-value percentage ${suicideStatus.valueClass}">${this.healthData.risks.suicide}%</span>
                    </div>
                </div>
            </div>

            <div class="health-section">
                <div class="health-section-title">Nutrition</div>
                <div class="health-items">
                    <div class="health-item">
                        <span class="health-item-label">Personnes affamées</span>
                        <span class="health-item-value number">${this.healthData.nutrition.hungry.percentage}% (${this.healthData.nutrition.hungry.absolute})</span>
                    </div>
                    <div class="health-item">
                        <span class="health-item-label">Personnes nourries</span>
                        <span class="health-item-value number">${this.healthData.nutrition.nourished.percentage}% (${this.healthData.nutrition.nourished.absolute})</span>
                    </div>
                    <div class="health-item">
                        <span class="health-item-label">Alimentation équilibrée</span>
                        <span class="health-item-value number">${this.healthData.nutrition.wellBalanced.percentage}% (${this.healthData.nutrition.wellBalanced.absolute})</span>
                    </div>
                </div>
            </div>

            <div class="health-section">
                <div class="health-section-title">Maladies</div>
                <div class="health-items">
                    <div class="health-item">
                        <span class="health-item-label">Maladies légères</span>
                        <span class="health-item-value percentage">${this.healthData.sickness.light}%</span>
                    </div>
                    <div class="health-item">
                        <span class="health-item-label">Maladies moyennes</span>
                        <span class="health-item-value percentage">${this.healthData.sickness.medium}%</span>
                    </div>
                    <div class="health-item">
                        <span class="health-item-label">Maladies fatales</span>
                        <span class="health-item-value percentage critical">${this.healthData.sickness.fatal}%</span>
                    </div>
                </div>
            </div>

            <div class="health-section">
                <div class="health-section-title">Mortalité</div>
                <div class="health-items">
                    <div class="health-death-rate">
                        <span class="health-death-rate-label">Taux de mortalité global (par an)</span>
                        <span class="health-death-rate-value">${this.healthData.death.rate}%</span>
                    </div>
                    <div class="health-major-disease">
                        <span class="health-major-disease-label">Maladie majeure causant la mort :</span>
                        <span class="health-major-disease-name">${this.healthData.death.majorDisease}</span>
                    </div>
                </div>
            </div>
        `;
    }
}

function initHealthSection() {
    const healthSection = document.getElementById('admin-section-health');
    if (!healthSection) return;

    const presenter = new HealthSectionPresenter();
    
    const observer = new MutationObserver(() => {
        if (healthSection.classList.contains('active')) {
            presenter.init();
            observer.disconnect();
        }
    });

    observer.observe(healthSection, { attributes: true, attributeFilter: ['class'] });

    if (healthSection.classList.contains('active')) {
        presenter.init();
        observer.disconnect();
    }

    registerAppService('healthSectionPresenter', presenter);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHealthSection);
} else {
    initHealthSection();
}

