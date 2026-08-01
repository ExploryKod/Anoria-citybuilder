/** Default commerce product configuration seed data. */
export function createDefaultProductConfig() {
  return [
            {
                id: 'wheat',
                name: 'Blé',
                sellingPrice: 15,
                buyingPrice: 5,  // Prix par défaut : 5€
                marketPrice: 14,
                marketShare: 45,
                marketPosition: 'normal',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel (8 paniers)
                // sellingMin supprimé
                buyingMax: 8,  // Seuil maximum d'achat annuel (8 paniers)
                // buyingMin supprimé
                tax: 10,
                consumptionShare: 60,
                consumptionStatus: 'able',
                yearlyImports: 0,  // Stats dynamiques
                yearlyExports: 0
            },
            {
                id: 'carrot',
                name: 'Carotte',
                sellingPrice: 18,
                buyingPrice: 15,
                marketPrice: 16,
                marketShare: 25,
                marketPosition: 'few',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel
                // sellingMin supprimé
                buyingMax: 400,
                // buyingMin supprimé
                tax: 15,
                consumptionShare: 40,
                consumptionStatus: 'able',
                yearlyImports: 0,
                yearlyExports: 0
            },
            {
                id: 'cabbage',
                name: 'Chou',
                sellingPrice: 20,
                buyingPrice: 17,
                marketPrice: 18,
                marketShare: 15,
                marketPosition: 'inferior',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel
                // sellingMin supprimé
                buyingMax: 300,
                // buyingMin supprimé
                tax: 20,
                consumptionShare: 30,
                consumptionStatus: 'unable',
                yearlyImports: 0,
                yearlyExports: 0
            },
            {
                id: 'wood',
                name: 'Bois',
                sellingPrice: 25,
                buyingPrice: 20,
                marketPrice: 22,
                marketShare: 70,
                marketPosition: 'dominant',
                stockpiling: false,
                sellingMax: 8,  // Seuil maximum d'export annuel
                // sellingMin supprimé
                buyingMax: 1000,
                // buyingMin supprimé
                tax: 5,
                consumptionShare: 80,
                consumptionStatus: 'exceeding',
                yearlyImports: 0,
                yearlyExports: 0
            },
            {
                id: 'dattes',
                name: 'Dattes',
                sellingPrice: 22,
                buyingPrice: 12,
                marketPrice: 16,
                marketShare: 5,
                marketPosition: 'inferior',
                stockpiling: false,
                sellingMax: 0,  // On n'exporte pas de dattes (produit exotique importé)
                buyingMax: 200,
                tax: 8,
                consumptionShare: 15,
                consumptionStatus: 'unable',
                yearlyImports: 0,
                yearlyExports: 0
            }
  ];
}
