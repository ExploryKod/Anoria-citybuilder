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

import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';
import { SOCIAL_CATEGORY, OWNER_SKILL, TAX_COLLECTION_SKILLS } from '../../../../shared/population/socialCategoryCatalog.js';
import { getSkillDisplay } from '../../../../shared/population/skillCatalog.js';

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

/**
 * Les dépêches qui marquent un moment de la partie (récit écrit à la main), une par identifiant de jalon : voir AnnounceMilestone.js.
 * Chacune reçoit ce que son texte demande (une somme déjà écrite par la monnaie du jeu, par exemple).
 * @type {Record<string, (params: any) => object>}
 */
const MILESTONE_DRAFTS = {
  // Avant le tour où la ville reçoit son argent de départ : le trésor trouvé en chemin. `amountLabel` : « 500 € ».
  // Elle porte le bouton de la maison du maire : tout commence par elle (voir `requiresPlaced` des autres maisons).
  'starting-fortune': ({ amountLabel }) => {
    const owner = getSkillDisplay(OWNER_SKILL).label.toLowerCase();
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: 'Vous décidez de rester',
      body: `Vous décidez de rester sur ce territoire. Vous dotez le budget de votre ville avec le trésor trouvé en chemin, ${amountLabel}, pour bâtir vos premières maisons. `
        + `Tout commence par la vôtre : cliquez sur la maison ci-dessous, puis placez-la sur la carte. C'est elle qui fait de vous un ${owner} et ouvre la construction de toutes les autres.`,
      teaser: 'Vous avez fait votre choix…',
      reliability: 'trusted',
      revelation: 'free',
      action: { kind: 'buildTool', toolId: 'House-Mayor' },
    };
  },
  // La première maison du maire : son rôle, et ce que ses deux compétences permettent. Les noms viennent des catalogues.
  'mayor-house': () => {
    const house = getBuildingDefinition('House-Mayor').displayName;
    const owner = getSkillDisplay(OWNER_SKILL).label.toLowerCase();
    // The collections the first tier grants: the simple taxes. The companies' tax and the customs come with the house's second tier.
    const collections = Object.keys(SOCIAL_CATEGORY.administrators.tiers[1].skills)
      .filter((skill) => skill !== OWNER_SKILL)
      .map((skill) => getSkillDisplay(skill).label.toLowerCase())
      .join(', ');
    const administrators = SOCIAL_CATEGORY.administrators.tiers[1].maxPopulation;
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: 'La maison du maire est bâtie',
      body: `Les ${house.toLowerCase()} de la ville s'installent (${administrators} au plus). Leur maison leur donne des compétences, d'office : `
        + `${owner} — ils perçoivent les loyers et leur maison est la condition pour bâtir toutes les autres maisons ; `
        + `${collections} — ils perçoivent les impôts des autres maisons.`,
      teaser: 'Les administrateurs prennent leurs quartiers…',
      reliability: 'trusted',
      revelation: 'free',
    };
  },
  // November came and nobody holds the tax collector skill: the citizen tax of the year was not collected. Says who collects it.
  'tax-uncollected': () => {
    const house = getBuildingDefinition('House-Mayor').displayName;
    const collector = getSkillDisplay(TAX_COLLECTION_SKILLS.citizen).label.toLowerCase();
    return {
      sourceId: 'city',
      categoryId: 'announcement',
      title: "L'impôt n'a pas été levé",
      body: `Personne n'a la compétence « ${collector} » : l'impôt citoyen de l'année n'a pas été collecté. Elle revient aux ${house.toLowerCase()}, `
        + 'qui vivent dans la maison du maire : bâtissez-la et logez-y du monde, et l\'impôt sera levé dès ce mois.',
      teaser: 'Les caisses restent vides…',
      reliability: 'trusted',
      revelation: 'free',
    };
  },
};

/**
 * @param {string} milestoneId
 * @param {object} [params]
 */
export function milestoneDraft(milestoneId, params = {}) {
  const draft = MILESTONE_DRAFTS[milestoneId];
  if (!draft) throw new Error(`[news] "${milestoneId}" is not a milestone of NewsDraftCatalog.js: it has no dépêche to announce`);
  return draft(params);
}

/** Catalogue actif — vide jusqu’au prochain design gameplay. */
export const CITY_NEWS_ENTRIES = [];

/** Catalogue actif — vide jusqu’au prochain design gameplay. */
export const CARAVAN_NEWS_ENTRIES = [];
