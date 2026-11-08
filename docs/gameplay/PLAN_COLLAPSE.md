# Plan — la solidité des bâtiments et l'effondrement

Décidé avec le joueur le 2026-11-08. Pas encore construit.

## Pourquoi

L'entretien d'un bâtiment est aujourd'hui un simple coût : un État à sec ne paie pas l'entretien de ses bâtiments et n'en subit rien (limite notée dans
`PLAN_BANK_MONEY.md`, point 9). Un bâtiment qu'on n'entretient pas doit s'user, puis s'effondrer, et tuer.

## Décisions du joueur

1. **Qui a une barre de solidité** : tous les bâtiments sauf les routes (maisons, entreprises, bâtiments publics). Les routes et la nature n'en ont pas.
2. **L'effondrement** démolit le bâtiment par le chemin existant de la démolition/liquidation (`BulldozeBuildingAtTile` : une entreprise est liquidée, une maison est
   vidée), puis la place est libre. Pas de ruine à déblayer.
3. **Les victimes** sont les personnes présentes : les travailleurs d'un lieu de travail, les habitants d'une maison. Chaque mort est comptée sous une nouvelle cause
   `accident` dans le décompte des morts (`DEATH_CAUSES`, `gameplayMortalityState.js`) : c'est la première ligne de ce qui servira à tous les accidents, et elle compte
   pour la fin de partie comme les autres.
4. **L'entretien** : chaque mois le bâtiment perd de la solidité ; l'entretien payé ce mois-là annule la perte (pas de réparation au-delà). Un entretien qui n'est pas
   payé, y compris celui de l'État quand son Trésor est vide, laisse la perte. Cela remplace la limite « l'entretien de l'État est perdu sans conséquence ».
5. **Le signal** : un sprite d'alerte sur le bâtiment quand la solidité passe sous un seuil proche de 0, quelques mois avant le risque. La barre se lit dans un onglet
   « État » ; les maisons n'en ont pas encore, elles en reçoivent un.

## Le modèle

- **Donnée** : `solidity` sur la ligne de chaque bâtiment (0 à 100, 100 à la construction). Lecture stricte : un bâtiment sans solidité lève une erreur, pas de valeur
  par défaut. Le prefab `anoria-tour-107` est corrigé directement dans son JSON (règle de CLAUDE.md), pas par migration.
- **Catalogue** `SolidityCatalog` (chiffres de départ, à régler en jouant) :
  - `MONTHLY_WEAR = 4` points par mois (25 mois d'abandon pour aller de 100 à 0) ;
  - `WARNING_BELOW = 25` : le sprite apparaît (environ 3 mois avant que le risque commence) ;
  - `RISK_BELOW = 15` : le risque d'effondrement commence ;
  - `MAX_MONTHLY_COLLAPSE_CHANCE = 0.5` : la chance mensuelle à 0 de solidité, linéaire entre `RISK_BELOW` et 0 ;
  - `CASUALTY_SHARE = 0.25` : la part des personnes présentes qui meurent.
- **Politique** `SolidityPolicy` (domaine, pure) : `solidityAfterMonth({ solidity, upkeepPaid })`, `collapseChanceOf(solidity)`, `solidityStatusOf(solidity)`
  (`sound` | `warning` | `at-risk`), `casualtiesOf({ present, share, random })`.

## Les coutures

1. **Entretien payé ou non** — `SettleProducerCharges.execute` rend en plus `neglected`, la liste des bâtiments dont l'entretien n'a pas été payé ce mois :
   - un entretien à la charge de l'État dont le paiement est refusé (`#record`, `paid === false`) ;
   - un bâtiment dont le débiteur de l'entretien (l'entreprise, ou la société propriétaire pour les maisons) a des dettes ouvertes (`payablesOf`, déjà lu dans le mois).
   Rien n'est stocké : c'est le résultat du mois, passé à l'étape suivante.
2. **L'usure et l'effondrement** — un service du contexte gameplay, sur le modèle de `LiquidateInsolventCompanies` : `WearBuildings.execute({ neglected })` lit
   `listAllBuildingRows`, applique `solidityAfterMonth`, écrit la solidité, tire l'effondrement pour ceux sous `RISK_BELOW` et, pour chacun : tue les personnes présentes
   (`DexieCitizenRegistry`, comme `saveHealthJudgement` retire les morts d'une maison), compte `recordDeaths(n, 'accident')`, démolit par
   `bulldozeBuildingAtTile`, annonce l'événement (`gameplay.buildingCollapsed`, une dépêche). Chaque échec est rapporté, aucun n'en arrête un autre.
3. **Les travailleurs d'un lieu de travail** : les citoyens ont un lieu de travail (`withWorkplace`) ; ce sont eux qui sont tirés.
4. **L'affichage** — la solidité se lit dans l'onglet « État » (`BUILDING_INFO_TAB_IDS.state`, à ajouter au groupe des maisons) : une barre, comme celle de santé, et le
   mot du statut. Le sprite est un statut de plus de `STATUS_ICON_DEFAULTS` (`roleStatusSprites.js`), piloté par `solidityStatusOf`. Le mobile d'abord (CLAUDE.md).

## Tranches

1. Domaine et données : catalogue, politique, champ `solidity`, prefab, tests de la politique. *Fait le 2026-11-08* : `src/shared/solidity/` (catalogue et politique, partagés
   parce que la construction, le gameplay et l'écran les lisent), `DexieConstructionBuildingRepository.addRecord` pose une barre pleine à la construction (pas aux routes ni
   à la nature), les 24 bâtiments à barre du prefab portent `solidity: 100` dans leur JSON, `tests/shared/solidity.test.js`.
2. L'usure et l'effondrement. *Fait le 2026-11-08* : `SettleProducerCharges` rend `neglected` (entretien de l'État refusé, ou porté par une entreprise qui a des dettes ouvertes), `ProcessTurnBudget` le passe en `neglectedBuildings`, `WearBuildings` (gameplay) use, tire l'effondrement, démolit (`bulldozeBuildingAtTile`), tue (`housing.citizensInside` / `killCitizens`, cause `accident`, nouvelle ligne du HUD population) et annonce (`gameplay.buildingCollapsed`, un toast, pas de dépêche pour l'instant). Test : `tests/contexts/gameplay/wearBuildings.regression.test.js`. Reste à faire : le dernier point ci-dessous.
   Prévu à l'origine : la couture de la comptabilité, `WearBuildings`, la cause `accident`, la démolition, la dépêche ; test de non-régression (un État à sec
   laisse s'user ses bâtiments publics ; un effondrement tue et démolit).
3. L'écran : l'onglet « État » des maisons, la barre de solidité, le sprite d'alerte. *Fait le 2026-11-08* : section « Solidité » (barre verte, orange, rouge + phrase) dans l'onglet État de chaque groupe, et un onglet État propre aux maisons et aux bâtiments génériques (visible s'ils ont une barre) ; sprite `collapse-risk` (filtre « Alertes », infobulle) posé par `refreshEmploymentPresentation` sur tout bâtiment sous `WARNING_BELOW`. Pas encore vu dans le navigateur.

## Limites déjà connues

- L'entretien payé annule l'usure mais ne répare pas : un bâtiment négligé ne remonte jamais (il faudra une réparation ou une reconstruction ; à discuter).
- Les aides sans créancier nommé (entreprises, propriétaires de logements) restent perdues quand le Trésor est vide ; la solidité ne les concerne pas.
