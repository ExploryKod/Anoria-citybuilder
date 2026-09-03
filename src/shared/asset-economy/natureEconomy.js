/**
 * Economy facts (price, category, displayName) for the nature/decoration/
 * tombs theme. See buildingCatalog.js for the merged, compat-shaped export
 * every bounded context still reads.
 *
 * Same hard rules as buildingCatalog.js: data only, no behavior, no
 * `src/contexts/**` imports.
 */
export const NATURE_ECONOMY = {
  // Tombs / cemetery
  'Tombstone-1': { displayName: 'Pierre tombale', construction: { price: 2, category: 'tombs' } },
  'Tombstone-2': { displayName: 'Pierre tombale', construction: { price: 4, category: 'tombs' } },
  'Tombstone-3': { displayName: 'Pierre tombale', construction: { price: 8, category: 'tombs' } },
  'Grave-1': { displayName: 'Tombe', construction: { price: 3, category: 'tombs' } },
  'Grave-2': { displayName: 'Tombe', construction: { price: 3, category: 'tombs' } },
  Tomb: { displayName: 'Tombeau', construction: { price: 5, category: 'tombs' } },
  Coffin: { displayName: 'Cercueil', construction: { price: 4, category: 'tombs' } },

  // Infrastructure props (decorative, not roads/connectivity)
  'Well-001': { displayName: 'Puits', construction: { price: 15, category: 'infrastructure' } },
  'Fountain-001': { displayName: 'Fontaine', construction: { price: 25, category: 'infrastructure' } },
  'Streetlight-001': { displayName: 'Réverbère', construction: { price: 5, category: 'infrastructure' } },
  'Fence-001': { displayName: 'Clôture', construction: { price: 3, category: 'infrastructure' } },
  'Pond-001': { displayName: 'Étang', construction: { price: 20, category: 'infrastructure' } },
  'Plane-001': { displayName: 'Dalle petite', construction: { price: 8, category: 'infrastructure' } },
  'Plane-004': { displayName: 'Dalle moyenne', construction: { price: 12, category: 'infrastructure' } },
  'Plane-007': { displayName: 'Dalle grande', construction: { price: 16, category: 'infrastructure' } },
  Cube: { displayName: 'Bloc', construction: { price: 5, category: 'infrastructure' } },
  'Sphere-001': { displayName: 'Sphère', construction: { price: 5, category: 'infrastructure' } },
  'Sphere-002': { displayName: 'Sphère sombre', construction: { price: 5, category: 'infrastructure' } },

  // Nature
  'Tree-Pine-001': { displayName: 'Sapin', construction: { price: 3, category: 'nature' } },
  'Tree-Square-001': { displayName: 'Arbuste', construction: { price: 3, category: 'nature' } },
  'Tree-Tall-001': { displayName: 'Chêne', construction: { price: 3, category: 'nature' } },
  'Tree-Sapin': { displayName: 'Sapin', construction: { price: 3, category: 'nature' } },
  'Tree-Arbuste': { displayName: 'Arbuste', construction: { price: 3, category: 'nature' } },
  'Tree-Chene': { displayName: 'Chêne', construction: { price: 3, category: 'nature' } },
  'Boulder-001': { displayName: 'Rocher', construction: { price: 2, category: 'nature' } },

  // Decoration
  Bench: { displayName: 'Banc', construction: { price: 2, category: 'decoration' } },
  'Picnic-Table': { displayName: 'Table de pique-nique', construction: { price: 4, category: 'decoration' } },
  'Potted-Bush': { displayName: 'Buisson en pot', construction: { price: 2, category: 'decoration' } },
  Daisy: { displayName: 'Marguerite', construction: { price: 1, category: 'decoration' } },
  Shroom: { displayName: 'Champignon', construction: { price: 1, category: 'decoration' } },
  Arch: { displayName: 'Arche', construction: { price: 10, category: 'decoration' } },
  Obelisk: { displayName: 'Obélisque', construction: { price: 12, category: 'decoration' } },
  Pillar: { displayName: 'Pilier', construction: { price: 5, category: 'decoration' } },
  Garland: { displayName: 'Guirlande', construction: { price: 2, category: 'decoration' } },
  Barrell: { displayName: 'Tonneau', construction: { price: 2, category: 'decoration' } },
};
