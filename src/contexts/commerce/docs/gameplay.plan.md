# Plan gameplay — Commerce (bounded context)

Référence UX : flux **César III** (carte de l’Empire + Conseiller commercial), avec des règles métier **plus souples** qu’en César III et une **séparation stricte** commerce / économie interne.

Document de conception — les policies listées ici sont la cible ; l’implémentation actuelle (moulin, 9 partenaires, nourriture…) est en transition.

---

## 1. Principes directeurs

| Principe | Description |
|----------|-------------|
| **Deux flux distincts** | L’économie interne (fermes → moulin → marchés → maisons) et le commerce externe (factory → barn → caravane → partenaire) ne partagent **pas** le même stock. |
| **Hub commerce = Barn** | Seule la **grange commerce** (`Barn-001` dédiée) stocke les denrées importées/exportées. Le moulin n’est plus hub commerce. |
| **Prix fixés par la ville partenaire** | Le joueur n’ajuste pas les prix ; il ouvre des routes et active/désactive import/export par denrée. |
| **Routes permanentes** | Ouvrir une route coûte des deniers (une fois) ; la route reste ouverte. Les quotas se **réinitialisent chaque année**. |
| **Import ET export autorisés** | Contrairement à César III : une même denrée peut être importée **et** exportée au niveau ville — mais **pas dans les deux sens avec la même ville partenaire**. |

---

## 2. Différence clé avec César III — Policy `TradeDirectionPolicy`

### 2.1 César III (ce qu’on ne reproduit pas)

Pour chaque denrée, **un seul mode global** : pas d’échange, exporter **ou** importer — jamais les deux simultanément pour la même ressource.

### 2.2 Anoria — règles à trois niveaux

```
Niveau A — Ville joueur (par denrée)
  exportEnabled  : bool   // le joueur autorise les ventes externes
  importEnabled  : bool   // le joueur autorise les achats externes
  → Les deux peuvent être true en même temps (ex. relais bois entre deux partenaires, plus tard)

Niveau B — Ville partenaire (catalogue fixe)
  buysFromUs[]   : offres d’ACHAT chez nous  (= nos exports)
  sellsToUs[]    : offres de VENTE chez eux (= nos imports)
  INVARIANT : ∀ productId, productId ∉ buysFromUs ∩ sellsToUs

Niveau C — Exécution (par tick, par partenaire actif)
  Import  si : route ouverte ∧ importEnabled(product) ∧ product ∈ partner.sellsToUs ∧ mois ∧ quotas ∧ stock barn (export side N/A)
  Export  si : route ouverte ∧ exportEnabled(product) ∧ product ∈ partner.buysFromUs  ∧ mois ∧ quotas ∧ stock barn suffisant
```

### 2.3 Policy `validatePartnerCatalog(partner)`

**Doit échouer** (seed + migration + tests) si un `productId` apparaît à la fois dans `buysFromUs` et `sellsToUs` du même partenaire.

**Exemple valide — Olivea**

| Sens | Denrées |
|------|---------|
| Olivea **achète** chez nous | Bois, Meubles |
| Olivea **vend** chez nous | Figues |

**Exemple invalide**

| Sens | Denrées |
|------|---------|
| Olivea achète | Bois |
| Olivea vend | Bois ← **interdit** |

---

## 3. MVP — périmètre initial

### 3.1 Denrées échangeables

| ID | Nom | Rôle MVP |
|----|-----|----------|
| `wood` | Bois brut | Export (factory bucheron → barn) |
| `furniture` | Meubles | Export (factory menuisier → barn ; recette : 4 `logs` → 1 meuble) |
| `figs` | Figues | Import uniquement (achat chez partenaire → barn) |

**Hors MVP commerce** : blé, carotte, chou, dattes, nourriture en général.

### 3.2 Partenaires (2 villes)

| ID | Nom | `buysFromUs` (nos exports) | `sellsToUs` (nos imports) |
|----|-----|---------------------------|--------------------------|
| `olivea` | Olivea | Bois, Meubles | Figues |
| `silvania` | Silvania | Meubles | — |

*(Silvania peut rester export-only en MVP ; Olivea est le seul importeur de figues.)*

### 3.3 Chaîne industrielle MVP

```
[Bucheron / Factory wood] ──transfert──► [BARN commerce]
[Menuisier / Factory furniture] ──transfert──► [BARN commerce]
                                              ▲
                                    [Caravane A/R]
                                              │
                              [Route frontière physique]
                                              │
                                    [Ville partenaire]
```

---

## 4. Policies domaine (référence implémentation)

### 4.1 `PartnerRoutePolicy`

| Règle | Détail |
|-------|--------|
| Ouverture | Paiement unique `COMMERCIAL_ROUTE_FEE` (500 €) ; clé comptable idempotente par `partnerId`. |
| Persistance | `partner.routeOpen = true` (équivalent actuel `isActive`) — **ne se ferme pas** quand les quotas annuels sont atteints. |
| Prérequis ouverture | Population, chômage, barn construite *(conditions configurables par partenaire)*. |
| Prérequis exécution | Route ouverte **+** route **physique** sur la frontière *(phase ultérieure ; absent en MVP auto)*. |

### 4.2 `PartnerTradeLinePolicy`

Chaque ligne dans `buysFromUs` ou `sellsToUs` :

| Champ | Sémantique |
|-------|------------|
| `productId` | Denrée |
| `pricePerUnit` | Prix fixe partenaire (€ / unité) |
| `months[]` | Mois calendaires où l’échange est possible (0 = Jan … 11 = Déc) |
| `yearlyQuota` | Max d’unités par **année civile** pour **ce partenaire et cette denrée** (ex-César : traits rouges) |
| `currentYearly` | Compteur annuel ; reset au changement d’année |
| `maxPerTurn` | Plafond par passage caravane / tick (MVP : 1) |

**Policy `canTradeWithPartner(partner, productId, operation, monthIndex)`**

```
false si ¬partner.routeOpen
false si productId absent de la liste correspondante
false si monthIndex ∉ tradeLine.months
false si tradeLine.currentYearly ≥ tradeLine.yearlyQuota
true sinon
```

### 4.3 `CityTradeCapPolicy` (plafonds globaux ville)

Indépendants des quotas par partenaire — plafond **ville** par denrée et par an :

| Champ config | Sens |
|--------------|------|
| `sellingMax` | Total export annuel toutes routes confondues |
| `buyingMax` | Total import annuel toutes routes confondues |

**Policy `canImportProduct` / `canExportProduct`**

```
false si compteur annuel global + quantity > buyingMax / sellingMax
false si stock barn insuffisant (export)
true sinon (sous réserve toggles joueur)
```

### 4.4 `PlayerTradeTogglePolicy` (Conseiller commercial)

Config persistée par denrée (`commerce_trade_toggles` ou extension `commerce_config`) :

| Champ | Défaut MVP | Effet |
|-------|------------|-------|
| `exportEnabled` | `true` pour bois/meubles, `false` pour figues | Autorise les ventes vers tout partenaire qui achète cette denrée |
| `importEnabled` | `false` sauf figues | Autorise les achats chez tout partenaire qui vend cette denrée |
| `exportFromThreshold` | `0` | Ne pas exporter si stock barn ≤ seuil (réserve ville) |
| `industryActive` | `true` | Si `false`, désactive la/les lignes factory porteuses de la denrée |

**Policy `canExecuteTrade(operation, productId, playerConfig)`**

```
operation = import  → playerConfig.importEnabled[productId]
operation = export  → playerConfig.exportEnabled[productId]
                    ∧ barnStock[productId] > exportFromThreshold[productId]
```

### 4.5 `BarnStockPolicy`

| Règle | Détail |
|-------|--------|
| Hub unique commerce | Import crédite barn ; export débite barn. |
| Séparation interne | Le moulin / marchés **ne** voient **pas** le stock barn. |
| Capacité | Source : `BARN_UNITS_PER_WORKER` (10) et `BARN_MAX_TOTAL_CAPACITY` (60) ; max ouvriers et stock dérivés par calcul |
| Transfert factory → barn | Commande supply mensuelle : déplace `wood` / `furniture` de la factory vers la barn si capacité. |
| `HubStorageOrdersPolicy` | Ordres : **Accepter / Refuser / Amener** + plafond **%**. Espace libre **premier arrivé** si les plafonds se chevauchent (César III). |

### UI entrepôt (grange / moulin)

Modal info élargie (520×620) : grille emoji + quantités, camembert d’occupation réelle, bouton **Ordres** : mode (Accepter → Refuser → Amener) et plafond % (+/− de 10).
Persisté dans `hubStorageOrders` sur le bâtiment.

### 4.6 `CaravanVisitPolicy` *(phase caravane)*

Déclenchement d’une visite si **toutes** les conditions :

1. `PartnerRoutePolicy` — route ouverte  
2. Route physique frontière présente et connectée  
3. Barn active avec au moins un stockiste  
4. Au moins une denrée avec toggle import ou export ON et trade possible ce mois  
5. Intervalle écoulé depuis dernière visite (`CARAVAN_INTERVAL_TURNS`)

Comportement :

- Pathfinding visible aller-retour (personnage réutilisé).  
- À l’arrivée barn : exécution des trades possibles (import puis export, ou l’ordre défini en implémentation).  
- Si stock export insuffisant : la caravane repart sans vente (feedback UI — cf. entrepôt César « ils ne font que passer »).

### 4.7 `PartnerCatalogIntegrityPolicy`

Tests obligatoires :

- Aucun `productId` en double entre `buysFromUs` et `sellsToUs` d’un même partenaire.  
- Toute denrée référencée existe dans `ProductCatalog` commerce.  
- MVP : seulement `wood`, `furniture`, `figs`.  
- MVP : exactement **2** partenaires actifs dans le seed.

---

## 5. Interface — deux panneaux

### 5.1 Panneau 1 — Carte commerciale (`TradeMapPanel`)

**Layout MVP (CSS)** : ville joueur au centre, partenaires sur un cercle ; panneau bas dynamique.

**Contenu panneau bas (ville sélectionnée)** — style César III :

```
┌──────────────────────────────────────────────────┐
│  OLIVEA                                          │
│  Vendu :  🪵 Bois      3/25  [▓▓▓░░░░░░░]       │
│  Vendu :  🪑 Meubles   1/15  [▓░░░░░░░░░]       │
│  Acheté : 🍇 Figues    2/10  [▓▓░░░░░░░░]       │
│  [ 500 € pour ouvrir la route ]                  │
└──────────────────────────────────────────────────┘
```

| Élément | Règle |
|---------|-------|
| Barre de carrés | `yearlyQuota` cases ; remplissage = `currentYearly` ; **1 carré = `UNITS_PER_QUOTA_SQUARE` unités** (ex. 5 — à afficher en légende) |
| Compteurs | Persistants ; visibles au retour sur l’écran |
| Bouton route | Appelle `PartnerRoutePolicy.openRoute(partnerId)` |

**Plus tard** : vraie carte, ligne pointillée, icône charrette entre villes.

### 5.2 Panneau 2 — Conseiller commercial (`TradeAdvisorPanel`)

Liste simple (comme César III) :

| Denrée | Stock barn | Statut affiché |
|--------|------------|----------------|
| Bois | 24 | Exporté à partir de 10 |
| Meubles | 3 | Export actif |
| Figues | 5 | Import actif |

**Modal au clic sur une denrée** :

- Toggle **Exporter** (ON/OFF) — indépendant  
- Toggle **Importer** (ON/OFF) — indépendant  
- Seuil **Exporter à partir de** N unités  
- Bouton **Industrie ACTIVE** / INACTIVE (factory liée)  
- *(Optionnel V2)* Mode stockage : utiliser vs stocker uniquement  

Navigation : lien « Voir la carte » → Panneau 1 ; « Afficher les prix » → tableau prix fixes partenaires.

---

## 6. Comptabilité

| Événement | Écriture journal | Trésorerie |
|-----------|------------------|------------|
| Ouverture route | `commercial_route:{partnerId}` | −500 € |
| Import | `import_{productId}` | −(qty × pricePerUnit) |
| Export | `export_{productId}` | +(qty × pricePerUnit) |

Les montants utilisent `pricePerUnit` de la ligne partenaire (`PartnerTradeLinePolicy`).

---

## 7. Unités et quotas — convention d’affichage

| Terme | Signification |
|-------|---------------|
| **Unité** | 1 panier / lot échangé par passage caravane ou tick MVP |
| **Quota annuel (partenaire)** | Max unités/an pour une denrée **chez ce partenaire** |
| **Plafond global (ville)** | Max unités/an importées ou exportées **toutes routes** |
| **Carré de barre UI** | Représente `UNITS_PER_QUOTA_SQUARE` unités (proposition : **5**) |

Exemple : quota 25, carré = 5 → **5 carrés** ; 3 unités vendues → **0 carré plein + 3/5 du premier** ou arrondi UI au carré entier inférieur (détail présentation).

---

## 8. État actuel vs cible

| Composant | Aujourd’hui | Cible |
|-----------|-------------|-------|
| Hub stock | Moulin `commercializeEnabled` | Barn commerce |
| UI | Admin « routes commerciales » | Panneau 1 + 2 in-game |
| Partenaires | 9 villes, 5 denrées | 2 villes, 3 denrées MVP |
| Toggles joueur | Aucun (auto si route ouverte) | `PlayerTradeTogglePolicy` |
| Route physique | Non | Frontière + caravane |
| XOR import/export global | N/A | **Non** — import ET export autorisés |
| XOR par partenaire/denrée | Implicite dans seed | `PartnerCatalogIntegrityPolicy` explicite |

---

## 9. Roadmap d’implémentation

| Phase | Livrable | Jouable |
|-------|----------|---------|
| **0** | Seed MVP : 2 partenaires, `wood` / `furniture` / `figs` ; retirer nourriture du commerce | Config |
| **1** | Panneau 1 (cercle CSS + panneau bas + barres quota) | Lecture + ouvrir route |
| **2** | `BarnStockPolicy` + transfert factory → barn ; simulation depuis barn | Trade auto mensuel |
| **3** | Panneau 2 + `PlayerTradeTogglePolicy` + industrie ACTIVE | Contrôle joueur |
| **4** | Route frontière physique (`PartnerRoutePolicy` exécution) | Prérequis spatial |
| **5** | `CaravanVisitPolicy` + pathfinding | Feedback visuel |
| **6** | Carte réelle + ligne de route | Polish |

---

## 10. Fichiers code cibles (indicatif)

| Policy / query | Emplacement prévu |
|----------------|-------------------|
| `validatePartnerCatalog` | `domain/policies/PartnerCatalogIntegrityPolicy.js` |
| `canTradeWithPartner`, `getPartnerTradePrice` | `domain/policies/PartnerTradePolicy.js` *(existe)* |
| `canImportProduct`, `canExportProduct` | `domain/policies/ProductTradePolicy.js` *(existe)* |
| `PlayerTradeTogglePolicy` | `domain/policies/PlayerTradeTogglePolicy.js` *(à créer)* |
| `BarnStockOperations` | `application/services/BarnStockOperations.js` *(remplace windmill pour trade)* |
| `GetTradeMapView` | `application/queries/GetTradeMapView.js` |
| `GetTradeAdvisorView` | `application/queries/GetTradeAdvisorView.js` |
| UI Panneau 1 / 2 | `presentation/dom/commerce/` |

---

## 12. Flux factory dédiés (ville vs commerce)

### 12.1 Principe

| Règle | Détail |
|-------|--------|
| **Un bâtiment = un flux** | Chaque `Winery-001` est dédiée soit au **commerce**, soit à la **ville**. Deux usines minimum pour faire les deux en parallèle. |
| **Hubs séparés** | Ville → moulin / marchés ; commerce → grange (`Barn-001`). |
| **Lignes autorisées** | Commerce MVP : collecte `wood`, fabrication `furniture`. Ville : toutes les lignes actuelles. |

### 12.2 Policies supply

| Policy | Rôle |
|--------|------|
| `FactorySupplyFlowPolicy` | `supplyFlow: 'city' \| 'commerce'` ; filtre collecte / transform / production par bâtiment. |
| `ProductRecipeCatalog` | Catalogue canonique des biens usine : `kind`, `lineDestinations`, stock, ouvriers, recettes. |
| `FactoryLineAllocationPolicy` | Par matière première : caps **vente directe** vs **fabrication**. Les `lineDestinations` du catalogue déterminent les lignes disponibles. |
| `FactoryProductWorkerDistributionPolicy` | Besoin ouvriers/ligne dérivé des caps ; besoin total usine (max 18) ; répartition des ouvriers ville par demande. |
| `FactoryCommodityProductionPolicy` | Toggle **production active** par usine et par bien (style César III) — indépendant du split direct/fabrication. Désactivé ⇒ 0 ouvrier, libération MO. |

**Activation par bien**

Chaque matière première / produit fini a une case **Production active** (persistée dans `commodityProductionEnabled`).  
Les caps direct / fabrication restent un vase communicant entre destinations **du même bien actif** — mettre un cap à 0 ne désactive plus la ligne.

**Frontières BC (emploi ↔ supply)**

| Étape | Owner | Effet emploi |
|-------|-------|--------------|
| `supply.syncFactoryWorkerDemand` | Supply | Met à jour `employees.worker_need` depuis les caps → alimente `totalNeed`, `lack`, `understaffedBuildingIds` |
| `employment.redistribute` | Employment | Alloue le pool ville par priorité secteur (Winery = secteur 3) |
| `supply.allocateFactoryWorkers` | Supply | Répartit `employees.worker` sur `productWorkerDistribution` (production, pas emploi ville) |
| `applyFactoryLineCapChanges` (composition) | Composition | Enchaîne les 3 étapes après edit caps admin |

Chômage : `unemployed = laborPool − totalAssigned` (via `computePopulationBreakdown`) — si caps baissent le besoin usine, moins de MO requis → chômage peut baisser après redistribution.

**Exemple commerce — bois (caps joueur, vase communicant)**

```
Capacité ligne bois = 10
  ├─ max direct = 6  → transfert grange (TransferFactoryToBarn)
  └─ max fabrication = 4  → transform → bûches → meubles
```

Sans caps configurés : défaut = 100 % direct (bois brut vers grange, sans menuiserie).

### 12.3 Fichiers

| Fichier | Emplacement |
|---------|-------------|
| `SupplyFlow.js` | `supply/domain/manufacturing/` |
| `FactorySupplyFlowPolicy.js` | `supply/domain/manufacturing/` |
| `ProductRecipeCatalog.js` | `supply/domain/manufacturing/` |
| `FactoryLineAllocationPolicy.js` | `supply/domain/manufacturing/` |

### 12.4 Roadmap (suite)

| Phase | Livrable |
|-------|----------|
| **A** ✅ | Policies + factory filtrée par flux + UI admin |
| **B** ✅ | `BarnStockPolicy` + transfert mensuel factory commerce → grange + hub commerce |
| **C** | Usine ville + consommation interne (hors commerce) |

---

## 11. Références

- Captures César III : voir `docs/assets/` *(gitignored — copies locales)*.  
- Simplification récente : routes permanentes, prix partenaire, quotas annuels (`feature/gameplay-salaries`).  
- Supply factory : `ProductRecipeCatalog.js` — catalogue unique (`FACTORY_COMMODITIES`).  
- Accounting : `import_*`, `export_*`, `commercial_route` dans le README accounting.
