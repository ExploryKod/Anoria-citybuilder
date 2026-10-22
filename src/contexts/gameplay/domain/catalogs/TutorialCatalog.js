/**
 * The tutorial's script: the first steps of a solid economy, one instruction at a time, in the order a player should do them. Declarative: a step is
 * data, so the script changes with the game by editing this list, never the code that runs it (see TutorialProgressPolicy.js, AdvanceTutorial.js).
 *
 * A step is `{ id, done, news }`:
 * - `done`: the conditions that, all together, say the player has done what the step asks (the kinds are in TutorialProgressPolicy.js). The step
 *   the player is on is the first one not done; once the last is done, the tutorial is over.
 * - `news`: the dépêche that gives the instruction, or `null` for a step that only waits because the game already guides that moment (the opening's
 *   dépêches lead to the mayor's house). Its `action` is a button on the dépêche that puts a building in hand.
 *
 * Words the catalogs decide are tokens, never typed: `{building:<id>}` (a building's name), `{skill:<id>}` (a skill's label). The sentences are
 * narrative and carry no figure (costs, ranges and durations move with the balance).
 *
 * @type {ReadonlyArray<import('../policies/TutorialProgressPolicy.js').TutorialStep>}
 */
export const TUTORIAL_STEPS = Object.freeze([
  {
    id: 'mayor-house',
    done: [{ built: 'House-Mayor' }],
    news: null,
  },
  {
    id: 'road',
    done: [{ roadBuilt: true }],
    news: {
      title: 'Tracez une route',
      body: `Un bâtiment doit être relié à une route pour servir à quelque chose : ce sont les routes qui portent les marchandises et les services. `
        + `Posez « {building:StonePath-001} » près de votre première maison : vos prochains bâtiments s'y raccorderont.`,
      teaser: 'Un messager vous parle de chemins…',
      action: { kind: 'buildTool', toolId: 'StonePath-001' },
    },
  },
  {
    id: 'artisans-house',
    done: [{ built: 'House-Red' }],
    news: {
      title: 'Les bras de la terre',
      body: `Les {building:House-Red} savent travailler la terre : leur compétence « {skill:fermier} » fera tourner vos champs. `
        + `Bâtissez leur première maison.`,
      teaser: 'Des exilés cherchent un toit…',
      action: { kind: 'buildTool', toolId: 'House-Red' },
    },
  },
  {
    id: 'merchants-house',
    done: [{ built: 'House-Blue' }],
    news: {
      title: 'Ceux qui font circuler les biens',
      body: `Les {building:House-Blue} ont les compétences « {skill:vente-alimentaire} » et « {skill:stockage-alimentaire} » : `
        + `ils tiendront votre marché et votre grenier. Bâtissez leur première maison.`,
      teaser: 'Des négociants proposent leurs services…',
      action: { kind: 'buildTool', toolId: 'House-Blue' },
    },
  },
  {
    id: 'settle',
    done: [{ housed: 'House-Red' }, { housed: 'House-Blue' }],
    news: {
      title: 'Laissez-les s’installer',
      body: `Une maison vide ne produit rien. Un peu de patience : les habitants s'y installent, et ce sont eux, avec leurs compétences, `
        + `qui feront fonctionner vos bâtiments.`,
      teaser: 'Les premiers habitants arrivent…',
    },
  },
  {
    id: 'farm',
    done: [{ built: 'Farm-Wheat' }],
    news: {
      title: 'Nourrir vos habitants',
      body: `Il faut que vos habitants mangent. Posez « {building:Farm-Wheat} » : il n'a pas besoin de route, mais il lui faut des travailleurs `
        + `ayant la compétence « {skill:fermier} ». Un champ ne donne sa récolte qu'une fois l'an, à la saison de la moisson.`,
      teaser: 'Les habitants ont faim…',
      action: { kind: 'buildTool', toolId: 'Farm-Wheat' },
    },
  },
  {
    id: 'granary',
    done: [{ built: 'Windmill-001' }],
    news: {
      title: 'Garder la récolte',
      body: `La récolte doit être stockée avant d'être vendue. Posez « {building:Windmill-001} » : il la collecte, la garde et approvisionne ensuite le marché ; `
        + `ses travailleurs ont la compétence « {skill:stockage-alimentaire} ».`,
      teaser: 'Les premières moissons se préparent…',
      action: { kind: 'buildTool', toolId: 'Windmill-001' },
    },
  },
  {
    id: 'market',
    done: [{ built: 'Market-Stall-Red' }],
    news: {
      title: 'Ouvrir le marché',
      body: `Posez « {building:Market-Stall-Red} » : il vend la nourriture aux maisons. Il doit se trouver près d'un grenier, et ses vendeurs ont la compétence `
        + `« {skill:vente-alimentaire} ».`,
      teaser: 'Les habitants réclament un marché…',
      action: { kind: 'buildTool', toolId: 'Market-Stall-Red' },
    },
  },
  {
    id: 'staff-the-chain',
    done: [{ staffed: 'Farm-Wheat' }, { staffed: 'Windmill-001' }, { staffed: 'Market-Stall-Red' }],
    news: {
      title: 'La chaîne est posée',
      body: `Le champ produit, le grenier garde, le marché vend, les maisons mangent : c'est la boucle de base de tout hameau. `
        + `Mais un bâtiment sans ses travailleurs reste muet : veillez à ce que chacun ait ses employés, puis laissez venir la moisson.`,
      teaser: 'Votre économie prend forme…',
    },
  },
]);
