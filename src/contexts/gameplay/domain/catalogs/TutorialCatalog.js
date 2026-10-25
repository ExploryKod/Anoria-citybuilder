import { primaryRoadType } from '../../../../shared/building-catalog/roadQueries.js';
import { TOAST_PRIORITIES } from '../policies/TutorialProgressPolicy.js';

/** How long a reminder toast stays on screen, in milliseconds. */
const REMINDER_MS = 8000;

/**
 * The construction buttons that work at the very start of the game: the mayor's house, as in any new game. Every other building waits for a dépêche of the
 * tutorial to unlock it (`unlocks` of a step's or a dispatch's dépêche): until then its button is greyed out.
 */
export const TUTORIAL_START_TOOLS = Object.freeze(['House-Mayor']);

/**
 * The tutorial's script: the first steps of a solid economy, in the order a player should do them. Declarative: everything here is data, so the script
 * changes with the game by editing this file, never the code that runs it (see TutorialProgressPolicy.js, AdvanceTutorial.js).
 *
 * Three lists, three ways to speak to the player:
 * - TUTORIAL_STEPS: the sequence. The step the player is on is the first one not done; it gives one dépêche.
 * - TUTORIAL_DISPATCHES: dépêches triggered like toasts, outside the sequence (when a step is reached, a building stands, a delay has passed).
 * - TUTORIAL_TOASTS: short, non-blocking messages that underline a moment.
 *
 * A step is `{ id, done, news, delay }`:
 * - `done`: the conditions that, all together, say the player has done what the step asks (the kinds are in TutorialProgressPolicy.js).
 * - `news`: the dépêche that gives the instruction, or `null` for a step that only waits because the game already guides that moment (the opening's
 *   dépêches lead to the mayor's house). Its `action` is a button on the dépêche that puts a building in hand; its `illustrations` are building ids
 *   shown as pictures under the text; its `image` is a file of public/. A dépêche is read a page at a time: `choices: [{ label, page }]` are buttons
 *   with their own sentence that open a page, and `next` is the page "Lire la suite" opens; a page is `{ body, action?, illustrations?, image?, choices?, next? }`.
 * - `counter` (optional): `{ label, after, items: [{ type, atLeast }] }` (`after`, always said: `null` to show the counter at once, or what must have
 *   happened before it shows, exactly one of `{ news: <dépêche id> }` closed, `{ toast: <toast id> }` shown, `{ event: [conditions] }` holding, read like a toast's `when`; a step's own dépêche always comes first), the progress shown on screen under the season ("Maisons « Artisans » construites 2/3"),
 *   pulsing; each item counts the buildings of its type up to `atLeast` (a number, or a token text such as `{farms:…}`). When the step is done the counter
 *   stays on screen full, marked done, for a moment (the congratulation toast comes with it).
 * - `unlocks` (optional, on a step that has a dépêche, and on a dispatch): the construction buttons (building ids) that work from the moment that dépêche has
 *   been written. Before, they are greyed out: only TUTORIAL_START_TOOLS work at the start. Once the script is over, nothing is greyed out.
 * - `delay`: turns (days) to wait after the player reaches the step before its dépêche arrives; always said, 0 = at once (the same on dispatches and toasts).
 * - `reminder` (optional): `{ after, every?, duration, text }`, a warning toast that reminds the player what the step asks when they have not done it:
 *   after `after` turns on the step, then every `every` turns (once without `every`); it goes away when the step is done.
 * Every `news` says `blocking`: `true` and the dépêche cannot be closed (its `action` button is the only way out, and it comes back until it is done), `false` otherwise.
 *
 * Words the catalogs decide are tokens, never typed: `{building:<id>}` (a building's name), `{skill:<id>}` (a skill's label), `{skillicon:<id>}` (its
 * emoji), `{harvest:when}` (the season of the harvest), `{farms:3*House-Red/Farm-Wheat}` (the fields it takes to feed 3 such houses). A token never
 * takes an article before it (the catalog's name has a gender and an elision this file cannot know): the names are quoted with « ». The sentences
 * are narrative and carry no figure (costs, ranges and durations move with the balance); the counts of houses are the only numbers, in the data.
 *
 * @type {ReadonlyArray<import('../policies/TutorialProgressPolicy.js').TutorialStep>}
 */
export const TUTORIAL_STEPS = Object.freeze([
  {
    id: 'mayor-house',
    delay: 0,
    done: [{ built: 'House-Mayor' }],
    news: null,
  },
  {
    // The road is unlocked by its dépêche, which also teaches the shape key. The toast that points at the road button comes after it (see 'road-button').
    // The five pictures are the shapes the S key cycles through for a single tile (the `selectableMeshes` of the road): drawn from above, in public/tuto/roads/.
    id: 'road',
    delay: 0,
    unlocks: [primaryRoadType()],
    counter: { after: null, label: 'Routes tracées', items: [{ roads: true, atLeast: 4 }] },
    done: [{ roadBuilt: 4 }],
    reminder: { after: 15, every: 20, duration: REMINDER_MS, text: `Il faut tracer quatre routes : cliquez sur le bouton de route, à côté du bouton en forme de maison, puis faites glisser la souris.` },
    news: {
      title: 'Des routes pour la cité',
      body: `Vos bâtiments communiquent par les **routes** : **tracez-en quatre**. Cliquez sur le bouton de route, à côté du bouton en forme de maison, `
        + `puis faites glisser la souris : la forme de chaque case se choisit toute seule.\n\n`
        + `Pour poser **une seule case**, la touche **S** change sa forme, et la touche **R** la tourne. Voici les formes possibles :`,
      teaser: 'Les bâtisseurs réclament des chemins…',
      blocking: false,
      action: { kind: 'buildTool', toolId: primaryRoadType() },
      illustrations: [
        { src: '/tuto/roads/straight.svg', label: 'Droite' },
        { src: '/tuto/roads/bend.svg', label: 'Virage' },
        { src: '/tuto/roads/tee.svg', label: 'Intersection' },
        { src: '/tuto/roads/cross.svg', label: 'Croisement' },
        { src: '/tuto/roads/end.svg', label: 'Bout' },
      ],
    },
  },
  {
    id: 'artisans',
    delay: 0,
    unlocks: ['House-Red'],
    counter: { after: null, label: 'Maisons « {building:House-Red} » construites', items: [{ type: 'House-Red', atLeast: 3 }] },
    done: [{ built: { type: 'House-Red', atLeast: 3 } }],
    reminder: { after: 20, every: 30, duration: REMINDER_MS, text: `Il vous reste à bâtir des maisons « {building:House-Red} » : trois en tout.` },
    news: {
      title: 'Les bras de la terre',
      body: `La maison « {building:House-Red} » abrite ceux qui savent travailler la terre : leur compétence « {skill:fermier} » fera tourner vos champs. `
        + `Une seule maison ne donne pas assez de bras : bâtissez-en trois.`,
      teaser: 'Des exilés cherchent un toit…',
      blocking: false,
      action: { kind: 'buildTool', toolId: 'House-Red' },
    },
  },
  {
    // Its own step, not a page of the houses' dépêche: clicking the button of a building closes the modal, so what comes after must be a dépêche of its own.
    // Direct: the text, and the button that puts the field in hand. The screenshot of the build bar (public/tuto/artisans-farms.png) is not shown for now.
    id: 'farms',
    delay: 0,
    unlocks: ['Farm-Wheat'],
    counter: { after: null, label: 'Champs « {building:Farm-Wheat} » construits', items: [{ type: 'Farm-Wheat', atLeast: '{farms:3*House-Red/Farm-Wheat}' }] },
    done: [{ built: 'Farm-Wheat' }, { foodCovered: 'built' }],
    reminder: { after: 20, every: 30, duration: REMINDER_MS, text: `Vos habitants ont besoin de champs : posez des « {building:Farm-Wheat} ».` },
    news: {
      title: 'De quoi les nourrir',
      body: `Vos habitants doivent manger : posez {farms:3*House-Red/Farm-Wheat} « {building:Farm-Wheat} » pour les nourrir. Un champ n'a pas besoin de `
        + `route, mais il lui faut des travailleurs ayant la compétence « {skill:fermier} » : les habitants de vos maisons « {building:House-Red} » `
        + `les fourniront. Il ne donne sa récolte qu'une fois l'an.`,
      teaser: 'Les habitants ont faim…',
      blocking: false,
      action: { kind: 'buildTool', toolId: 'Farm-Wheat' },
    },
  },
  {
    // The wait for the harvest: the market and the granary, recommended by a dispatch below and chosen from the build menu.
    // No house is asked for: the merchants' one is what they need, and the player finds out when the market and the granary lack workers ('merchants-needed').
    id: 'trade',
    delay: 0,
    counter: {
      after: { news: 'trade-chain' },
      label: '{building:Market-Stall-Red} et {building:Windmill-001}',
      items: [{ type: 'Market-Stall-Red', atLeast: 1 }, { type: 'Windmill-001', atLeast: 1 }],
    },
    done: [{ built: 'Market-Stall-Red' }, { built: 'Windmill-001' }],
    reminder: {
      after: 60,
      every: 40,
      duration: REMINDER_MS,
      text: `Avant la vente, il vous reste à poser « {building:Market-Stall-Red} » et « {building:Windmill-001} ».`,
    },
    news: null,
  },
  {
    // Nothing to say: the dépêche comes from the shortage itself ('workers-needed', or 'merchants-needed' for the market and the granary), the toasts tell when each building has its workers.
    id: 'staff-the-chain',
    delay: 0,
    reminder: { after: 40, every: 60, duration: REMINDER_MS, text: `Un bâtiment sans ses travailleurs reste muet : vérifiez que chacun est pourvu, sinon il manque des maisons.` },
    done: [{ foodCovered: 'staffed' }, { staffed: 'Windmill-001' }, { staffed: 'Market-Stall-Red' }],
    news: null,
  },
]);

/**
 * The sale's chain lacks hands: the market AND the granary stand, and one of them shows the no-work sprite. 'merchants-needed' says it, and
 * 'workers-needed' leaves that case to it (a lone granary without workers is still the general case of 'workers-needed').
 */
const SALE_CHAIN_LACKS_HANDS = Object.freeze([
  { built: 'Market-Stall-Red' },
  { built: 'Windmill-001' },
  { noWork: ['Market-Stall-Red', 'Windmill-001'] },
]);

/**
 * The dispatches of the tutorial: dépêches that come when their moment comes, whichever step the player is on. A dispatch is
 * `{ id, news, when?, unless?, step?, delay? }`, its trigger read exactly like a toast's (see TUTORIAL_TOASTS), and it is written once.
 *
 * @type {ReadonlyArray<import('../policies/TutorialProgressPolicy.js').TutorialDispatch>}
 */
export const TUTORIAL_DISPATCHES = Object.freeze([
  {
    // The farms are still missing as the harvest comes close: a dépêche that cannot be closed (`blocking`), whose button is the only way out; it comes back
    // until a field stands. Without enough fields the harvest is missed, and the houses go hungry.
    id: 'famine-warning',
    step: 'farms',
    delay: 0,
    when: [{ harvestWithin: 3 }],
    unless: [{ foodCovered: 'built' }],
    news: {
      title: 'La famine menace',
      body: `La moisson approche et vos habitants n'ont pas de quoi manger : les champs ne seront pas prêts à temps, la récolte sera manquée et la `
        + `famine guettera vos maisons. Posez sans attendre des « {building:Farm-Wheat} » : il en faut {farms:3*House-Red/Farm-Wheat} pour nourrir tout le monde.`,
      teaser: 'Un messager accourt, inquiet…',
      action: { kind: 'buildTool', toolId: 'Farm-Wheat' },
      blocking: true,
    },
  },
  {
    // Right after the first field: while it grows, the menu on the left of the screen. The legend copies the icons of its tabs (NEWS_LEGEND_ICONS in
    // NewsEventModal.js), each with a word.
    id: 'explore-menu',
    when: [{ built: 'Farm-Wheat' }],
    delay: 2,
    news: {
      title: 'Le menu de gauche',
      body: `Votre premier champ est posé. Profitez de l'attente de la récolte pour explorer le menu à gauche de l'écran : ses onglets vous renseignent `
        + `sur votre hameau, à tout moment. Passez la souris sur les icônes pour avoir une explication.`,
      teaser: 'Un messager vous montre un tableau…',
      blocking: false,
      legend: [
        { icon: 'rail-population', word: 'Population' },
        { icon: 'rail-employment', word: 'Emploi' },
        { icon: 'rail-city-stocks', word: 'Stocks' },
        { icon: 'rail-nature', word: 'Nature' },
      ],
    },
  },
  {
    // Well before the harvest: what to place to sell it. No button: the player picks them in the build menu.
    id: 'trade-chain',
    step: 'trade',
    delay: 30,
    unlocks: ['Market-Stall-Red', 'Windmill-001'],
    news: {
      title: 'Préparer la vente',
      body: `La récolte doit être stockée puis vendue. Choisissez dans la barre de construction : « {building:Market-Stall-Red} » pour vendre `
        + `et « {building:Windmill-001} » pour garder la récolte.\n\n`
        + `**Les fermiers vous ont peut-être déjà alerté** des risques : restez attentif. Faites un clic droit sur un « {building:Farm-Wheat} », `
        + `puis ouvrez l'onglet **« Messages »**.`,
      teaser: 'Les négociants se préparent à la moisson…',
      blocking: false,
      illustrations: ['Market-Stall-Red', 'Windmill-001'],
      image: {
        src: '/tuto/messages.png',
        alt: 'L’onglet « Messages » d’un champ de blé : trop de champs, conservation insuffisante faute de grenier, impayés',
        caption: `L'onglet « Messages » d'un « {building:Farm-Wheat} » (clic droit sur le champ) : ici, trop de champs, aucun grenier en état de marche, et des impayés. Cliquez sur l'image pour l'agrandir.`,
      },
    },
  },
  {
    // Once any building has shown the no-work sprite for a whole turn, whatever step the player is on: the rule of the groups of inhabitants. The tutorial
    // looks at the city once employment has hired and the sprites are drawn (after a placement, at the end of a turn), so it sees what the player sees; the
    // icon goes as soon as inhabitants arrive, so a lack that lasts a turn is a real one.
    // Not when the sale's chain is the one lacking hands: 'merchants-needed' says it, with the merchants' house.
    id: 'workers-needed',
    when: [{ noWork: 'any' }],
    unless: [{ all: SALE_CHAIN_LACKS_HANDS }],
    delay: 1,
    news: {
      title: 'Il manque des bras',
      // A blank line starts a paragraph, `**…**` is bold.
      body: `Un bâtiment qui affiche l'icône **« sans travailleurs »** n'a personne pour y travailler : il reste **à l'arrêt**.\n\n`
        + `Chaque bâtiment est relié à l'un des trois groupes d'habitants — « {building:House-Red} », « {building:House-Blue} » ou `
        + `« {building:House-Purple} » — et n'embauche que dans son groupe, selon leurs compétences.\n\n`
        + `Par exemple, « {building:Farm-Wheat} » demande des « {skill:fermier} », que seuls les « {building:House-Red} » ont.\n\n`
        + `**Quand un bâtiment attend ses travailleurs, bâtissez plus de maisons du groupe qui a les compétences voulues, ou attendez que plus d'habitants `
        + `n'arrivent dans une de ces maisons.**`,
      teaser: 'Des bâtiments restent sans bras…',
      blocking: false,
      // The two small pictures, then the example in the game itself (a screenshot, public/tuto/no-work-farms.png). The sprite is the one the game draws above
      // a building (public/tuto/no-work-sprite.svg).
      illustrations: [{ src: '/tuto/no-work-sprite.svg', label: 'Sans travailleurs' }, 'Farm-Wheat'],
      image: { src: '/tuto/no-work-farms.png', alt: 'Des champs de blé, chacun avec l’icône « sans travailleurs » au-dessus' },
    },
  },
  {
    // Once the market and the granary both stand and one of them has shown the no-work sprite for a whole turn (see 'workers-needed'): who is missing, and
    // the button that puts the merchants' house in hand. Tied to the 'trade' step: it is said once that step is reached. It unlocks the merchants' house, greyed out until now.
    id: 'merchants-needed',
    step: 'trade',
    when: SALE_CHAIN_LACKS_HANDS,
    delay: 1,
    unlocks: ['House-Blue'],
    news: {
      title: 'Il manque des commerçants',
      // Either building can be the one lacking hands (the player may have placed only one): the text says what each asks, never that both wait.
      body: `Un bâtiment du commerce attend ses travailleurs. « {building:Market-Stall-Red} » demande des habitants ayant la compétence `
        + `{skillicon:vente-alimentaire} « {skill:vente-alimentaire} », « {building:Windmill-001} » la compétence {skillicon:stockage-alimentaire} `
        + `« {skill:stockage-alimentaire} » : seuls les « {building:House-Blue} » les ont.\n\n`
        + `**Il vous faut plus de commerçants.**`,
      teaser: 'Les étals restent vides…',
      blocking: false,
      action: { kind: 'buildTool', toolId: 'House-Blue' },
    },
  },
  {
    // Still waiting for the harvest, after the sale's buildings have been proposed: something useful to do meanwhile. The button puts the house in hand.
    id: 'scholars-house',
    step: 'trade',
    delay: 15,
    unless: [{ built: 'House-Purple' }],
    unlocks: ['House-Purple'],
    news: {
      title: 'Des savants pour la cité',
      body: `En attendant la moisson, appelez de nouveaux habitants : la maison « {building:House-Purple} » abrite les savants, qui font tourner les `
        + `services publics. Bâtissez-en une.`,
      teaser: 'Des lettrés cherchent une cité où s’établir…',
      blocking: false,
      action: { kind: 'buildTool', toolId: 'House-Purple' },
    },
  },
  {
    // The moment the scholars' house stands: what their skill is for, and the building it runs. The picture is a screenshot of the build bar
    // (public/tuto/construction-citerne.png): the scholars' pill selected, the water tank first under it.
    id: 'scholars-water',
    when: [{ built: 'House-Purple' }],
    delay: 0,
    unlocks: ['WaterTank'],
    news: {
      title: 'L’eau de la cité',
      body: `Les habitants de la maison « {building:House-Purple} » ont la compétence {skillicon:hydraulique} « {skill:hydraulique} » : ce sont eux qui feront `
        + `tourner la « {building:WaterTank} », qui puise l'eau du sol et la distribue aux maisons. Sans eau, une maison ne peut pas évoluer. `
        + `Cliquez sur la pastille « {building:House-Purple} » de la barre de construction (en orange ci-dessous), puis sur la « {building:WaterTank} ».`,
      teaser: 'Les savants parlent d’eau…',
      blocking: false,
      image: { src: '/tuto/construction-citerne.png', alt: 'La barre de construction : la pastille des savants sélectionnée, et sous elle la citerne en premier' },
      action: { kind: 'buildTool', toolId: 'WaterTank' },
    },
  },
  {
    // The moment the water tank reaches both the scholars' and the artisans' houses: how a house evolves, taking the scholars' step from level 1 to 2 as
    // the example. The two pictures above the screenshot are the previews of the house at each level (House-Purple's own button icon, and the model its
    // `levelVariants[2]` names, in buildingAssets.js); the screenshot is the "Services" tab of a house, with the needs of its evolution.
    id: 'house-evolution',
    when: [{ supplied: { type: 'House-Purple', category: 'water' } }, { supplied: { type: 'House-Red', category: 'water' } }],
    delay: 0,
    news: {
      title: 'Des maisons qui grandissent',
      body: `L'eau coule enfin jusqu'à vos maisons « {building:House-Purple} » et « {building:House-Red} ». C'est un pas vers **l'évolution** : une maison `
        + `dont les besoins sont comblés passe au niveau supérieur, abrite plus d'habitants et leur donne de **nouveaux savoirs**.\n\n`
        + `Prenons une maison « {building:House-Purple} » : pour passer du **niveau 1 au niveau 2**, il lui faut :\n`
        + `- une **route** ;\n`
        + `- au moins un **habitant** ;\n`
        + `- de la **nourriture** ;\n`
        + `- de l'**eau** ;\n`
        + `- des **soins médicaux**.\n\n`
        + `Ces besoins se lisent dans l'onglet **« Services »** de sa fiche (clic droit sur la maison), sous « besoins pour l'évolution » :\n`
        + `- une **coche** ✓ : le besoin est comblé ;\n`
        + `- une **croix** : il manque encore ;\n`
        + `- **« inexistant »** : aucun bâtiment ne fournit encore ce service à la maison, comme les soins médicaux ici.`,
      teaser: 'Un messager parle d’avenir…',
      blocking: false,
      illustrations: [
        { src: '/resources/kenney_city-kit-suburban_20/Previews/building-type-l.png', label: 'Niveau 1' },
        { src: '/resources/kenney_city-kit-suburban_20/Previews/building-type-s.png', label: 'Niveau 2' },
      ],
      image: { src: '/tuto/services.png', alt: 'L’onglet « Services » d’une maison : sa route, et ses besoins pour l’évolution (population, nourriture, eau, soins médicaux)' },
    },
  },
  {
    // The last one: once the market and the granary have been explained ('trade-chain' read, so they are unlocked) and the market has fed the houses, what the
    // houses still lack to evolve — the medical care — and the building that gives it. It is staffed by scholars (the skill is theirs from their first level).
    // It unlocks the doctor, whose button the dépêche offers: nothing before it can place one.
    id: 'doctor-needed',
    // The houses have water too (the tank, introduced by 'scholars-water', serves the scholars' and the artisans' houses, as 'house-evolution' waits for), so
    // that dépêche comes before this one.
    when: [
      { newsRead: 'trade-chain' },
      { fed: 'House-Red' },
      { supplied: { type: 'House-Purple', category: 'water' } },
      { supplied: { type: 'House-Red', category: 'water' } },
    ],
    delay: 0,
    unlocks: ['Doctor'],
    news: {
      title: 'Des soins pour vos habitants',
      body: `Le marché nourrit vos habitants. Pour qu'une maison évolue, il lui manque encore les **soins médicaux** : bâtissez un « {building:Doctor} ».\n\n`
        + `Il embauche des habitants ayant la compétence {skillicon:medical} « {skill:medical} », que seuls les « {building:House-Purple} » ont : leur maison `
        + `est donc indispensable.\n\n`
        + `**Quand la route, l'eau, la nourriture et les soins sont réunis, vos maisons passent au niveau 2.** Suivez-le dans l'onglet **« Services »** de leur fiche.`,
      teaser: 'Un messager réclame un médecin…',
      blocking: false,
      action: { kind: 'buildTool', toolId: 'Doctor' },
    },
  },
  {
    // The end of the tutorial, and not 'house-evolution' (which only explains how houses evolve, ahead of it): once EVERY house of the three groups has evolved to
    // level 2 — and a few turns later, time to see it — the player is congratulated, told what the level brings, and sent on to the other tutorials.
    id: 'houses-evolved',
    when: [
      { leveled: { type: 'House-Red', level: 2, every: true } },
      { leveled: { type: 'House-Blue', level: 2, every: true } },
      { leveled: { type: 'House-Purple', level: 2, every: true } },
    ],
    delay: 5,
    news: {
      title: 'Bravo, votre cité grandit',
      body: `**Bravo !** Vous avez fait passer vos maisons **au niveau 2** : elles abritent **plus d'habitants** et leur donnent de **nouvelles compétences**, `
        + `qui vous permettent de faire évoluer la ville.\n\n`
        + `Mais regardez vos finances : elles sont **dans le rouge**, et il reste de nombreux défis à relever.\n\n`
        + `**Explorez d'autres tutoriels** pour apprendre à aller plus loin.`,
      teaser: 'Le bilan de votre premier pas…',
      blocking: false,
    },
  },
  {
    // The moment a field has booked its first sale: the sale worked, and the field earned money. The picture is the "Finances" tab of a field right after a
    // sale (public/tuto/production_vendue_fermes.png): the income statement, with its "Production vendue" line.
    id: 'harvest-sold',
    when: [{ sold: 'Farm-Wheat' }],
    delay: 0,
    news: {
      title: 'La vente a réussi',
      body: `Votre récolte est vendue : **la vente a réussi**, et votre « {building:Farm-Wheat} » a **gagné de l'argent** grâce à elle.\n\n`
        + `Ce gain figure dans les comptes du champ, parmi ses **produits d'exploitation** : la ligne « Production vendue » (et, dessous, « Ventes du `
        + `bâtiment ») montre ce que la vente lui a rapporté cette année.\n\n`
        + `Vous pouvez le vérifier sur **chaque bâtiment** : faites un clic droit dessus, ouvrez l'onglet **« Finances »**, puis **« Compte de résultat »**.`,
      teaser: 'Les négociants font leurs comptes…',
      blocking: false,
      image: { src: '/tuto/production_vendue_fermes.png', alt: 'L’onglet « Finances » d’un champ de blé, compte de résultat : la production vendue et les ventes du bâtiment dans les produits d’exploitation' },
    },
  },
]);

/** How long a toast stays on screen, in milliseconds: long enough to be read while the player keeps playing. */
const TOAST_MS = 7000;
/** A toast that explains a gesture. */
const TOAST_LONG_MS = 10000;

/**
 * The toasts of the tutorial: short, non-blocking messages that underline a moment while the player works (see AdvanceTutorial.js). A toast shows once,
 * the moment its conditions all come true; it shows again only if that moment comes back after having gone. A toast is
 * `{ id, kind, duration, text, when?, unless?, step?, delay?, highlight? }`:
 * - `duration`: milliseconds on screen (required).
 * - `when` / `unless`: conditions that must all hold / none of which may hold. The kinds include the city's facts (`built`, `housed`, `staffed`,
 *   `foodCovered`) and the game's clock: `turnAtLeast: N`, `season: 'Automne'`, `month: 'Septembre'`, `harvest: true` (the catalog's harvest month).
 * - `step`: a step id; the moment is on only once the player has reached that step (is on it or past it). Use it alone for "when this instruction arrives".
 * - `delay`: turns the moment must last before it shows (always said, 0 = at once).
 * - `until`: conditions that, once they all hold, take the toast off the screen (the player did what it points at) and clear its highlight; a toast
 *   whose `until` already holds is not shown. A toast is also taken off when its moment goes off (its `when` / `unless` no longer say so).
 * - `priority`: `TOAST_PRIORITIES.instruction` (points the player at something to do), `.lack` (a building still misses something) or `.news` (a
 *   congratulation, an arrival); always said. The screen shows only a few toasts at once: the higher priority shows first, the others wait their turn
 *   and are dropped if they wait as long as they would have stayed on screen (see `showTutorialToast`, game.js). A step's reminder is an instruction.
 * - `highlight`: 'construction' (the house-shaped button that opens the build bar), 'road' (the road button beside it) or 'history' (the button that
 *   opens the tutorial's dépêches again), 'pause' (the button that stops the clock) or 'merchants' (the merchants' pill of the build bar) turns yellow and
 *   pulses until the player clicks it. A list points at several buttons one after the other (`['construction', 'merchants']`: the one that opens the build
 *   bar, then the pill).
 * At least one of `when` / `step` is required.
 * Kinds: 'success' for something that works, 'info' for news, 'warning' for something still missing.
 *
 * @type {ReadonlyArray<import('../policies/TutorialProgressPolicy.js').TutorialToast>}
 */
export const TUTORIAL_TOASTS = Object.freeze([
  {
    id: 'road-button',
    priority: TOAST_PRIORITIES.instruction,
    delay: 0,
    duration: TOAST_LONG_MS,
    kind: 'info',
    step: 'road',
    until: [{ roadBuilt: 1 }],
    highlight: 'road',
    text: `Pour tracer une route, cliquez sur le bouton de route, à côté du bouton en forme de maison.`,
  },
  {
    // The moment the first house (the mayor's does not count) stands: from now on every building is chosen from the build bar, opened by this button.
    id: 'houses-button',
    priority: TOAST_PRIORITIES.instruction,
    duration: TOAST_LONG_MS,
    kind: 'info',
    when: [{ built: 'House-Red' }],
    delay: 0,
    until: [{ built: 'Market-Stall-Red' }],
    highlight: 'construction',
    text: `Pour construire un bâtiment, cliquez sur le bouton en forme de maison de la barre du bas.`,
  },
  {
    // As soon as the dépêche of the sale ('trade-chain') is closed: where to click to reach the market and the granary. The button that opens the build bar
    // pulses, then the merchants' pill (the carousel of the market and the granary) once the player has clicked it. The toast waits for the dépêche to be closed.
    id: 'trade-build-hint',
    priority: TOAST_PRIORITIES.instruction,
    duration: TOAST_LONG_MS,
    kind: 'info',
    when: [{ newsRead: 'trade-chain' }],
    unless: [{ built: 'Market-Stall-Red' }],
    delay: 0,
    highlight: ['construction', 'merchants'],
    text: `Pour les poser : cliquez sur le bouton en forme de maison, puis sur la pastille « {building:House-Blue} », où se trouvent « {building:Market-Stall-Red} » et « {building:Windmill-001} ».`,
  },
  {
    // A little before the dépêche of the sale ('trade-chain', 30 turns after the step is reached): the wait is a good time to stop the clock. It says only
    // that the pause stops the game: building while paused is not possible yet.
    id: 'pause-hint',
    priority: TOAST_PRIORITIES.instruction,
    duration: TOAST_LONG_MS,
    kind: 'info',
    step: 'trade',
    delay: 20,
    highlight: 'pause',
    text: `Le temps file : le bouton pause, dans la barre du bas, arrête le jeu quand vous avez besoin de souffler.`,
  },
  {
    // As soon as the houses and the fields stand: the season of the sale, and the wait for it.
    id: 'harvest-season',
    priority: TOAST_PRIORITIES.news,
    duration: TOAST_MS,
    kind: 'info',
    step: 'trade',
    delay: 8,
    text: `La récolte se vend en {harvest:when}. D'ici là, vos champs poussent.`,
  },
  {
    // Due with the first dépêche of the tutorial (the artisans'); a toast waits for the dépêche to be closed, so it comes right after it is read.
    id: 'history-button',
    priority: TOAST_PRIORITIES.instruction,
    delay: 0,
    duration: TOAST_LONG_MS,
    kind: 'info',
    step: 'artisans',
    highlight: 'history',
    text: `Retrouvez toutes les dépêches du tutoriel en cliquant sur ce bouton.`,
  },
  // Congratulations: the moment an objective of the steps is reached, the toast says so (the same conditions as the step's `done`).
  {
    id: 'road-reached',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ roadBuilt: 1 }],
    text: `Bravo, votre première route est tracée !`,
  },
  {
    id: 'artisans-reached',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ built: { type: 'House-Red', atLeast: 3 } }],
    text: `Bravo ! Vos trois maisons « {building:House-Red} » sont posées.`,
  },
  {
    id: 'trade-reached',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ built: 'Market-Stall-Red' }, { built: 'Windmill-001' }],
    text: `Bravo ! « {building:Market-Stall-Red} » et « {building:Windmill-001} » sont posés.`,
  },
  {
    id: 'chain-reached',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ foodCovered: 'staffed' }, { staffed: 'Windmill-001' }, { staffed: 'Market-Stall-Red' }],
    text: `Félicitations ! Tous vos bâtiments ont leurs travailleurs : votre économie tourne.`,
  },
  {
    id: 'artisans-settled',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'info',
    when: [{ housed: 'House-Red' }],
    text: `Les premiers habitants s'installent dans la maison « {building:House-Red} » !`,
  },
  {
    id: 'merchants-settled',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'info',
    when: [{ housed: 'House-Blue' }],
    text: `Les premiers habitants s'installent dans la maison « {building:House-Blue} » !`,
  },
  {
    id: 'field-not-enough',
    priority: TOAST_PRIORITIES.lack,
    delay: 0,
    duration: TOAST_MS,
    kind: 'warning',
    when: [{ built: 'Farm-Wheat' }],
    unless: [{ foodCovered: 'built' }],
    text: `Vos champs ne nourrissent pas encore tous vos habitants : posez-en d'autres.`,
  },
  {
    id: 'food-covered',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ built: 'Farm-Wheat' }, { foodCovered: 'built' }],
    text: `Bravo ! Vos champs nourriront tous vos habitants.`,
  },
  {
    id: 'farm-waits-workers',
    priority: TOAST_PRIORITIES.lack,
    duration: TOAST_MS,
    kind: 'warning',
    when: [{ built: 'Farm-Wheat' }],
    unless: [{ staffed: 'Farm-Wheat' }],
    delay: 10,
    text: `« {building:Farm-Wheat} » attend encore ses travailleurs : il lui faut des habitants ayant la compétence « {skill:fermier} ».`,
  },
  {
    id: 'farm-staffed',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ staffed: 'Farm-Wheat' }],
    text: `« {building:Farm-Wheat} » est maintenant pourvu en travailleurs !`,
  },
  {
    id: 'granary-waits-workers',
    priority: TOAST_PRIORITIES.lack,
    duration: TOAST_MS,
    kind: 'warning',
    when: [{ built: 'Windmill-001' }],
    unless: [{ staffed: 'Windmill-001' }],
    delay: 10,
    text: `« {building:Windmill-001} » attend encore ses travailleurs : il lui faut des habitants ayant la compétence « {skill:stockage-alimentaire} ».`,
  },
  {
    id: 'granary-staffed',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ staffed: 'Windmill-001' }],
    text: `« {building:Windmill-001} » est maintenant pourvu en travailleurs !`,
  },
  {
    id: 'market-waits-workers',
    priority: TOAST_PRIORITIES.lack,
    duration: TOAST_MS,
    kind: 'warning',
    when: [{ built: 'Market-Stall-Red' }],
    unless: [{ staffed: 'Market-Stall-Red' }],
    delay: 10,
    text: `« {building:Market-Stall-Red} » attend encore ses travailleurs : il lui faut des habitants ayant la compétence « {skill:vente-alimentaire} ».`,
  },
  {
    id: 'market-staffed',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'success',
    when: [{ staffed: 'Market-Stall-Red' }],
    text: `« {building:Market-Stall-Red} » est maintenant pourvu en travailleurs !`,
  },
  {
    id: 'harvest-begins',
    priority: TOAST_PRIORITIES.news,
    delay: 0,
    duration: TOAST_MS,
    kind: 'info',
    when: [{ harvest: true }, { built: 'Farm-Wheat' }],
    text: `C'est la moisson : « {building:Farm-Wheat} » livre sa récolte.`,
  },
]);
