import { TOAST_PRIORITIES } from '../policies/TutorialProgressPolicy.js';

/** How long a reminder toast stays on screen, in milliseconds. */
const REMINDER_MS = 8000;

/**
 * The construction buttons that work while the player waits for the harvest: everything the steps and dispatches of that time ask for (the road, the
 * artisans' houses and fields, the market, the granary, the scholars' house and the water tank). The merchants' house is not there: it works once the dépêche
 * that explains the shortage of hands has been written (`unlocks` of 'merchants-needed').
 */
const WAIT_FOR_HARVEST_TOOLS = Object.freeze([
  'StonePath-001', 'House-Red', 'Farm-Wheat', 'Market-Stall-Red', 'Windmill-001', 'House-Purple', 'WaterTank',
]);

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
 * - `allow`: the construction buttons (building ids) that work while the player is on the step; the other construction buttons are greyed out. Every step
 *   says it. The button of a building a dépêche or a toast of that step asks for must be in it. Once the script is over, nothing is greyed out.
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
    allow: ['House-Mayor'],
    done: [{ built: 'House-Mayor' }],
    news: null,
  },
  {
    // No dépêche: the toast that points at the road button says it all (see 'road-button').
    id: 'road',
    delay: 0,
    allow: ['StonePath-001'],
    counter: { after: null, label: 'Route tracée', items: [{ type: 'StonePath-001', atLeast: 1 }] },
    done: [{ roadBuilt: true }],
    reminder: { after: 15, every: 20, duration: REMINDER_MS, text: `Il faut tracer une route : cliquez sur le bouton de route, à côté du bouton en forme de maison.` },
    news: null,
  },
  {
    id: 'artisans',
    delay: 0,
    allow: ['StonePath-001', 'House-Red'],
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
    allow: ['StonePath-001', 'House-Red', 'Farm-Wheat'],
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
    // The wait for the harvest: a house of the artisans (a fourth), the market and the granary, recommended by a dispatch below and chosen from the build menu.
    // The merchants' house is not asked for: the player finds out they need it when the market and the granary lack workers ('merchants-needed').
    id: 'trade',
    delay: 0,
    allow: WAIT_FOR_HARVEST_TOOLS,
    counter: {
      after: { news: 'trade-chain' },
      label: '{building:Market-Stall-Red} et {building:Windmill-001}',
      items: [{ type: 'Market-Stall-Red', atLeast: 1 }, { type: 'Windmill-001', atLeast: 1 }],
    },
    done: [{ built: { type: 'House-Red', atLeast: 4 } }, { built: 'Market-Stall-Red' }, { built: 'Windmill-001' }],
    reminder: {
      after: 60,
      every: 40,
      duration: REMINDER_MS,
      text: `Avant la vente, il vous reste à poser une maison « {building:House-Red} », « {building:Market-Stall-Red} » et « {building:Windmill-001} ».`,
    },
    news: null,
  },
  {
    // Nothing to say: the dépêche comes from the shortage itself ('workers-needed', or 'merchants-needed' for the market and the granary), the toasts tell when each building has its workers.
    id: 'staff-the-chain',
    delay: 0,
    allow: WAIT_FOR_HARVEST_TOOLS,
    reminder: { after: 40, every: 60, duration: REMINDER_MS, text: `Un bâtiment sans ses travailleurs reste muet : vérifiez que chacun est pourvu, sinon il manque des maisons.` },
    done: [{ foodCovered: 'staffed' }, { staffed: 'Windmill-001' }, { staffed: 'Market-Stall-Red' }],
    news: null,
  },
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
    news: {
      title: 'Préparer la vente',
      body: `La récolte doit être stockée puis vendue. Choisissez dans la barre de construction : une maison « {building:House-Red} » de plus, `
        + `« {building:Market-Stall-Red} » pour vendre et « {building:Windmill-001} » pour garder la récolte.`,
      teaser: 'Les négociants se préparent à la moisson…',
      blocking: false,
      illustrations: ['House-Red', 'Market-Stall-Red', 'Windmill-001'],
    },
  },
  {
    // At once, the moment any building shows the no-work sprite (a building that needs workers and has none), whatever step the player is on: the rule of
    // the groups of inhabitants. Not while the market or the granary is the one lacking hands: 'merchants-needed' says it, with the merchants' house.
    id: 'workers-needed',
    when: [{ noWork: 'any' }],
    unless: [{ noWork: ['Market-Stall-Red', 'Windmill-001'] }],
    delay: 0,
    news: {
      title: 'Il manque des bras',
      body: `Un bâtiment qui affiche cette icône n'a pas de travailleurs : il reste à l'arrêt. Chaque bâtiment est relié à l'un des trois groupes `
        + `d'habitants — « {building:House-Red} », « {building:House-Blue} » ou « {building:House-Purple} » — et n'embauche que dans son groupe, selon `
        + `leurs compétences : « {building:Farm-Wheat} » demande des « {skill:fermier} », que seuls les « {building:House-Red} » ont. Quand un `
        + `bâtiment attend ses travailleurs, il faut plus de maisons du groupe qui a les compétences voulues.`,
      teaser: 'Des bâtiments restent sans bras…',
      blocking: false,
      illustrations: ['Farm-Wheat'],
      // The sprite as the game draws it above a building (public/tuto/no-work-sprite.svg: the pink disc and the glyph of the no-work icon), at its own size.
      image: { src: '/tuto/no-work-sprite.svg', alt: 'L’icône « sans travailleurs » qui s’affiche au-dessus d’un bâtiment' },
      // A page carries one picture: the example in the game itself (a screenshot, public/tuto/no-work-farms.png) is the page "Lire la suite" opens.
      next: {
        body: `Voici à quoi cela ressemble : l'icône flotte au-dessus de chaque « {building:Farm-Wheat} » qui attend ses travailleurs.`,
        image: { src: '/tuto/no-work-farms.png', alt: 'Des champs de blé, chacun avec l’icône « sans travailleurs » au-dessus' },
      },
    },
  },
  {
    // At once, the moment the market or the granary shows the no-work sprite: who is missing, and the button that puts the merchants' house in hand.
    // Tied to the 'trade' step: it is said once that step is reached. It unlocks the merchants' house, greyed out until now.
    id: 'merchants-needed',
    step: 'trade',
    when: [{ noWork: ['Market-Stall-Red', 'Windmill-001'] }],
    delay: 0,
    unlocks: ['House-Blue'],
    news: {
      title: 'Il manque des commerçants',
      body: `« {building:Market-Stall-Red} » et « {building:Windmill-001} » attendent leurs travailleurs : ils demandent des habitants ayant les compétences `
        + `« {skill:vente-alimentaire} » et « {skill:stockage-alimentaire} », que seuls les « {building:House-Blue} » ont. Il vous faut plus de commerçants.`,
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
    // The moment the merchants' house stands: what the skills are and where to read them.
    id: 'merchants-skills',
    when: [{ built: 'House-Blue' }],
    delay: 2,
    news: {
      title: 'Des habitants, des savoirs',
      body: `Chaque habitant a des savoirs, et un bâtiment n'embauche que ceux qu'il lui faut : {skillicon:vente-alimentaire} « {skill:vente-alimentaire} » `
        + `pour le marché, {skillicon:stockage-alimentaire} « {skill:stockage-alimentaire} » pour le grenier, {skillicon:fermier} « {skill:fermier} » `
        + `pour les champs. Faites un clic droit sur la maison « {building:House-Blue} » : l'onglet « 🧠 Savoirs » de sa fiche montre ceux de ses habitants.`,
      teaser: 'Un messager parle de savoirs…',
      blocking: false,
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
 *   opens the tutorial's dépêches again) turns yellow and pulses until the player clicks it.
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
    until: [{ roadBuilt: true }],
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
    when: [{ roadBuilt: true }],
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
    when: [{ built: { type: 'House-Red', atLeast: 4 } }, { built: 'Market-Stall-Red' }, { built: 'Windmill-001' }],
    text: `Bravo ! Une maison « {building:House-Red} » de plus, « {building:Market-Stall-Red} » et « {building:Windmill-001} » sont posés.`,
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
