# Plan — Passer par l'habitant (`passbycitizen`)

Statut (2026-11-07) : toutes les étapes sont faites (`workplaceId` et `pop` dérivé des citoyens compris, voir §8 bis). Écrit le 2026-11-04. Remplace le §4 de `health.plan.md` (le tableau
`health[]` par maison est abandonné : l'habitant devient une entité).

## 1. Idée générale

L'habitant devient un **acteur** du jeu. Tout ce qui, dans la réalité, tient à une personne se dérive d'elle, et non
de la maison qui la loge. La santé n'est que le premier champ.

| Champ | Nature | Quand |
|---|---|---|
| `id` (uuid) | invariant sur tout le jeu | tranche 1 |
| `constitution` | invariante, tirée à l'arrivée | tranche 1 |
| `firstName`, `birthTurn` | invariants, tirés à l'arrivée | tranche 1 |
| `houseId` | variable (déménagement possible un jour) | tranche 1 |
| `health` | variable | tranche 1 |
| `workplaceId` | variable | plus tard (voir §6) |
| compétences personnelles | variables | plus tard (voir §6) |
| bonheur, orientation politique | variables | plus tard |

Aujourd'hui la maison porte `pop`, le lieu de travail (`employees.workerSources` côté lieu) et les compétences
(déduites de la catégorie et du niveau de la maison). Il n'existe aucune table d'habitants.

## 2. Contrainte de performance : IndexedDB par lot, jamais par habitant

- **Lecture** : une requête indexée par hameau (`where('hamletId')`) au premier besoin, puis la mémoire. Jamais une
  requête par habitant.
- **Écriture** : un seul `bulkPut` des lignes modifiées (et un `bulkDelete` des morts et des départs) à la fin du tour,
  dans la même transaction que la sauvegarde des maisons. Les habitants ne changent qu'une fois par mois : la boucle du
  jour ne touche jamais la base.
- **Interface** : une carte, une maison ou un histogramme lit le cache. Un écran qui attend le chargement montre « … »,
  jamais une valeur périmée ou nulle.
- Même discipline que la fold du journal (CLAUDE.md, « One balance ») : un état dérivé en mémoire, tenu à jour par
  petits ajustements, reconstruit au chargement.

## 3. Modèle

Table `citizens` (schéma Dexie v23, sans `upgrade` : il n'y a pas de partie à migrer) :
`id, houseId, hamletId` (index). `deleteGameDatabase` puis `createEmptyGameDatabase` (toute la base est supprimée à la sortie d'une partie et recréée au chargement de la suivante, codes de triche compris) la repartent de zéro.

Une ligne se compose de deux parties :

- `identity` (gelée avec `Object.freeze`) : `id`, `firstName`, `birthTurn`, `constitution`.
- `state` (seule partie dont le registre suit les modifications) : `houseId`, `health`, puis les champs à venir.

Le registre n'offre aucune méthode qui modifie l'identité. L'uuid vient de `crypto.randomUUID()` à l'arrivée. Les
habitants du prefab ont des uuid fixes écrits dans le JSON. Le prénom est stocké, et non plus tiré par hachage de
l'index (`CitizenNameCatalog`) : l'ordre des cartes se trie sur des champs stables (statut puis uuid), donc la santé ne
« saute » plus d'une carte à l'autre.

## 4. Architecture

1. **`CitizenRegistry`** : port défini dans le contexte de population, adapté par un repository Dexie, comme
   `DexieEmploymentBuildingRepository`. API : `forHouse(houseId)`, `forHamlet(hamletId)`, `add`, `remove`,
   `moveTo(citizenId, houseId)` (non utilisé en tranche 1), `flush()`.
2. **Cache mémoire par hameau actif**, évincé quand le hameau devient inactif. Environ 100 octets par habitant : quelques
   centaines de ko pour quelques milliers d'habitants.
3. **Façade de lecture `HousePopulationView`** : le contrat de `house.pop` (et plus tard de `workerSources`) servi par
   une implémentation interchangeable. Aujourd'hui elle lit le champ de la maison. Plus tard elle lit une **projection en
   mémoire**, dérivée des habitants et mise à jour de façon incrémentale (+1 ou −1 à chaque naissance, mort ou
   déménagement), reconstruite au chargement. Le reste du code ne change pas quand on bascule.
4. **Invariant** : le nombre d'habitants d'une maison égale `pop`, vérifié au chargement et à l'envoi ; un écart lève une
   erreur nommant la maison. C'est un état de transition, tant que `pop` existe encore (décision A, §8).

## 5. Inventaire : où le code lit `pop` et `workerSources`

Comptage du 2026-11-04 (`.pop`, `pop:`/`pop =`, `workerSources`) : environ 70 fichiers de `src`, dont les plus chargés :

| Fichier | Lectures |
|---|---|
| `composition/createAccountingContext.js` | 15 |
| `presentation/dom/shell/nodes.js` | 13 |
| `housing/application/commands/growth/GrowHousePopulation.js` | 13 |
| `employment/domain/computeCityEmploymentSummary.js` | 8 |
| `accounting/application/services/SettleProducerCharges.js` | 8 |
| `composition/hudPopulationAggregates.js` | 7 |

Ce qui conditionne l'effort :

- **Les lectures de `pop` passent par plusieurs snapshots** (`HousingBuildingSnapshot`, `SupplyBuildingSnapshot`,
  `EmploymentBuildingSnapshot`) alimentés par leur repository Dexie. Ces trois repositories sont les points de
  basculement les plus propres : changer leur lecture suffit pour les contextes qu'ils servent.
- **Plusieurs endroits lisent les lignes brutes**, sans passer par un repository : `createAccountingContext.js` (par
  exemple `dexieDb.houses.toArray()` à la ligne 1268, et les lignes 305, 424, 565, 1770), `hudPopulationAggregates.js`
  (lignes 64, 150, 173, 211, 257). Ce sont ceux à faire passer par la façade avant toute bascule.
- **Les écritures de `pop`** sont aux cinq endroits déjà listés dans `health.plan.md` : croissance
  (`GrowHousePopulation`), famine, départs (`RunMonthlyDepartures`), changement de niveau (`applyLevelChange`) et la triche
  `MaxPop`. Ils appellent le registre pour ajouter ou retirer un habitant.
- **Replis silencieux repérés** (à rendre stricts en passant, conformément au CLAUDE.md) : `pop = 0` par défaut dans
  `HousingBuildingSnapshot.js:36` et `SupplyBuildingSnapshot.js:25`, `house.pop ?? 0` dans
  `DexieEmploymentBuildingRepository.js:24`, `row.pop ?? 0` dans `hudPopulationAggregates.js` (lignes 150, 173, 257, …),
  `employees.workerSources ?? {}`. Un hameau sans habitants a `pop` à 0, mais une ligne sans `pop` doit lever une erreur.

## 6. Ce que la maison porte encore, et la règle de passage

Règle : l'habitant n'écrit rien de ce que la maison porte déjà. Il le lit à travers sa maison, et une valeur n'a jamais
deux sources.

- **Compétences et statut** : dérivés de la catégorie sociale et du niveau de la maison. Si l'habitant déménage, il
  hérite de la catégorie de la nouvelle maison. Plus tard une compétence personnelle (formation) devient un champ de
  l'habitant, et la maison la plafonne au lieu de la donner ; c'est un changement de modèle volontaire (une compétence
  reste donnée par une seule catégorie sociale).
- **Lieu de travail** : l'emploi compte par `workerSources`. Quand on voudra savoir qui travaille où, `workplaceId`
  devient un champ de l'habitant et `workerSources` devient dérivé des habitants. On ne tient jamais les deux en
  parallèle. Il faudra alors choisir qui est embauché en premier (le plus qualifié ? le plus sain ?).
- **Point à mesurer** : `DistributeCityWorkers` manipule des compteurs. S'il affecte des personnes, il parcourt les
  habitants à chaque répartition. Mesurer avant de basculer. Si c'est trop lent, garder la répartition par compteurs et
  ne nommer les personnes que lorsqu'on affiche un lieu.

## 7. Étapes

| Étape | Contenu | Remarque |
|---|---|---|
| **0** | Rendre strict `pop` et `workerSources` dans les snapshots et repositories (§5) | À faire en premier, sinon l'invariant ne se vérifie pas |
| **1** | Table `citizens` (v23), `CitizenRegistry`, cache par hameau, écriture groupée, invariant sur `pop` | Socle |
| **2** | Façade `HousePopulationView` (implémentation qui lit `pop`) ; faire passer par elle les lectures brutes de `createAccountingContext.js` et `hudPopulationAggregates.js` | Aucun changement visible |
| **3** | Les cinq écritures de `pop` appellent le registre ; tirage de l'identité à l'arrivée | |
| **4** | Prefab : tableau `citizens` (72 lignes, uuid fixes) dans `anoria-tour-107/city-*.json` ; export et import des parties | JSON direct, sans migration |
| **5** | Santé : `HealthFactorCatalog`, équilibre mensuel, capacité de soin, histogramme, absentéisme (`health.plan.md` §2, §5, §6, §7) | La santé est un champ de `state` |
| **6** | Projection en mémoire à la place de `pop` ; puis `workplaceId` et `workerSources` dérivé | Après mesure de `DistributeCityWorkers` |

Chaque étape se livre et se teste seule.

## 8. Décisions (tranchées le 2026-11-04)

- **A. `pop` reste la source** (avec l'invariant « un habitant par résident ») jusqu'à l'étape 5 ; `pop` deviendra dérivé
  d'une projection à l'étape 6.
- **B. Le hameau actif est résident en mémoire** (une requête par hameau, puis le cache). Si la ville dépasse un jour les
  dizaines de milliers d'habitants : mesurer d'abord ; `forHouse` permet un chargement par maison sans changer l'API.
- **C. Mort ou départ : la ligne est supprimée.** Une mémoire des morts (cimetière, statistiques) aura sa propre table.

## 8 bis. État de la réalisation (2026-11-04)

Fait : étapes 0 (partiellement), 1, 3 et 4. Suite complète verte (287 suites, 1803 tests).

Écarts avec la conception ci-dessus :

- **Pas de suivi des lignes modifiées ni d'écriture en fin de tour.** Chaque changement de population écrit le delta de la
  maison (`bulkAdd`/`bulkDelete`) dans la **même transaction** que sa ligne (`DexieHousingBuildingRepository.#putFields`) :
  les changements sont mensuels, il n'y a aucun appel par habitant, et l'invariant tient sur le disque. Le cache d'un
  hameau est abandonné au commit de cette transaction et reconstruit à la lecture suivante.
- **Une démolition supprime les habitants** (dépôts de construction et de parcelles, même transaction que la ligne).
- **Qui part en premier :** les dernières arrivées (`planHousePopulation`). La famine pourra viser les plus fragiles à
  l'étape 5.
- **`arrivalTurn`** remplace `birthTurn` : le jeu ne dit pas qu'un habitant naît, il arrive.
- **Étape 2 (façade `HousePopulationView`) reportée à l'étape 6** : tant que `pop` est la source, la façade n'a rien à
  abstraire.
- **Statut positionnel :** `residentsOfHouse` attribue les statuts (travailleur, administrateur, chômeur) aux habitants dans
  leur ordre stable ; qui tient quel statut est positionnel jusqu'à `workplaceId` (§6).

Étape 0, ce qui reste (replis silencieux connus, non traités car leur retrait casse de nombreux tests) :

- `pop = 0` par défaut dans les fabriques `HousingBuildingSnapshot`, `SupplyBuildingSnapshot`, `EmploymentBuildingSnapshot`
  et `SupplyBuildingView`.
- `house.pop || 0` dans `hudPopulationAggregates.js` (lignes 64 et 211) et `CitizenTaxCollectionPolicy.js`.
- `employees.workerSources ?? {}` dans les dépôts d'emploi.
- `if (!row) return;` dans `DexieHousingBuildingRepository.#putFields` (une maison absente est ignorée sans erreur).

Étape 5 (santé), faite le 2026-11-04, en partie :

- `HealthFactorCatalog` (`shared/population`) : niveau de base 40 et quatre facteurs (variété de nourriture 8 par sorte jusqu'à 3,
  prévention 12, eau 12, éducation primaire 6). Chaque facteur lit un fait de la maison par un `kind` des exigences de niveau
  (`HouseTierRequirementPolicy`), donc une maison est « servie » pour sa santé exactement quand elle l'est pour son niveau. Le
  catalogue refuse de se charger si la meilleure maison dépasse l'échelle (100).
- `HealthEnvironmentPolicy` (parts et niveau, la somme des parts égale le niveau) et `HealthEvolutionPolicy` (la santé rejoint
  chaque mois `base + sensibilité × points`, de la part que fixe la convergence, sans jamais dépasser la cible).
- `EvolveHealthOfHouses` + système ECS `housing.health` : une maison est jugée une fois par mois, **le dernier jour du mois**
  (les enregistrements de besoins sont alors ceux du mois entier), ses habitants et la marque `lastHealthMonth` écrits dans une
  seule transaction.
- Affichage : onglet Habitants de la maison (histogramme des parts, santé sur chaque carte), mobile d'abord. Requête
  `getCityHealth` (moyenne pondérée par la population, calculée à la lecture) disponible, pas encore affichée.

Décisions du joueur-concepteur (2026-11-04) et ce qu'elles ont donné :

- **La prévention partage la capacité de soin.** Le Cabinet et l'Hôpital n'ont qu'une capacité, celle de leur service (le drapeau
  `doctor` / `hospital` est à la fois la visite de prévention et, plus tard, les soins).
- **Capacité** (fait) : `capacity: { inhabitantsPerWorker, serveFirst }` sur le rôle `distributor` du Cabinet (40) et de l'Hôpital
  (30), dans `buildingEconomy.js`. Un service atteint `employés en poste × habitants par soignant` ; une maison est servie en entier,
  celle qui ne tient pas dans ce qui reste est passée, une plus petite derrière peut tenir. Le compte est tenu par bâtiment
  (`servedBy` sur la maison) : redemandé dans la période, un service ne dépasse pas sa capacité. Un service sans `capacity` atteint
  toutes les maisons de sa portée. Le cabinet du prefab (2 employés, 80) couvre ses 72 habitants.
- **Ordre de service** (fait, laissé à ma décision) : `lowestHealth`, les maisons à la santé moyenne la plus basse d'abord, une
  maison vide en dernier, égalité par identifiant. Raison : la visite donne les mêmes points à tous, elle rapporte donc le plus à
  ceux qui risquent de passer sous le seuil de maladie. La règle est un nom du catalogue ; `serviceQueuePort.js` (composition) la
  connaît, Supply ne connaît aucun habitant. Une règle inconnue lève une erreur.
- **Seuil de maladie** (fait, laissé à ma décision) : `HEALTH_SICK_BELOW = 45` dans `HealthFactorCatalog.js`. Une maison qui a de
  l'eau et une sorte de nourriture (60) en est loin ; une maison qui ne donne que la base (40) est juste dessous : seule une maison
  négligée tombe malade. Le nombre de malades est dérivé à la lecture (maison et hameau), affiché dans l'onglet Habitants.
- **Qui paie l'arrêt maladie** (décidé le 2026-11-07, fait) : **jamais l'employeur ni la ville** (un remboursement de la ville
  n'existe pas dans la vie réelle). L'employeur ne paie pas un jour non travaillé : la paie suit les ouvriers présents. Le ménage
  est indemnisé par la sécurité sociale si le joueur l'a choisie dans le panneau Santé (réglage `sicknessCover`, `none` par défaut,
  `SicknessCoverCatalog`), sinon par personne. Voir « Absentéisme et sécurité sociale » ci-dessous.

Absentéisme et sécurité sociale (fait le 2026-11-07) :

- **Effectif effectif** : `absenteeism.js` (`shared/population`) est la seule règle. Les absents d'un lieu sont la part des malades de
  chaque maison source (`workerSources`) : `ouvriers de la maison × malades / résidents`. La porte opérationnelle et la capacité des
  services de soin lisent des ouvriers entiers (arrondis, `DexieSupplyBuildingRepository`, `worker` du snapshot Supply) ; la paie et
  l'indemnité lisent la part exacte, en argent. Le nombre de malades de la maison (`sickCount`) est écrit avec la santé à chaque
  jugement mensuel (le prefab porte `sickCount: 0` sur ses 7 maisons). Un malade garde son poste : il n'est pas chômeur.
- **Sécurité sociale** (choix du joueur, jamais par défaut) : 50 % du salaire que l'absent aurait gagné, moins une carence de 10 % du
  mois (une part du mois, jamais un nombre de jours : un mois dure `daysPerMonth`). Écritures `sickness_benefit` (ville, sortie de 431)
  et `household_sickness_benefit` (ménage, 437), bulletin comme l'allocation chômage (impôt retenu, pas de cotisation salarié).
- **Deux caisses** (`SocialFundsCatalog`) : caisse maladie = 431, caisse chômage = 4378 (« Autres organismes sociaux – Divers », 437 n'ayant
  pas de compte propre pour l'assurance chômage dans les sources lues ; 4372 est celui des mutuelles). Toutes les cotisations créditent
  431 ; à la clôture du mois, `CloseMonthAccounts` écrit l'OD `od_social_allocation` (431 → 4378, aucun argent ne bouge) du tiers de ce
  qui a été crédité à 431 sur le compte de la ville ce mois-là (`UNEMPLOYMENT_CONTRIBUTION_SHARE`). L'allocation chômage sort de 4378,
  l'indemnité maladie de 431. Le livret a une ligne par prestation ; le panneau Santé affiche le solde de chaque caisse (déficit visible).
- **Premier équilibrage à jouer** : avec 3 chômeurs pour 3 ouvriers, un tiers des cotisations (35 par mois) ne couvre pas leur allocation (210),
  la caisse chômage est en déficit. Il tient à peu près quand le chômage est sous ~14 % (avec ces taux) ; la part, le taux de l'allocation et les
  cotisations se règlent dans les catalogues et le panneau Salaires.
- Tests : `sicknessBenefit.regression`, `socialFunds.regression`, `socialFundsMonths.regression` (accounting).

Reste (non fait), avec le mécanisme retenu :

- **Assurances et mutuelles** (tranche suivante) : bâtiment de service « Assurances » regroupant des compagnies en concurrence (compte 4372),
  adhésion par pouvoir d'achat, indemnités plafonnées à la réserve accumulée, délai minimal d'adhésion, faillite et aide de la ville comme
  pour toute entreprise ; la loi qui impose l'assurance est désactivée tant que le bâtiment n'est pas fonctionnel. À détailler dans un plan propre.
- **Histogramme de la ville et de la carte d'habitant** : la maison l'a ; la ville a sa requête (`getCityHealth`) mais pas d'écran.
- Les valeurs du catalogue (base, points, plages de constitution, capacités, seuil) sont un premier équilibrage à ajuster en jeu.

### Étape 6, première partie : `workplaceId` (fait)

- Le citoyen porte `workplaceId` (null = sans emploi). `DistributeCityWorkers` répartit d'abord les effectifs par maison (inchangé), puis
  **nomme** les personnes (`WorkforceAssignmentPolicy`) : les valides d'abord, les malades seulement si le compte l'exige, jamais les invalides
  (retirés du bassin d'embauche). Seuls les citoyens dont le lieu change sont écrits (un lot, `assignWorkplaces`). `workerSources` reste la
  projection comptée de la même répartition.
- La santé lit la situation **réelle** du citoyen : sans emploi (dans une maison qui cherche du travail) = chômage ; employé = pollution **de son
  propre lieu** (`surroundingsOfCitizen`, `pollutionByWorkplace`). Le calcul positionnel (`unemployedIdsOf`) a disparu. Un `workplaceId` qui ne
  désigne plus un lieu du hameau lève une erreur.
- La liste des habitants d'une maison (`residentsOfHouse`) lit les statuts du `workplaceId` : plus de positions.
- **Absents exacts** : la répartition compte les malades affectés par lieu et maison source (`employees.absentSources`) ; l'effectif de la
  production (Supply) et la paie en dérivent. `absenteeism.js` (part fractionnelle) est supprimé.
- **Pension d'invalidité forfaitaire** : `INVALIDITY_PENSION_RATE × base des allocations × invalides de la maison` (`invalidCount`), les
  assureurs mesurent leur part sur la même base. L'invalide n'est plus un « travailleur absent » ni un chômeur indemnisé.
- Limite connue : les moyennes de la maison et du hameau (en-têtes d'histogramme) lisent encore `workerSources` (la projection) ; seules les
  situations par citoyen lisent `workplaceId`.

### Étape 0, soldée (lectures strictes)

- `createHousingBuildingSnapshot` exige `pop` (entier ≥ 0) et n'a plus de défaut ; `house.pop || 0` est remplacé par `residentsCountOf` /
  `house.pop` là où il ne s'agit que de maisons (`hudPopulationAggregates`, `CitizenTaxCollectionPolicy`, `GetCityPopulationSummary`, le PIB
  par habitant de `createAccountingContext`). `DexieHousingBuildingRepository.#putFields` lève une erreur si la maison n'existe pas.
- Laissés tels quels, **à dessein** : le `pop = 0` des fabriques `Supply…`/`Employment…` et `SupplyBuildingView` (ces instantanés couvrent tous
  les bâtiments ; un lieu de travail n'a réellement aucun résident) et `workerSources ?? {}` / `absentSources ?? {}` (un lieu qui n'a pas encore
  été réparti n'a réellement aucun travailleur ; une maison n'a pas d'`employees`).

### Étape 6, seconde partie : `pop` dérivé des citoyens (fait)

Les habitants d'une maison **sont** ses citoyens ; `pop` n'est plus stocké sur la ligne.

- **Projection** (`core/persistence/dexie/residentsProjection.js`) : le nombre de résidents par maison, en mémoire, reconstruit à chaque
  ouverture de la base (`db.on('ready')`), vidé par `citizens.clear()`.
- **Tenue à jour par les hooks de la table `citizens`** (`db.js`) : un citoyen ajouté ou retiré bouge le compte tout de suite (ce qu'on lit
  juste après l'écriture est vrai) ; une transaction qui avorte rend ce qu'elle a bougé. Attendre `complete` ne convenait pas : la promesse
  d'une transaction se résout avant son événement `complete`.
- **Échec d'une transaction** : Dexie rejette la promesse d'une transaction *avant* l'événement `abort`, et une transaction imbriquée est la même
  transaction IndexedDB que son parent. `db.transaction` est donc enveloppé (`db.js`) : il rend les comptes bougés par la transaction
  **la plus externe** au moment où il rejette ; l'événement `abort` n'est qu'un filet (idempotent). Une écriture qui échoue seule rend son
  incrément (`onerror` du hook) ; un `citizens.clear()` dans une transaction avortée recompte la table. Régression :
  `tests/shared/citizens/residentsProjection.regression.test.js`.
- **Servie à chaque lecture de `houses`** : un hook `reading` pose `row.pop` d'après la projection. Les ~68 lecteurs de `pop` n'ont pas changé.
  Avant la construction de la projection, une lecture lève une erreur (jamais un 0 trompeur).
- **Jamais écrit** : `canonicalizeHouseRecord` retire `pop` de toute ligne écrite (et le hook de lecture le réécrit de toute façon). Il ne peut
  pas distinguer un `pop` relu d'un `pop` voulu ; les écrivains de champs nommés (emploi, construction, approvisionnement, parcelles)
  **refusent** donc `pop` eux-mêmes (`refuseResidentsField`), pour qu'une écriture sans effet ne passe pas pour réussie. Les
  commandes `savePopulation` / `applyLevelChange` / `saveDepartures` gardent leur nom : « amener la maison à N habitants » (arrivées tirées,
  dernières arrivées parties), via `setHousePopulation`. Une mort retire le citoyen (plus de `pop − morts`).
- L'invariant « un citoyen par résident » n'a plus lieu d'être (c'est la même donnée) : `assertCitizensMatchPop` et le paramètre `pop` de
  `forHouse` sont supprimés. Le prefab n'a plus de `pop` sur ses maisons, l'export de ville non plus (`EXPORT_OMITTED_FIELDS`).
- Tests : les fixtures donnent à une maison de test autant de citoyens que son `pop` demandé (`seedBuilding`, `seedResidents`) ;
  régression dans `citizenRegistry.test.js` (le `pop` est le compte des citoyens, un nombre écrit dans la ligne ne change rien, une
  transaction avortée ne bouge rien).

## 9. Tests (peu, essentiels)

- L'invariant `nombre d'habitants === pop` lève une erreur nommant la maison quand il est rompu.
- L'identité d'un habitant ne change pas (uuid, constitution) quand sa maison change.
- Un lot de modifications ne fait qu'un `bulkPut` (aucun appel Dexie par habitant dans un tour).
