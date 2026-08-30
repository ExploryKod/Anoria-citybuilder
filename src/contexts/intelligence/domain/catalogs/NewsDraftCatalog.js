/**
 * Catalogue des dépêches jouables (données gameplay).
 *
 * Le pipeline intelligence (génération, modal, archives) reste branché ;
 * seules ces listes déterminent ce qui est produit en jeu.
 *
 * Réactiver les brouillons MVP :
 *   export const CITY_NEWS_ENTRIES = CITY_NEWS_ENTRIES_MVP;
 *   export const CARAVAN_NEWS_ENTRIES = CARAVAN_NEWS_ENTRIES_MVP;
 */

/**
 * @typedef {object} CityNewsSignals
 * @property {number} [famishedPopulation]
 * @property {number} [totalPopulation]
 * @property {number} [unemploymentPercentage]
 * @property {number} [lack]
 */

/**
 * @typedef {object} CityNewsEntry
 * @property {string} [id]
 * @property {(signals: CityNewsSignals, rng: () => number) => boolean} when
 * @property {(signals: CityNewsSignals) => object} draft
 * @property {number} [sortScore]
 */

/**
 * @typedef {object} CaravanNewsEntry
 * @property {string} categoryId
 * @property {string} title
 * @property {string} body
 * @property {string} teaser
 * @property {number} weight
 */

/** Brouillons ville MVP (référence — non actifs en jeu). */
export const CITY_NEWS_ENTRIES_MVP = [
  {
    id: 'famine_revelation',
    sortScore: 0,
    when: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      const pop = Math.max(0, Number(signals.totalPopulation) || 0);
      if (famished <= 0) return false;
      const ratio = pop > 0 ? famished / pop : 1;
      return ratio >= 0.15 || famished >= 20;
    },
    draft: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      return {
        sourceId: 'city',
        categoryId: 'revelation',
        title: 'Les greniers se vident',
        body: `Des familles affamées sont signalées en ville (${famished} personnes). Vérifiez la distribution alimentaire et les stocks des maisons.`,
        teaser: 'Des rumeurs de famine circulent…',
        reliability: 'trusted',
        revelation: 'free',
      };
    },
  },
  {
    id: 'famine_complaint',
    sortScore: 1,
    when: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      const pop = Math.max(0, Number(signals.totalPopulation) || 0);
      if (famished <= 0) return false;
      const ratio = pop > 0 ? famished / pop : 1;
      return ratio < 0.15 && famished < 20;
    },
    draft: (signals) => {
      const famished = Math.max(0, Number(signals.famishedPopulation) || 0);
      return {
        sourceId: 'city',
        categoryId: 'complaint',
        title: 'Plainte : « On a faim ! »',
        body: `Des citoyens se plaignent du manque de nourriture. Environ ${famished} personnes n'auraient pas mangé correctement ce mois-ci.`,
        teaser: 'Des habitants grognent près du forum…',
        reliability: famished > 0 ? 'trusted' : 'uncertain',
        revelation: 'free',
      };
    },
  },
  {
    id: 'employment_complaint',
    sortScore: 1,
    when: (signals) => {
      const unemployment = Math.max(0, Number(signals.unemploymentPercentage) || 0);
      const lack = Math.max(0, Number(signals.lack) || 0);
      return unemployment >= 25 || lack >= 10;
    },
    draft: (signals) => {
      const unemployment = Math.max(0, Number(signals.unemploymentPercentage) || 0);
      const lack = Math.max(0, Number(signals.lack) || 0);
      return {
        sourceId: 'city',
        categoryId: 'complaint',
        title: 'Plainte : chômage et bras inutiles',
        body:
          unemployment >= 25
            ? `Le chômage atteint environ ${Math.round(unemployment)} %. Des oisifs s'agglutinent aux carrefours.`
            : `Des postes restent vacants (manque estimé : ${lack}). Les ateliers peinent à recruter.`,
        teaser: 'Remue-ménage sur la place du travail…',
        reliability: 'uncertain',
        revelation: 'free',
      };
    },
  },
  {
    id: 'flavour',
    sortScore: 0,
    when: (_signals, rng) => rng() < 0.35,
    draft: () => ({
      sourceId: 'city',
      categoryId: 'revelation',
      title: 'Nouvelle du quartier',
      body: 'Les rues sont calmes ce mois-ci. Les citoyens vaquent à leurs occupations sans incident notable.',
      teaser: 'Un messager apporte une dépêche…',
      reliability: 'trusted',
      revelation: 'free',
    }),
  },
];

/** Brouillons caravane MVP (référence — non actifs en jeu). */
export const CARAVAN_NEWS_ENTRIES_MVP = [
  {
    categoryId: 'trade_rumor',
    title: 'Rumeur sur les marchés étrangers',
    body: 'Un commerçant de passage affirme que le blé se vend cher chez un partenaire voisin. Vérifiez vos stocks avant d’ouvrir de nouveaux échanges.',
    teaser: 'Un caravanier murmure des nouvelles des routes…',
    weight: 0.34,
  },
  {
    categoryId: 'partner_news',
    title: 'Tension chez un partenaire',
    body: 'Des voyageurs rapportent des troubles politiques chez l’un de vos partenaires commerciaux. Les prochaines caravanes pourraient être moins régulières.',
    teaser: 'Des nouvelles inquiétantes arrivent avec les mulets…',
    weight: 0.33,
  },
  {
    categoryId: 'foreign_market',
    title: 'Opportunité sur un marché extérieur',
    body: 'Un négociant propose une piste d’export rentable pour le bois, si vos granges et quotas le permettent. L’information seule ne crée pas le contrat.',
    teaser: 'Un négociant veut vendre une information…',
    weight: 0.33,
  },
];

/** Catalogue actif — vide jusqu’au prochain design gameplay. */
export const CITY_NEWS_ENTRIES = [];

/** Catalogue actif — vide jusqu’au prochain design gameplay. */
export const CARAVAN_NEWS_ENTRIES = [];
