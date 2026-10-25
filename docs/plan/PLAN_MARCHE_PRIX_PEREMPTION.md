# Plan : moderniser l'achat du marché (prix selon la péremption, budget, demande en chaîne)

Statut : étapes 1 et 2 codées (sauf le plafond de trésorerie), voir « Avancement » en bas.

## Pourquoi

Constat sur une partie (voir `docs/gameplay/CALENDRIER_DES_CULTURES.md`, « Constat sur une partie ») : sur 1 152 unités de nourriture en stock, 756 ont été livrées aux maisons et 394 se sont perdues, alors que 18 habitants
étaient en disette (ils ne pouvaient pas payer). Deux règles y concourent :

- le grenier sert le marché en partageant la demande **à parts égales entre les cultures** (`fairShares`, `TransferHubToHub`), sans regarder ce qui va périr ;
- le prix d'une unité ne dépend **pas** de sa fraîcheur : une carotte qui périt demain coûte le prix d'une carotte fraîche (`PriceBook`, coût + marge d'étage, calculé par mois).

Dans la vie réelle, on solde ce qui va périr, l'acheteur répartit son budget, et le producteur d'une denrée périssable la vend moins cher parce qu'il porte le risque d'invendu.

## Ce qui existe déjà et qu'on réutilise

| Brique | Où | Ce qu'elle apporte |
|---|---|---|
| Âge de chaque lot | `stockAges` : `[naissance, quantité]` par bien et par lieu (`StockAgingPolicy`) | on connaît la durée de vie restante de chaque lot (`remainingLifeOf`) |
| Durée de vie d'un lieu | durée du bien × `shelfLifeFactor` du lieu | le prix peut dépendre de la vie restante **dans ce lieu** |
| Prix | `PriceBook.sellingPrice(building, category, period)` : coût + marge (`MARGIN_BY_STAGE`) | un seul endroit où ajouter la fraîcheur |
| Argent des maisons | `distributeRoundRobin` : une maison ne prend une unité que si elle peut la payer | le « moins cher d'abord » se fait presque tout seul |
| Trace des transferts | `recordHubToDistributorTransfers`, `recordDistributorToConsumerTransfers` : chaque transfert est tracé à **son prix** par unité | un prix par lot est déjà compatible avec le règlement et la compaction mensuelle (sommes de montants) |
| Ordre de service du grenier | `HubServing.availableTo` + priorités des clients | l'allocation entre marchés existe |

## Le modèle proposé

1. **Le prix suit la fraîcheur.** Le prix d'une unité = prix de base × facteur de fraîcheur, calculé **par lot** d'après sa vie restante dans son lieu. Le facteur est une courbe déclarée au catalogue (pleine valeur tant qu'il
   reste plus de X % de vie, puis décroissante jusqu'à un plancher à la péremption). Un lot qui va périr se solde : il est moins cher, donc acheté en plus grande quantité par les budgets limités.
2. **L'achat du marché est budgété et réparti.** Le marché ne prend plus « sa demande à parts égales ». Il a, par besoin, un **budget d'achat plafonné** et des **parts de dépense** par bien (le panier). Pour chaque bien :
   quantité = part du budget ÷ prix du lot. À part de dépense égale, **le moins cher s'achète en plus grande quantité** : mécaniquement, ce qui va périr (soldé) sort le premier.
3. **Le producteur et le grenier portent le risque.** Le prix de vente d'un producteur et d'un grenier est diminué d'un risque d'invendu qui croît avec la périssabilité (durée de conservation courte face à l'intervalle entre ses ventes).
   Une culture qui se garde mal rapporte moins, donc le joueur arbitre (peu de chou, plus de blé) sans qu'aucune règle ne l'interdise.
4. **La demande remonte la chaîne.** Les maisons expriment un besoin par bien (leur panier), le marché en déduit son stock cible par bien et commande au grenier, le grenier tient compte des commandes des marchés
   (`HubServing`) pour ses achats auprès des fermes. Chaque étage ne tire que ce que l'étage aval a demandé.

## Ce que ça change

**Catalogue** (déclaratif, aucune règle écrite dans le code) :
- une courbe de fraîcheur (par bien, avec une valeur par défaut) ;
- un panier par besoin et par type de maison : la part de chaque bien (voir la décision 1) ;
- un budget d'achat du marché par besoin (voir la décision 2) ;
- un coefficient de risque d'invendu côté producteur et côté grenier.

**Code** :
- `PriceBook` : prix par lot et par lieu (aujourd'hui un prix par bâtiment, bien et mois) ;
- `RoundRobinDistribution` : les maisons achètent lot par lot, du moins cher au plus cher dans leur panier ;
- `TransferHubToHub` : le partage à parts égales (`fairShares`) est remplacé par l'achat budgété ;
- les traces : un transfert est déjà tracé à son prix unitaire, il faudra un prix par lot (plusieurs lignes d'un même transfert).

**Comptabilité** (le journal reste la seule trace de valeur) : un marché qui solde vend parfois **sous son coût**, un producteur qui vend moins cher encaisse moins. Rien de nouveau dans les comptes : ce sont des ventes à un autre prix,
mais le règlement mensuel, les stocks valorisés au coût (`stockUnitCost`) et l'équilibre économique des maisons (salaires, loyers) devront être revus sur une partie complète : **un prix plus bas pour les producteurs
change leurs bénéfices, donc leurs salaires et leur survie**.

## Les étapes, de la plus petite à la plus grande

| Étape | Contenu | Effet visible | Risque |
|---|---|---|---|
| 1. Prix de fraîcheur à la vente aux maisons | courbe au catalogue, prix par lot, les maisons achètent le moins cher d'abord | moins de pertes au marché ; des maisons pauvres peuvent acheter les lots soldés (moins de disette) | faible : un seul étage, pas de budget |
| 2. Achat budgété du marché auprès du grenier | budget par besoin, parts de dépense, fin de `fairShares` | le grenier est vidé du plus périssable au moins périssable ; les lots proches de la péremption partent d'abord | moyen : touche la chaîne grenier → marché et les marges des étages |
| 3. La demande remonte | paniers par type de maison, stock cible du marché, commandes au grenier | un grenier qui n'achète que ce qui sera demandé | plus gros : nouvelle donnée au catalogue, nouvelle logique de commande |
| 4. Le risque d'invendu aux producteurs | décote de prix selon la périssabilité | le joueur arbitre entre cultures sans interdiction | économie : à équilibrer sur une partie complète |
| 5. Le joueur voit tout | le panneau d'approvisionnement montre prix, soldes, budgets, paniers | pas de règle cachée | faible |

Chaque étape est livrable et mesurable seule. L'étape 1 apporte déjà l'essentiel de ce que tu décris pour le marché (le solde), sans toucher au budget ni à la remontée de la demande.

## Ce que ce modèle ne fait pas

Ce n'est qu'une partie de la vie réelle. Le prix y suit **le coût et la fraîcheur**, pas la **rareté** : un bien qui manque ne renchérit pas, un excédent ne s'effondre pas. Faire jouer l'offre et la demande sur le prix
est une étape de plus, séparée, qu'on peut ajouter après (même point d'entrée : `PriceBook`).

## Décisions prises

1. **Le panier est en pourcentage du besoin** par bien (par exemple 50 % blé, 30 % carotte, 20 % chou), pas en quantité : il suit la population. Pas de plancher en quantité : le besoin total reste fixé par le catalogue
   (la consommation par habitant), le panier ne fait que le répartir.
2. **Le budget du marché suit son objectif de vente, borné par sa trésorerie.** Il achète pour atteindre l'objectif que lui donne son objectif de vente (ce que ses maisons lui demandent), mais ne peut pas dépasser ce que sa
   trésorerie permet : un marché en déficit n'atteint pas toujours son objectif.
3. **La courbe de fraîcheur** : linéaire sur la dernière moitié de la vie d'un lot, plancher à 40 % du prix à la péremption, déclarée par bien avec une valeur par défaut (`ResourceCategoryCatalog.js`).
4. **Le risque d'invendu des producteurs** est dérivé de la durée de conservation, pas déclaré à part.

## Avancement

- **Étape 1 : faite** (prix de fraîcheur à la vente aux maisons).
  - La courbe est au catalogue (`ResourceCategoryCatalog.js`, `getFreshnessPriceCurve`) : prix plein tant qu'il reste plus de la moitié de la vie, puis ligne droite jusqu'à 40 % du prix à la péremption.
  - Le prix d'une unité est calculé par lot (`FreshnessPricePolicy.js`) : les unités d'un stock se vendent de la plus vieille à la plus récente, donc de la moins chère à la plus chère.
  - `distributeRoundRobin` demande le prix de la n-ième unité et la maison ne la prend que si elle peut la payer ; chaque transfert porte le prix payé (`unitPrice`).
  - La trace d'une livraison garde ce prix. La comptabilité écrit une seule ligne par maison, vendeur, bien et tour (sa clé d'idempotence) : les unités d'une maison à des prix différents sont donc regroupées
    en un achat au prix moyen payé (`DeliveryPurchasePolicy.js`), au centime près.
  - Un service (l'eau) garde son prix : il ne se périme pas.
  - La règle « durée de vie d'un bien dans un lieu » est maintenant unique (`shelfLifeTurnsAt`) : le vieillissement des stocks et le prix la lisent tous les deux.
  - Vérifié sur le prefab (12 jours, vraie comptabilité) : les prix payés montrent les planchers (carotte 0,43 pour 1,08, blé 0,58 pour 1,44, chou 0,36 pour 0,90).
  - À jouer et à régler : les valeurs de la courbe sont des premières valeurs ; le panneau d'approvisionnement n'affiche pas encore ces prix (étape 5).
- **Étape 2 : faite** (achat du marché auprès du grenier réparti par dépense, borné par le crédit fournisseur).
  - `fairShares` (parts égales en unités) ne répartit plus l'achat du marché : `shareByExpenditure` (`ExpenditureSharePolicy.js`) achète chaque unité au bien dont la dépense est la plus faible jusqu'ici. À dépense égale,
    le bien le moins cher (le plus soldé) est acheté en plus grande quantité. Les parts sont égales pour l'instant ; le panier en % par besoin (étape 3) les remplacera.
  - Le prix de chaque unité est celui du grenier, par fraîcheur (`FreshUnitPricer.js`, extrait de la distribution aux maisons pour que les deux étages partagent la même règle). Chaque transfert grenier → marché porte
    le prix moyen payé par unité (`unitPrice`), et la trace l'enregistre à ce prix ; elle lève une erreur si le prix manque.
  - Le service du grenier (`HubServing.availableTo`, priorités des clients, lots par provenance) et les âges des lots (`movedAgeBooks`) sont inchangés.
  - **Le plafond d'achat est le crédit fournisseur** (décision 2), pas la caisse. Mesure sur le prefab au tour 107 : le marché a ≈ 31 € en caisse, le grenier −1 076 €, l'entrepôt −1 812 € : un plafond strict sur
    la caisse l'aurait affamé (pas d'argent, donc pas d'achat, donc pas de vente). Comme dans la vie réelle, le marché achète à crédit et paie en fin de mois (le règlement existant) :
    pouvoir d'achat = caisse (négative si découvert) + `SUPPLIER_CREDIT_MONTHS` (1) mois de ses ventes du mois précédent − ses achats du mois pas encore réglés (`SupplierCreditPolicy.js`, `ValueChainCatalog.js`).
    Un marché lourdement endetté achète moins que son objectif et n'achète plus rien tant que ses ventes n'ont pas ramené d'argent. Le grenier n'a pas de plafond pour l'instant.
  - **Fonds de roulement** (constat sur une partie : le grenier avait acheté 4 804 € de récolte, en revendu 1 176 €, et sa caisse était à −3 628 €, un stock financé à découvert). Le capital de départ d'une entreprise qui porte un stock
    ajoute `WORKING_CAPITAL_STOCK_SHARE` (0,5) de la valeur de son stock plein au coût d'ouverture (`stockValueAtCapacity`, `ValueChainCatalog.js`) à ses 2 mois de charges (`foundingCapitalOf`). Les fermes n'en reçoivent pas.
    Le prefab est corrigé directement : les lignes de capital de Moulin/grenier (+1 094 €), entrepôt commercial (+1 733 €), entrepôt (+1 797 €) et marché (+919 €) sont relevées dans les deux fichiers de journal.
    Cet argent vient de la ville, déjà à découvert : sa trésorerie baisse d'autant (≈ 5 540 €), c'est le miroir du découvert des entreprises.
  - **Le grenier achète aussi sous plafond** (`CollectResourceToHub`, même règle que le marché) : sa ligne de crédit est ce qu'il a vendu sur les `SUPPLIER_CREDIT_MONTHS_BY_STAGE` derniers mois (grenier : 12, marché : 1), car il achète une récolte d'un coup
    et la revend sur l'année. Une récolte que le grenier ne peut pas payer reste aux fermes (raison `no_budget`) : c'est le risque d'invendu que portent les fermes (étape 4). À surveiller en jouant : des fermes qui gardent leur récolte.
- **Étape 4 : faite, option A** (le risque d'invendu est porté par le vendeur, dans son prix).
  - Tout vendeur d'un bien (ferme, grenier, marché) retire à son prix la part `unsoldRiskDiscount(durée de conservation chez lui)` (`ResourceCategoryCatalog.js` ; `PriceBook.sellingPrice`) : 20 % au plus pour un stock qui ne se garde pas,
    en ligne droite jusqu'à 0 pour un stock qui se garde un an ou plus. La durée est celle du lieu (`shelfLifeMonthsAt`, durée du bien × facteur du lieu) : le grenier (×4) ne porte presque rien, une ferme de chou beaucoup.
    Rien n'est déclaré par bien. Un stock reste valorisé au coût (`stockUnitCost`), pas à ce prix. Les services n'ont pas de risque.
  - Effet sur les marges (coût + marge de l'étage, puis la décote) : ferme de blé +8 %, de carotte +2 %, de chou 0 % ; grenier : blé et carotte +20 %, chou +12 % ; marché : blé +12,5 %, carotte +6 %, chou +4 %.
    Le marché garde donc peu de marge sur les légumes, et vend en plus ses unités vieilles moins cher (étape 1) : c'est voulu (le joueur voit qu'un légume périssable rapporte peu), mais c'est la première chose à regarder en jouant.
  - Premières valeurs (horizon 12 mois, 20 %) à régler en jouant. Les ventes déjà tracées du prefab gardent leurs prix.
  - **L'entrepôt commercial n'est pas plafonné** (`unlimitedSupplierCredit` sur son rôle `hub`, `buildingEconomy.js`). Il achète les accords des marchands et les importations pour les passer à l'étranger : ses ventes ne sont pas dans les ventes du journal,
    donc un crédit calculé sur elles valait presque zéro et le bloquait (les marchands ne pouvaient plus lui vendre leur charbon d'échange). La réalité économique de cet étage reste à discuter.
  - Une récolte qu'aucun entrepôt à portée ne peut payer a pour cause `hub_no_money` (affichée dans le panneau admin) ; le contrôle strict des ventes manquées (`MarkFailedSales`) la connaît.
