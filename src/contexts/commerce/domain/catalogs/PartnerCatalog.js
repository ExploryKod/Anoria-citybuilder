/** Default commerce partner seed data. */
const DEPRECATED_ACTIVATION_CONDITION = 'funds_min_3000_deficit';

export function createDefaultPartners() {
  return [
    {
      id: 'deserta',
      name: 'Deserta',
      description: 'Ville désertique spécialisée dans les dattes',
      isActive: false, // Relation commerciale désactivée par défaut
      activationConditions: [
        'population_min_5',
        'unemployment_max_10',
        'windmill_stocks_available',
      ], // Conditions requises pour activer
      imports: [
        {
          productId: 'carrot',
          productName: 'Carotte',
          months: [7, 8, 11],
          maxPerTurn: 8,
          maxOccurrences: 9,
          currentOccurrences: 0,
          currentYearly: 0,
        },
        {
          productId: 'wood',
          productName: 'Bois',
          months: [11],
          maxPerTurn: 5,
          maxOccurrences: 2,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'dattes',
          productName: 'Dattes',
          months: [0, 2],
          maxOccurrences: 2,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'tropicala',
      name: 'Tropicala',
      description: 'Ville tropicale aux ressources exotiques',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'wheat',
          productName: 'Blé',
          months: [3, 4, 9],
          maxPerTurn: 6,
          maxOccurrences: 8,
          currentOccurrences: 0,
          currentYearly: 0,
        },
        {
          productId: 'cabbage',
          productName: 'Chou',
          months: [5, 6, 10],
          maxPerTurn: 4,
          maxOccurrences: 6,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'wood',
          productName: 'Bois tropical',
          months: [1, 2, 8],
          maxOccurrences: 4,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'arctica',
      name: 'Arctica',
      description: 'Ville du nord aux ressources rares',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'carrot',
          productName: 'Carotte',
          months: [1, 2, 6, 10],
          maxPerTurn: 5,
          maxOccurrences: 10,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'wood',
          productName: 'Bois du nord',
          months: [4, 5, 9, 11],
          maxOccurrences: 6,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'montana',
      name: 'Montana',
      description: 'Ville montagnarde spécialisée dans les légumes',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'wood',
          productName: 'Bois',
          months: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 5,
          maxOccurrences: 20,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'cabbage',
          productName: 'Chou',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxOccurrences: 15,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'riviera',
      name: 'Riviera',
      description: 'Ville côtière méditerranéenne',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'wood',
          productName: 'Bois',
          months: [3, 4, 5, 6, 7, 8, 9],
          maxPerTurn: 6,
          maxOccurrences: 18,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'cabbage',
          productName: 'Chou',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxOccurrences: 12,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'oceania',
      name: 'Oceania',
      description: 'Archipel océanique aux ressources variées',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'carrot',
          productName: 'Carotte',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 4,
          maxOccurrences: 24,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'wood',
          productName: 'Bois',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxOccurrences: 20,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'paysana',
      name: 'Paysana',
      description: 'Région agricole très productive',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'carrot',
          productName: 'Carotte',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 8,
          maxOccurrences: 30,
          currentOccurrences: 0,
          currentYearly: 0,
        },
        {
          productId: 'wheat',
          productName: 'Blé',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 10,
          maxOccurrences: 36,
          currentOccurrences: 0,
          currentYearly: 0,
        },
        {
          productId: 'cabbage',
          productName: 'Chou',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 7,
          maxOccurrences: 28,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'wood',
          productName: 'Bois',
          months: [4, 5, 6, 7, 8],
          maxOccurrences: 8,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'savana',
      name: 'Savana',
      description: 'Région de savane aux échanges variés',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'carrot',
          productName: 'Carotte',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 5,
          maxOccurrences: 20,
          currentOccurrences: 0,
          currentYearly: 0,
        },
        {
          productId: 'wood',
          productName: 'Bois',
          months: [2, 3, 4, 5, 6, 7, 8, 9],
          maxPerTurn: 4,
          maxOccurrences: 16,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'wheat',
          productName: 'Blé',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxOccurrences: 25,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
    {
      id: 'foresta',
      name: 'Foresta',
      description: 'Région forestière riche en bois',
      isActive: false,
      activationConditions: [],
      imports: [
        {
          productId: 'wood',
          productName: 'Bois',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxPerTurn: 12,
          maxOccurrences: 40,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
      exports: [
        {
          productId: 'wheat',
          productName: 'Blé',
          months: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
          maxOccurrences: 18,
          currentOccurrences: 0,
          currentYearly: 0,
        },
      ],
    },
  ];
}

/**
 * @param {Array<{ activationConditions?: string[] }>} partners
 * @returns {{ partners: typeof partners, needsSave: boolean }}
 */
export function migrateStoredPartners(partners) {
  let needsSave = false;

  partners.forEach((partner) => {
    if (partner.activationConditions && Array.isArray(partner.activationConditions)) {
      const index = partner.activationConditions.indexOf(DEPRECATED_ACTIVATION_CONDITION);
      if (index !== -1) {
        partner.activationConditions.splice(index, 1);
        needsSave = true;
      }
    }
  });

  return { partners, needsSave };
}
