# Calendrier des cultures : ce qui doit rester concordant

Chaque culture a son propre calendrier (comme dans le monde réel), et chaque acteur de la chaîne a le sien : le champ récolte, le grenier achète, le marché se réapprovisionne, les maisons mangent.
Rien dans le moteur ne force ces calendriers à s'accorder : **la concordance est une décision de catalogue**, tenue par des durées de conservation bien choisies. Ce document dit ce qui doit rester vrai
quand on change une date, une durée ou un multiplicateur.

## Où chaque chose est déclarée

| Quoi | Où | Lu par |
|---|---|---|
| Saison de récolte d'une culture | `producer.schedule` (`buildingEconomy.js`) | `ProduceResource` |
| Mois de vente d'une culture à son entrepôt | `producer.sale` (`HARVEST_SALE`, `CABBAGE_SALE`, `OLIVE_SALE`) | `CollectResourceToHub`, `ResetSourcesCollectedFlag` |
| Mois de collecte du grenier | **non déclarés** : dérivés des fenêtres de vente de ses producteurs (`getCollectionSchedule`, `ResourceRolePolicy.js`) | `RunHubSurplusCycle`, `CollectResourceToHub`, `MarkHubCollectingSchedule`, `GetHubStorageInfoView` |
| Durée de conservation d'un bien (mois) | `ResourceCategoryCatalog.js` | `StockAgingPolicy` |
| Multiplicateur de conservation d'un lieu | `shelfLifeFactor` sur son rôle `hub` (grenier : ×4) ; absent partout ailleurs = ×1 | `RunMonthlyResourceCycle` (`#ageStocks`) |
| Rythme d'achat du marché | `distributor.schedule` = `always`, plafond `maxStock` 240 pour la nourriture | `DistributeResourceToConsumers` |

## Les règles du moteur qui comptent

1. **Une unité garde son âge de bout en bout.** Elle naît au tick qui la voit après la récolte (un jour après le début de sa saison) et garde cet âge quand le grenier l'achète ou que le marché la prend (`movedAgeBooks`).
   Seule change la durée de vie, qui est celle du **lieu où elle se trouve** : la durée du bien, multipliée par le facteur du lieu. Le grenier n'allonge donc pas la vie *à partir de son achat* : il allonge la vie *totale depuis la récolte*.
2. **Une unité périmée est perdue au tick où `âge ≥ durée de vie`** (`expireAges`), avant la collecte du même tick.
3. **Le marché garde ses stocks ×1** (blé 6 mois, carotte 3, chou 2). Il ne doit jamais tenir de quoi vivre plusieurs mois : il se réapprovisionne chaque tick auprès du grenier, dans la limite de son plafond.
4. **Le grenier collecte les mois où au moins une de ses cultures se vend**, et seulement ceux-là. Une culture vendue un mois que le grenier ne collecte pas ne serait jamais achetée, sans erreur.

## Le parti pris : la péremption est du gameplay

Comme dans le monde réel, les légumes se gardent moins bien que le blé. Ce n'est pas un défaut à corriger dans le catalogue : c'est ce que le joueur doit apprendre à gérer. Trop de choux pour peu de blé, c'est
un risque d'avarie ; une ferme qui vend plus tard, à un prix plus bas, vend une denrée qui a vieilli. **Rendre une denrée invendable n'est pas un bug. Le défaut, c'est de rendre le jeu injouable**
(une culture qui ne pourrait jamais être vendue à temps avec le calendrier que le catalogue lui donne par défaut) **ou de ne pas dire au joueur ce qui l'attend.**

Ce que le jeu doit donc faire :

- **Prévenir.** L'onglet « Équilibre » du panneau d'approvisionnement montre, pour chaque besoin, le calendrier de chaque culture saisonnière (récolte, vente, durée de conservation au champ et au grenier),
  les mois de l'année où elle n'est plus en stock avant l'achat suivant, et celle qui se garde le moins bien. Tout est lu au catalogue, rien n'est écrit à la main.
- **Rester jouable par défaut.** Gardé par `tests/contexts/supply/cropCalendar.regression.test.js` : avec son calendrier par défaut, chaque culture est vendue avant de périr au champ, et le grenier collecte
  chaque mois où l'une de ses cultures se vend. C'est ce qu'ont violé le chou (2 mois, vendu en décembre) puis l'olive (1 mois, vendue en décembre).
- **Ne pas s'interdire les mois sans stock.** Une culture qui ne dure pas jusqu'à l'achat suivant (la carotte : 3 mois sans stock, le chou : 5) est assumée : le joueur le voit, et le blé, qui dure, couvre l'année.
- **Les quantités** ne se lisent pas ici : c'est l'onglet « Équilibre » qui compare la production théorique au besoin et dit ce qui a été collecté, perdu et vendu.

## L'état du catalogue (jours par mois : 5, automne = septembre à novembre)

| Culture | Récolte | Vente | Se garde (champ, marché) | Se garde au grenier (×4) | Marge au champ | Mois sans stock au grenier |
|---|---|---|---|---|---|---|
| Blé | automne (sept.) | décembre | 6 mois | 24 mois | large | 0 |
| Carotte | automne (sept.) | décembre | 3 mois | 12 mois | **1 jour** (vendue le 1er décembre, périmée le 2) | 3 (sept. → déc.) |
| Chou | automne (sept.) | octobre | 2 mois | 8 mois | 5 jours | 5 (mai → oct.) |
| Olive | automne (sept.) | septembre | 1 mois | 2 mois (entrepôt ×2) | 6 jours | sans objet (n'est pas mangée) |

Vérifié dans une partie : 216 carottes du grenier se sont avariées en septembre de l'année 1 (tour 101), douze mois après la récolte de l'année 0, trois mois avant l'achat de décembre.

## Constat sur une partie : où part la nourriture (année 1, prefab)

Le grenier a acheté 1 152 unités (blé 576, carotte 576). Les maisons en ont reçu **756** (blé 451, carotte 305). **394 se sont perdues** (carotte au grenier 216, carotte au marché 63, blé au marché 115) : à peu près tout le reste du stock.
Le besoin au pic était de 936 : le stock suffisait. Les 18 habitants non nourris en fin d'année étaient **tous en disette** (leur maison ne pouvait pas payer, 0 unité en pénurie) alors que le marché tenait de la nourriture.

L'ordre de service explique la perte de carottes, pas la faim :

- Le grenier sert le marché en partageant la demande **à parts égales entre les cultures disponibles** (`fairShares`, `TransferHubToHub`), sans regarder laquelle va périr la première : la carotte (12 mois depuis sa récolte) est tirée au même rythme que le blé (24 mois) et le surplus de carottes expire.
- Le marché sert les maisons chacune à son tour, culture après culture, en sautant ce qu'une maison n'a pas les moyens de payer (`distributeRoundRobin`) : c'est là que naît la disette.

## Le coût du marché (mesuré, à relire avant de changer sa cadence)

Le marché se réapprovisionne à chaque tick (`distributor.schedule = always`, plafond 240 de nourriture, ×1 de conservation). Mesure sur le prefab, banc `fake-indexeddb` (les proportions comptent,
pas les temps absolus), 161 ms par jour pour tout le cycle d'approvisionnement : les achats du marché (`RunCityResourceCycle`) 20 %, dont la distribution aux maisons 9 %, la production 27 %, la collecte du grenier 7 %,
la consommation 7 %, le reste (vieillissement, états, enregistrement) environ 39 %. Passer à un achat moins fréquent ne gagnerait donc qu'une fraction de ces 20 % (de l'ordre de 2 à 3 % d'un jour de jeu),
au prix d'un stock plus gros au marché, qui s'avarie ×1. À faire pour le gameplay (un marché qui s'approvisionne puis revend), pas pour la performance.
Pour changer la cadence : le calendrier de distribution du marché est lu avec un contexte qui n'a ni `dayInMonth` ni saison (`RunCityResourceCycle`), il faudrait l'y ajouter.

## Quand on ajoute une culture

1. Déclarer sa saison de récolte et sa fenêtre de vente (`sale`) sur le producteur.
2. Vérifier que la vente s'ouvre avant la péremption au champ (le test le dit).
3. Regarder, dans l'onglet « Équilibre », les mois sans stock qu'elle laisse au grenier : c'est une conséquence de jeu que le joueur doit pouvoir lire, pas une erreur.
4. Ne rien déclarer sur le grenier : ses mois de collecte suivent les fenêtres de vente.
