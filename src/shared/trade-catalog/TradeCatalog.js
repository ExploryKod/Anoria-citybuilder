/**
 * Trade catalog — which cities Anoria can trade with, what they want, at what
 * price multiplier, and the terms of the commercial relationship.
 *
 * Intentionally separate from WorldCityCatalog (geography) and
 * ResourceCategoryCatalog (presentation): trade rules are economic, not visual.
 *
 * Each entry declares:
 *   cityId          — matches a WorldCityCatalog id
 *   wants           — goods this city will buy, each with a baseMultiplier applied
 *                     on top of the good's own ResourceCategoryCatalog.baseValue. For a want with a
 *                     `merchantGood` (our merchants export it, see RunMonthlyCityTradeCycle.js), the merchants bought the
 *                     good from a warehouse at the value chain's hub price (baseValue × 1.2 × 1.2, ValueChainCatalog) and pay the good's
 *                     export duty (set per good in the customs panel; FiscalRateCatalog's default is 0, 15% on wood) on the sale:
 *                     baseMultiplier must clear 1.44 / (1 − duty) — 1.44 at no duty, about 1.7 at 15% — or the merchants cease
 *                     to export it (`export_unprofitable`). The buying city pays the freight.
 *   offers          — goods this city SELLS to Anoria (imports), each with a baseMultiplier on the good's baseValue
 *                     (the city's price per unit), a quantity per order (cq) and the `merchantGood` deal that Anoria's
 *                     merchants make for it. Delivered to a trade warehouse on the order months (`trade.frequencyMonths`, ct),
 *                     against the deals the merchants hold; see TRADE_IMPORT for who pays what.
 *   transport       — how the goods reach Anoria: a `mode` (a key of TRADE_IMPORT.transportModes) and the city's
 *                     `distanceMultiplier` on that mode's base price.
 *   relation        — contract duration and thresholds (`breakThreshold`, `renewalThreshold`): kept for the contracts (step 8 of the plan) and the relation's break
 *                     (steps 6 and 7); nothing reads them now, neither the satisfaction nor the memory ends a relation yet
 *   personality     — the level of each trait of PARTNER_TRAITS: it sets how the partner reacts, and its character in words for the player
 *   trade           — order rhythm and quantity per order
 *   satisfaction    — the city's own factors of the commercial satisfaction, for each good it trades (see TradeSatisfactionPolicy.js and
 *                     COMMON_SATISFACTION_FACTORS); each review sums them into one number -100..100 per good and flow
 *   sale            — the price range a merchant sells at: `spread` is how far the ratio can move from
 *                     a want's baseMultiplier (±), `drawWidth` the width of the random draw (0..1 of the spread).
 *                     Events and the relation move the range's centre through the cycle's saleBias.
 *   openingRequirements — conditions to open the relation (empty = always open);
 *                     add new keys here as canOpenRelation.js implements each check
 *
 * @typedef {{
 *   cityId: string,
 *   wants: ReadonlyArray<{ good: string, merchantGood: string, baseMultiplier: number }>,
 *   offers: ReadonlyArray<{ good: string, merchantGood: string, baseMultiplier: number, quantityPerOrder: number }>,
 *   transport: { mode: string, distanceMultiplier: number },
 *   relation: { durationMonths: number, renewalThreshold: number, breakThreshold: number },
 *   trade: { frequencyMonths: number, quantityPerOrder: number },
 *   sale: { spread: number, drawWidth: number },
 *   personality: Record<string, string>, // the level of each trait of PARTNER_TRAITS (see personalityOf)
 *   culture: string, // what the city's trade is like, for the player: no figures
 *   satisfaction: ReadonlyArray<{ name: string, [param: string]: number }>,
 *   openingRequirements: {
 *     minMerchants?: number,
 *     minAttractiveness?: number,
 *     giftsSent?: number,
 *     ideology?: string,
 *     noWarWith?: string[],
 *   },
 * }} TradeCatalogEntry
 */

/**
 * How an import is priced and when the merchants give it up. Per unit, in this order:
 *   foreign price      = the good's baseValue × the offer's baseMultiplier        (to the city, outside Anoria)
 *   transport          = the mode's basePrice × the city's distanceMultiplier × the good's transportWeight
 *                        × (1 − the discount of the delivery's volume tier)         (to carriers, outside Anoria)
 *   customs duty       = (foreign price + transport) × the good's import duty      (to the city's treasury)
 *   merchants' margin  = (foreign price + transport + duty) × merchantMargin       (to the merchant houses)
 * The duty's base is the customs value: the price plus every charge generated outside Anoria, never the merchants'
 * margin, which is earned inside it.
 *   marketCeiling      — the most the market pays for one unit, as a multiple of the good's baseValue: when the
 *                        landed price plus margin is above it, the merchants cease to deal (`unprofitable`).
 *   failedOrdersBeforeCease — consecutive order months the warehouse could not take or pay before the merchants stop.
 *   dealLifetimeMonths — a waiting deal older than this is dropped (`expired`).
 */
export const TRADE_IMPORT = Object.freeze({
  merchantMargin: 0.10,
  marketCeiling: 2.2,
  failedOrdersBeforeCease: 3,
  dealLifetimeMonths: 6,
  transportModes: Object.freeze({
    land: Object.freeze({ basePrice: 0.04 }),
    sea: Object.freeze({ basePrice: 0.05 }),
  }),
  /** The per-unit transport discount from this delivery size up (units): the largest tier reached applies. */
  volumeTiers: Object.freeze([
    Object.freeze({ from: 10, discount: 0.05 }),
    Object.freeze({ from: 25, discount: 0.10 }),
    Object.freeze({ from: 40, discount: 0.15 }),
  ]),
});

/**
 * How an export is priced and when the merchants give it up. Per unit, our merchants buy the good from a warehouse at the
 * value chain's hub price (their cost), sell it to the city at its drawn price, and pay Anoria's export duty on that sale.
 * The buying city pays the freight (its own merchants bring the goods home), so an export carries no transport charge.
 *   failedOrdersBeforeCease — consecutive order months with no deal waiting before the merchants stop.
 * The merchants cease when the price at the centre of the range, duty taken off, does not cover their cost (`export_unprofitable`).
 */
export const TRADE_EXPORT = Object.freeze({
  failedOrdersBeforeCease: 3,
});

/**
 * How the balance of the trade is commented (docs/gameplay/PLAN_TRADE_RELATIONS.md). First values, to tune by playing.
 *   balancedBand — a balance within this share of the purchases is "in balance" (below it, a deficit; above, a surplus);
 *   dependence   — when one partner (or one good) holds this share of a side of the trade, the commentary warns, then warns strongly: at half, one actor weighs more than all the
 *                  others together; at seven tenths, losing it disorders the economy.
 */
export const TRADE_BALANCE_COMMENTARY = Object.freeze({
  balancedBand: 0.05,
  dependence: Object.freeze({ warning: 0.5, strong: 0.7 }),
});

/**
 * What the player reads when a trade stops: who ceased (`by`, see TradeCeasePolicy) and why. One line per reason id of
 * CEASE_REASONS; a reason with no line here is shown as "…" with a warning, never as its id.
 */
export const TRADE_CEASE_WORDING = Object.freeze({
  by: Object.freeze({ city: 'La ville a cessé', merchants: 'Nos marchands ont cessé' }),
  reasons: Object.freeze({
    unprofitable: "le prix rendu, droits et transport compris, dépasse ce que le marché paie",
    export_unprofitable: "la vente, droits déduits, ne couvre plus le prix d'achat des marchandises",
    export_no_merchants: "aucun accord d'export n'attend : aucune maison de négociants ne les prépare",
    export_no_warehouse: "pas d'entrepôt commercial disponible (aucun entrepôt commercial existant)",
    no_warehouse: "pas d'entrepôt commercial disponible (aucun entrepôt commercial existant)",
    warehouse_full: "pas d'entrepôt commercial disponible (aucune place en entrepôt commercial)",
    no_merchants: "aucun accord n'attend : aucune maison de négociants ne les prépare",
  }),
});

/** @type {ReadonlyArray<TradeCatalogEntry>} */
export const TRADE_CATALOG = Object.freeze([
  {
    cityId: 'olivea',
    wants: Object.freeze([
      { good: 'wood', merchantGood: 'dealWood', baseMultiplier: 1.9 },
      { good: 'rock', merchantGood: 'dealRock', baseMultiplier: 1.7 },
      { good: 'iron', merchantGood: 'dealIron', baseMultiplier: 1.7 },
      { good: 'pot',  merchantGood: null,        baseMultiplier: 1.3 },
      { good: 'oil',  merchantGood: null,        baseMultiplier: 1.4 },
    ]),
    offers: Object.freeze([]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 60, breakThreshold: -80 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.0 }),
    trade: Object.freeze({ frequencyMonths: 1, quantityPerOrder: 30 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'absorbs', aidSensitivity: 'patient', customsSensitivity: 'tolerant', memory: 'tenacious', riskTaste: 'measured', gratitude: 'normal', liberalism: 'moderate' }),
    culture: "Négociants patients et méthodiques, nés de la culture de l'olivier. Ils bâtissent leur confiance lentement mais la gardent longtemps : un partenaire qui tient ses engagements finit par devenir indispensable. Ils recherchent surtout l'huile, les pots et le bois.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 1, loss: 2 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'silvania',
    wants: Object.freeze([
      { good: 'gold',         merchantGood: 'dealGold',         baseMultiplier: 1.8 },
      { good: 'book',         merchantGood: 'dealBook',         baseMultiplier: 1.8 },
      { good: 'decoratedPot', merchantGood: 'dealDecoratedPot', baseMultiplier: 1.75 },
      { good: 'decoratedPlate', merchantGood: 'dealDecoratedPlate', baseMultiplier: 1.75 },
      { good: 'gildedPot', merchantGood: 'dealGildedPot', baseMultiplier: 2.2 },
    ]),
    offers: Object.freeze([{ good: 'exoticWood', merchantGood: 'dealExoticWood', baseMultiplier: 1.5, quantityPerOrder: 15 }]),
    relation: Object.freeze({ durationMonths: 6, renewalThreshold: 70, breakThreshold: -40 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.2 }),
    trade: Object.freeze({ frequencyMonths: 2, quantityPerOrder: 20 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'retaliates', aidSensitivity: 'normal', customsSensitivity: 'normal', memory: 'forgetful', riskTaste: 'bold', gratitude: 'warm', liberalism: 'liberal' }),
    culture: "Forestiers et enthousiastes, ils s'enflamment pour les belles pièces. Leur confiance grimpe vite après une bonne livraison, mais un manquement la fait retomber tout aussi vite. Ils collectionnent les livres et les pots décorés.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 3, loss: 6 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'briga',
    wants: Object.freeze([
      { good: 'wheat',  merchantGood: 'dealWheatExport', baseMultiplier: 1.7 },
      { good: 'carrot', merchantGood: 'dealCarrotExport', baseMultiplier: 1.7 },
    ]),
    offers: Object.freeze([{ good: 'coal', merchantGood: 'dealCoal', baseMultiplier: 1.35, quantityPerOrder: 40 }]),
    relation: Object.freeze({ durationMonths: 6, renewalThreshold: 50, breakThreshold: -60 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.5 }),
    trade: Object.freeze({ frequencyMonths: 3, quantityPerOrder: 50 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'absorbs', aidSensitivity: 'patient', customsSensitivity: 'tolerant', memory: 'average', riskTaste: 'cautious', gratitude: 'modest', liberalism: 'protectionist' }),
    culture: "Village isolé et pragmatique. Pas de goût particulier pour la nouveauté : ils achètent le grain et les légumes qui nourrissent leurs foyers. Réguliers mais peu bavards, ils jugent un partenaire à la régularité de ses livraisons.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 5 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'piceta',
    wants: Object.freeze([
      { good: 'wheat', merchantGood: 'dealWheatExport', baseMultiplier: 1.75 },
      { good: 'oil',   merchantGood: null, baseMultiplier: 1.45 },
    ]),
    offers: Object.freeze([{ good: 'uranium', merchantGood: 'dealUranium', baseMultiplier: 1.3, quantityPerOrder: 10 }]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 55, breakThreshold: -60 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.8 }),
    trade: Object.freeze({ frequencyMonths: 3, quantityPerOrder: 20 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'absorbs', aidSensitivity: 'rancorous', customsSensitivity: 'normal', memory: 'tenacious', riskTaste: 'cautious', gratitude: 'modest', liberalism: 'moderate' }),
    culture: "Cité minière bâtie autour de ses galeries, où l'on extrait le minerai qui alimente les plus grandes centrales. Les mineurs ne mangent pas ce qu'ils creusent : ils achètent le blé et l'huile en gros, paient comptant et jugent un partenaire à la ponctualité de ses convois.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 4 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'maris',
    wants: Object.freeze([
      { good: 'gold',      merchantGood: 'dealGold', baseMultiplier: 1.8 },
      { good: 'gildedPlate', merchantGood: 'dealGildedPlate', baseMultiplier: 2.2 },
      { good: 'iron',      merchantGood: 'dealIron', baseMultiplier: 1.7 },
      { good: 'furniture', merchantGood: null, baseMultiplier: 1.6 },
      { good: 'amphora',   merchantGood: null, baseMultiplier: 1.3 },
      { good: 'carrotCake', merchantGood: 'dealCarrotCake', baseMultiplier: 1.7 },
    ]),
    offers: Object.freeze([{ good: 'petrol', merchantGood: 'dealPetrol', baseMultiplier: 1.4, quantityPerOrder: 20 }]),
    relation: Object.freeze({ durationMonths: 24, renewalThreshold: 50, breakThreshold: -70 }),
    transport: Object.freeze({ mode: 'sea', distanceMultiplier: 2.0 }),
    trade: Object.freeze({ frequencyMonths: 1, quantityPerOrder: 15 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'retaliates', aidSensitivity: 'normal', customsSensitivity: 'tolerant', memory: 'average', riskTaste: 'bold', gratitude: 'normal', liberalism: 'liberal' }),
    culture: "Port habitué aux marchandises de luxe et aux commandes fréquentes. Exigeants sur les meubles et les amphores, ils passent commande chaque mois et ne font confiance qu'à la constance.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 5 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'sablia',
    wants: Object.freeze([
      { good: 'wheat',  merchantGood: 'dealWheatExport', baseMultiplier: 1.9 },
      { good: 'carrot', merchantGood: 'dealCarrotExport', baseMultiplier: 1.85 },
      { good: 'oil',    merchantGood: null, baseMultiplier: 1.5 },
      { good: 'pot',    merchantGood: null, baseMultiplier: 1.3 },
      { good: 'bread', merchantGood: 'dealBread', baseMultiplier: 1.9 },
      { good: 'cabbageSoup', merchantGood: 'dealCabbageSoup', baseMultiplier: 1.85 },
    ]),
    offers: Object.freeze([{ good: 'petrol', merchantGood: 'dealPetrol', baseMultiplier: 1.3, quantityPerOrder: 25 }]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 55, breakThreshold: -60 }),
    transport: Object.freeze({ mode: 'sea', distanceMultiplier: 1.6 }),
    trade: Object.freeze({ frequencyMonths: 2, quantityPerOrder: 25 }),
    sale: Object.freeze({ spread: 0.2, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'breaks', aidSensitivity: 'rancorous', customsSensitivity: 'sensitive', memory: 'forgetful', riskTaste: 'cautious', gratitude: 'modest', liberalism: 'protectionist' }),
    culture: "Oasis marchande au bord du désert : on n'y cultive presque rien et l'on y paie le grain, l'huile et la poterie au prix fort. Ses marchands sont durs en affaires et changent de fournisseur sans prévenir ; leur prix suit celui du grain dans le monde.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 6 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'carbonne',
    wants: Object.freeze([
      { good: 'wheat', merchantGood: 'dealWheatExport', baseMultiplier: 1.7 },
      { good: 'bread', merchantGood: 'dealBread', baseMultiplier: 1.7 },
      { good: 'cabbageSoup', merchantGood: 'dealCabbageSoup', baseMultiplier: 1.8 },
      { good: 'wood',  merchantGood: 'dealWood', baseMultiplier: 1.9 },
      { good: 'iron',  merchantGood: 'dealIron', baseMultiplier: 1.7 },
    ]),
    offers: Object.freeze([{ good: 'coal', merchantGood: 'dealCoal', baseMultiplier: 1.25, quantityPerOrder: 50 }]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 50, breakThreshold: -60 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.3 }),
    trade: Object.freeze({ frequencyMonths: 2, quantityPerOrder: 30 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'absorbs', aidSensitivity: 'normal', customsSensitivity: 'normal', memory: 'average', riskTaste: 'measured', gratitude: 'modest', liberalism: 'moderate' }),
    culture: "Cité de mineurs qui vit de ses galeries : le charbon y est bon marché, le bois d'étai et le fer toujours demandés, et le blé acheté en gros pour nourrir les équipes. Réguliers et peu bavards, ils paient à l'échéance.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 4 })]),
    openingRequirements: Object.freeze({}),
  },
  {
    cityId: 'frumenta',
    wants: Object.freeze([
      { good: 'pot',   merchantGood: null, baseMultiplier: 1.3 },
      { good: 'wood',  merchantGood: 'dealWood', baseMultiplier: 1.9 },
      { good: 'iron',  merchantGood: 'dealIron', baseMultiplier: 1.7 },
    ]),
    // Its grain is not cheap (the multiplier is the world's price for it, and the freight is long): the merchants bring it only when the city's own is dearer than that.
    offers: Object.freeze([{ good: 'wheat', merchantGood: 'dealWheat', baseMultiplier: 1.6, quantityPerOrder: 40 }]),
    relation: Object.freeze({ durationMonths: 12, renewalThreshold: 50, breakThreshold: -60 }),
    transport: Object.freeze({ mode: 'land', distanceMultiplier: 1.4 }),
    trade: Object.freeze({ frequencyMonths: 2, quantityPerOrder: 30 }),
    sale: Object.freeze({ spread: 0.15, drawWidth: 0.5 }),
    personality: Object.freeze({ embargoReaction: 'absorbs', aidSensitivity: 'patient', customsSensitivity: 'normal', memory: 'average', riskTaste: 'measured', gratitude: 'normal', liberalism: 'liberal' }),
    culture: "Plaine à blé aux greniers immenses, qui vit de ses récoltes. Ses négociants vendent le grain au prix du marché mondial, et le gardent quand il est cher : une mauvaise année dans le monde, et leurs prix suivent. Ils apprécient les pots, le bois et le fer.",
    satisfaction: Object.freeze([Object.freeze({ name: 'sales', gain: 2, loss: 5 })]),
    openingRequirements: Object.freeze({}),
  },
]);

/**
 * The commercial satisfaction (docs/gameplay/PLAN_TRADE_RELATIONS.md) is the climate of the business with a partner, for ONE good in ONE flow (an export or an import):
 * it runs both ways, from −100 (its merchants turn away) to +100 (they are keen), and a new relation starts at the middle of the scale. It never ends a relation: it cools,
 * and warms again as soon as the exchange resumes. The city's own factor is `entry.satisfaction` (its `sales` gain and loss, which say how fast its confidence moves);
 * the factors below are common to every city. Each review (an order month) sums them (see TradeSatisfactionPolicy.js).
 *   availability — at most this many points (±): the deals waiting against what an order asks (everything there: +, nothing: −);
 *   barriers     — points lost per review for each 100 % of our customs duty on the good (a 15 % duty at 10 costs 1.5 a review, rounded with the rest).
 * Not measured yet (they need the contracts and a demand of the partner's own, steps 8 and 10 of the plan): the price, the partner's need, the contracts.
 */
export const SATISFACTION_RANGE = Object.freeze({ min: -100, max: 100 });
export const SATISFACTION_START = 0;
export const COMMON_SATISFACTION_FACTORS = Object.freeze([
  Object.freeze({ name: 'availability', points: 1 }),
  Object.freeze({ name: 'barriers', perDuty: 10 }),
]);

/**
 * What the satisfaction does. Below zero the partner's merchants order less: an order is the entry's quantity times a share that falls from 1 (at zero and above) to
 * `quantityFloor` (at −100). Their price follows: the centre of a sale's range moves by the score over 100 times `priceBias` (at most ±`priceBias` of the range, the
 * merchants favoured when it is warm), so the partner pays less when it is cold and more when it is keen. First values, to tune by playing.
 */
export const SATISFACTION_EFFECTS = Object.freeze({ quantityFloor: 0.4, priceBias: 0.5 });

/** The steps of the scale, in the player's words: the last one whose `from` the score reaches. */
export const SATISFACTION_TIERS = Object.freeze([
  Object.freeze({ from: -100, label: 'glaciale' }),
  Object.freeze({ from: -49, label: 'fraîche' }),
  Object.freeze({ from: -15, label: 'normale' }),
  Object.freeze({ from: 16, label: 'chaude' }),
  Object.freeze({ from: 50, label: 'florissante' }),
]);

/** What the player reads for each factor of the satisfaction (the entry's own `sales` included). */
export const SATISFACTION_FACTOR_WORDING = Object.freeze({
  sales: 'fiabilité des commandes',
  availability: 'disponibilité',
  barriers: 'barrières',
});

/**
 * A partner's personality (docs/gameplay/PLAN_TRADE_RELATIONS.md): seven traits, each at one of three levels the catalog declares, and each city names the level of every trait
 * (`entry.personality`). A level has a `word` (the player's, null when the level is the unremarkable middle: the character shown is the words of the others, which warns
 * without giving a figure) and the figures its trait needs. Read now: `customsSensitivity` (`tolerance`: the duty above which the partner takes our customs for a hostile
 * act) and `memory` (`yearlyLoss` and `residue`: how an event of the relation fades). The other traits are declared for the steps that use them (gestures, embargoes,
 * contracts, free-trade treaties): `embargoReaction` (what it does when we cut a good), `aidSensitivity` (the weight of an aid not returned), `riskTaste` (the price gap
 * it accepts in a contract), `gratitude` (the weight of a gesture), `liberalism` (its own duties, and whether it proposes a treaty). First values, to tune by playing.
 */
export const PARTNER_TRAITS = Object.freeze({
  embargoReaction: Object.freeze({
    absorbs: Object.freeze({ word: 'placide' }),
    retaliates: Object.freeze({ word: 'fier' }),
    breaks: Object.freeze({ word: 'intransigeant' }),
  }),
  aidSensitivity: Object.freeze({
    patient: Object.freeze({ word: 'patient', weight: 0.5 }),
    normal: Object.freeze({ word: null, weight: 1 }),
    rancorous: Object.freeze({ word: 'rancunier', weight: 2 }),
  }),
  customsSensitivity: Object.freeze({
    tolerant: Object.freeze({ word: 'accommodant', tolerance: 0.35 }),
    normal: Object.freeze({ word: null, tolerance: 0.20 }),
    sensitive: Object.freeze({ word: 'ombrageux', tolerance: 0.10 }),
  }),
  memory: Object.freeze({
    forgetful: Object.freeze({ word: 'oublieux', yearlyLoss: 0.40, residue: 0.10 }),
    average: Object.freeze({ word: null, yearlyLoss: 0.25, residue: 0.15 }),
    tenacious: Object.freeze({ word: 'tenace', yearlyLoss: 0.12, residue: 0.25 }),
  }),
  riskTaste: Object.freeze({
    bold: Object.freeze({ word: 'audacieux', priceGap: 0.20 }),
    measured: Object.freeze({ word: null, priceGap: 0.10 }),
    cautious: Object.freeze({ word: 'prudent', priceGap: 0.05 }),
  }),
  gratitude: Object.freeze({
    modest: Object.freeze({ word: 'réservé', weight: 0.5 }),
    normal: Object.freeze({ word: null, weight: 1 }),
    warm: Object.freeze({ word: 'chaleureux', weight: 1.5 }),
  }),
  liberalism: Object.freeze({
    protectionist: Object.freeze({ word: 'protectionniste' }),
    moderate: Object.freeze({ word: null }),
    liberal: Object.freeze({ word: 'libéral' }),
  }),
});

/**
 * The relation (the memory between two States) is the sum of the events kept in its journal, each at its starting weight stamped when it was written, faded by the
 * partner's memory with its age. It runs from −100 to +100 and is read, never stored; the journal is never purged. Its steps, the last one whose `from` the score reaches.
 */
export const RELATION_RANGE = Object.freeze({ min: -100, max: 100 });
export const RELATION_TIERS = Object.freeze([
  Object.freeze({ from: -100, label: 'hostile' }),
  Object.freeze({ from: -59, label: 'tendue' }),
  Object.freeze({ from: -19, label: 'neutre' }),
  Object.freeze({ from: 21, label: 'cordiale' }),
  Object.freeze({ from: 60, label: 'amie' }),
]);

/**
 * The kinds of event that mark a relation: a starting weight (negative hurts, positive warms) and the words the chronology says it with (`{good}` is the good concerned).
 * A new kind is one entry here, written by whoever causes it. Written now: the customs the player sets, against the partner's tolerance (PARTNER_TRAITS.customsSensitivity).
 */
export const RELATION_EVENT_KINDS = Object.freeze({
  customs_hostile: Object.freeze({ weight: -15, wording: 'nos droits de douane sur {good} dépassent ce qu’il tolère' }),
  customs_relieved: Object.freeze({ weight: 8, wording: 'nos droits de douane sur {good} sont revenus à un niveau qu’il tolère' }),
  // A kind with no fixed weight (null) is weighed by the gesture that writes it, from its own rule (DIPLOMATIC_GESTURES); `{amount}` is the sum given.
  gift_received: Object.freeze({ weight: null, wording: 'nous lui avons fait un don de {amount}' }),
});

/**
 * The gestures the city can make to mend a relation (docs/gameplay/PLAN_TRADE_RELATIONS.md). Each costs money (an écriture of the journal, never a balance moved aside) and writes an
 * event in the relation's journal. First values, to tune by playing.
 *   gift — an amount of at least `minAmount` €; the event weighs `pointsPer100` per 100 € given, at most `maxPoints`, times the partner's gratitude (PARTNER_TRAITS.gratitude);
 *          the same gesture can be made again after `cooldownMonths`.
 * Still to come: the mission that renews a broken relation (nothing breaks one yet), and honouring an aid (the loans of the partner cities are not tied to the relation yet).
 */
export const DIPLOMATIC_GESTURES = Object.freeze({
  gift: Object.freeze({ minAmount: 100, pointsPer100: 3, maxPoints: 20, cooldownMonths: 3 }),
});

/** What the player reads when a gesture is refused (`{min}` the least a gift can be, `{months}` the wait), by reason; the journal's own reasons are the ones it gives. */
export const DIPLOMATIC_GESTURE_REFUSALS = Object.freeze({
  below_minimum: 'Un don doit être d’au moins {min}.',
  cooling_down: 'Un don a été fait trop récemment : il faut attendre {months} mois.',
  treasury_insufficient: 'La trésorerie de la ville ne permet pas ce don.',
});

/**
 * What a city's personality is, resolved to its levels. Strict: a trait the entry does not name, or a level the catalog does not declare, throws.
 * @param {{ cityId: string, personality?: Record<string, string> }} entry
 * @returns {Record<string, object>} the level of each trait (its figures and its word)
 */
export function personalityOf(entry) {
  const resolved = {};
  for (const [trait, levels] of Object.entries(PARTNER_TRAITS)) {
    const named = entry.personality?.[trait];
    if (!named) throw new Error(`[trade] ${entry.cityId} names no level for the personality trait "${trait}"`);
    if (!levels[named]) throw new Error(`[trade] ${entry.cityId}: "${named}" is not a level of the trait "${trait}" (${Object.keys(levels).join(', ')})`);
    resolved[trait] = { level: named, ...levels[named] };
  }
  return resolved;
}

/** The character shown to the player: the words of the traits that stand out, in the catalog's order. @param {object} entry @returns {string[]} */
export function characterWordsOf(entry) {
  return Object.values(personalityOf(entry)).map((level) => level.word).filter((word) => word !== null);
}

/**
 * @param {string} cityId
 * @returns {TradeCatalogEntry | null}
 */
export function getTradeCatalogEntry(cityId) {
  return TRADE_CATALOG.find((e) => e.cityId === cityId) ?? null;
}

/**
 * Every good a trade city sells to Anoria.
 * @returns {string[]}
 */
export function listImportedGoods() {
  return [...new Set(TRADE_CATALOG.flatMap((entry) => entry.offers.map((offer) => offer.good)))];
}

/**
 * Every good that crosses a border, with the flows it takes: exported (a city `wants` it) and/or imported (a city
 * `offers` it). One row per good, in the order the catalog first names it.
 * @returns {Array<{ good: string, flows: Array<'import' | 'export'> }>}
 */
export function listTradedGoods() {
  /** @type {Map<string, Set<'import' | 'export'>>} */
  const flowsByGood = new Map();
  const note = (good, flow) => flowsByGood.set(good, (flowsByGood.get(good) ?? new Set()).add(flow));
  for (const entry of TRADE_CATALOG) {
    for (const want of entry.wants) note(want.good, 'export');
    for (const offer of entry.offers) note(offer.good, 'import');
  }
  return [...flowsByGood].map(([good, flows]) => ({ good, flows: ['import', 'export'].filter((flow) => flows.has(flow)) }));
}

/**
 * All city ids that have a trade catalog entry.
 * @returns {string[]}
 */
export function listTradePartnerIds() {
  return TRADE_CATALOG.map((e) => e.cityId);
}

/**
 * Transport per unit of one delivery. The volume tier is read from the delivery's size (units): the largest tier whose
 * `from` is reached applies, none below the first.
 * @param {{ cityId: string, good: string, quantity: number, weight: number }} delivery weight = the good's transportWeight
 * @returns {number} the per-unit transport charge, unrounded
 */
export function transportPerUnit({ cityId, quantity, weight }) {
  const entry = getTradeCatalogEntry(cityId);
  if (!entry) throw new Error(`[trade] "${cityId}" is not in the trade catalog`);
  const mode = TRADE_IMPORT.transportModes[entry.transport.mode];
  if (!mode) throw new Error(`[trade] ${cityId} ships by "${entry.transport.mode}", which TRADE_IMPORT.transportModes does not declare`);
  const tier = [...TRADE_IMPORT.volumeTiers].reverse().find((candidate) => quantity >= candidate.from);
  return mode.basePrice * entry.transport.distanceMultiplier * weight * (1 - (tier?.discount ?? 0));
}

/**
 * The world market (docs/gameplay/PLAN_CRISES.md): outside Anoria every traded good has a world price, an index around 1 that drifts month by month. It pulls back to its target
 * by `reversion` of the gap each month and is shaken by `volatility`; a crop's target is the price a world harvest sets (a poor world year makes it dearer: the target is
 * 1 / the world's harvest factor, to the power `cropCoupling`). The index multiplies the price of every import and of every export, so a city that trades with the world feels its
 * market, and one that does not trade does not. It never leaves [`floor`, `cap`]. First values, to tune by playing.
 */
export const WORLD_MARKET = Object.freeze({ reversion: 0.15, volatility: 0.04, floor: 0.4, cap: 3, cropCoupling: 0.8 });

/**
 * Every good that crosses a border, imported or exported.
 * @returns {string[]}
 */
export function listTradedGoodIds() {
  return listTradedGoods().map((entry) => entry.good);
}
