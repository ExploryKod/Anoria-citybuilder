# Plan — Système de santé

Statut : proposition, rien n'est construit. Écrit le 2026-11-02 après analyse du modèle des habitants.
Les points marqués **À trancher** attendent une décision du joueur-concepteur avant le plan détaillé de la tranche 1.

## 1. Idée générale

Chaque habitant a un score de santé (0-100). Ce score est un **état stocké** qui évolue lentement. Ce que la maison reçoit
(nourriture, eau, soins, éducation, pollution) sont des **facteurs**, relus à chaque période, jamais stockés.

- Les facteurs déterminent un **niveau d'environnement** de la maison.
- La santé de chaque habitant se rapproche chaque mois de ce niveau (équilibre, pas cumul), sans jamais diverger.
- Les habitants diffèrent par deux valeurs tirées une fois à leur arrivée : un **point de départ** et une **constitution**
  (vitesse de rapprochement et sensibilité aux facteurs).
- Un histogramme horizontal coloré montre la contribution de chaque facteur (en %), pour une carte d'habitant, une maison
  et la ville.

Pourquoi un équilibre et pas « +1 point par mois » : un cumul sature à 100 chez tout le monde, ou s'effondre sans retour.

## 2. Facteurs (liste de départ)

| Facteur | Source | Points |
|---|---|---|
| Variété de nourriture | nombre de sortes de nourriture reçues (`lastConsumption.categoriesTaken`) | 1, 2 ou 3 selon 1, 2 ou 3 sortes |
| Visite de prévention | couverture du cabinet (`servedFlags.doctor`) | + |
| Eau de la citerne | besoin d'eau (résultat de besoin de la maison) | + |
| Éducation primaire | couverture `primarySchool` (on y apprend l'hygiène) | + |
| Lieu de travail pollué | pollution des lieux de travail des habitants | − (étape ultérieure) |

Les valeurs de points sont des données du catalogue, pas du code.

### Extensibilité (« moderniser »)

Un seul **`HealthFactorCatalog`** déclare, pour chaque facteur : identifiant, source, points, éventuellement par niveau.
Le moteur et l'affichage lisent ce même catalogue : l'histogramme est la décomposition du calcul réel, jamais un second
lecteur de la même donnée. Moderniser = ajouter des entrées ou des niveaux (égouts, vaccination, etc.).
Les libellés viennent de `CatalogVocabulary` (jamais écrits à la main dans l'UI).

## 3. Ce que l'analyse du code a établi

Fichiers relatifs à `src/`.

- **Les habitants ne sont pas des entités.** Une maison stocke un entier `pop` dans l'unique table `houses`
  (`core/persistence/dexie/db.js:11-20`). Pas de table d'habitants, ni âge, ni naissance, ni vieillissement.
- **Les cartes sont fabriquées à la lecture** par `residentsOfHouse` (`contexts/accounting/domain/policies/HouseResidentsPolicy.js:13-32`) :
  identifiant `houseId:index`, prénom par hachage de l'index (`shared/population/CitizenNameCatalog.js`). L'ordre
  (travailleurs par lieu, puis administrateurs, puis chômeurs) n'est pas stable d'un mois à l'autre.
- **Tous les habitants d'une maison partagent statut et compétences** (catégorie sociale et niveau de la maison,
  `shared/population/workforceQueries.js:79`).
- **Lien habitant → travail seulement par maison** : un lieu de travail stocke `employees.workerSources: {houseId: nombre}`
  (`contexts/employment/domain/EmploymentBuildingSnapshot.js`). On ne sait pas quelle personne travaille où.
- **Croissance** : +1 habitant par mois jusqu'au plafond du niveau (`PopulationGrowthPolicy.js:29-67`).
- **Mort existante** : un habitant par mois en cas de famine, uniquement en mode « perte »
  (`contexts/housing/application/commands/growth/GrowHousePopulation.js:69-99`). Un compteur de session mène à la fin
  de partie à 25 morts (`composition/gameplayMortalityState.js`, `GAME_OVER_DEATH_THRESHOLD`).
- **Départs** : `RunMonthlyDepartures` (cause `rentUnpaid`, `shared/population/DepartureCauseCatalog.js`).
- **Agrégation existante** : `GetCityPopulationSummary` (`contexts/housing/application/queries/GetCityPopulationSummary.js`)
  somme `pop` par hameau actif ; `computeCityEmploymentSummary` fait de même pour l'emploi.
- **Pollution : aucun concept** dans le code.
- **Chaîne mensuelle** (`composition/createGameRuntime.js:110-132`) : approvisionnement, croissance, évolution, emploi.
  Les systèmes tournent à chaque tour et sont rendus mensuels par un verrou `monthIndex`.
- **Starter prefab** `shared/prefabs/anoria-tour-107/` : 7 maisons, 72 habitants (6 à 12 par maison), 17 lieux de travail.
- **Lecture des lignes de maison** : les champs inconnus sont conservés (`...rest`, `HousingBuildingSnapshot.js:49-56`),
  donc un nouveau champ par maison est sûr à la lecture.

## 4. Stockage retenu : un tableau de scores par maison

> **Remplacé le 2026-11-04** par `docs/plan/passbycitizen.plan.md` : l'habitant est une entité (table `citizens`, uuid,
> constitution, santé, maison). Ce qui suit est l'idée d'origine, gardée pour l'historique ; la santé est désormais un
> champ de l'habitant, pas un tableau de la maison.

`health: [72, 55, 90, ...]`, un score par habitant, de longueur égale à `pop`. Aucune table d'habitants n'est créée.

- La moyenne de la maison, le nombre d'habitants sous un seuil et la répartition sont **dérivés à la lecture**.
- **La ville** = moyenne pondérée par la population (somme des scores / population totale), même parcours que
  `GetCityPopulationSummary`, par hameau actif, jamais stockée. Quelques centaines de valeurs au plus : coût négligeable.
- Le calcul des facteurs est **mensuel, par maison**, avec un verrou par mois comme la croissance. Jamais dans la boucle du jour.

### Invariant : `health.length === pop`

Cinq endroits modifient `pop` : croissance, famine, départs, changement de niveau (`applyLevelChange`) et la triche `MaxPop`.
Chacun fait suivre le tableau (un arrivant reçoit un score tiré, un départ ou un mort retire une valeur). Un écart lève une
erreur explicite nommant la maison. Pas de repli silencieux, pas de migration.

### Identité d'une carte

Le prénom et le score doivent s'accrocher à la même position `i` tant que l'habitant ne meurt pas. À vérifier : le prénom
suit-il l'index d'origine ou l'ordre trié par statut ? Si l'ordre trié décale les positions, rendre l'ordre des cartes
stable avant d'y attacher la santé (sinon la santé « saute » d'une carte à l'autre).

## 5. Conséquences, par étapes

| Étape | Contenu | Remarque |
|---|---|---|
| **1** | Capacité de soin, score, équilibre, histogramme, absentéisme par seuil | Local : emploi et UI |
| **2** | Maladies (risque par seuil) et mort | Touche la démographie |
| **3** | Pension d'invalidité | Flux d'argent : écritures PCG |
| **4** | Contagion et épidémies | Modèle de voisinage de maisons, équilibrage |

- **Absentéisme** : par maison. L'emploi travaille en nombres (`workerSources`), donc les travailleurs disponibles d'une maison
  sont `pop` moins les malades au-delà du seuil. La répartition elle-même ne change pas.
- **Pollution** : par maison, exposition = moyenne de la pollution des lieux de travail pondérée par `workerSources`.
  Demande d'abord un fait `pollution` dans le catalogue des lieux de travail (inexistant). Reporté à l'étape 2.
- **Mort** : décrément de `pop` (et du tableau), comme la famine.
- **Pension d'invalidité** : comptée par maison (nombre d'invalides), payée par une écriture du journal (PCG), compte et
  payeur à définir. Hors tranche 1.

## 6. Capacité de soin (tranche 1)

La capacité d'un Cabinet médical (`doctor`) ou d'un Hôpital (`hospital`) devient
`employés en poste × habitants par soignant` (constante déclarée dans le catalogue). Aujourd'hui, la couverture est un
drapeau sans limite (`consumption: 'flag'`, `range: Infinity`, `DistributeResourceToConsumers.js#distributeFlag`).

- Les maisons au-delà de la capacité ne sont pas soignées ce mois-là ; le joueur voit les habitants non soignés.
- Cela reprend l'idée « staffing-driven capacity » (`docs/ECONOMIE_REPRISE.md`, section 6, point 10).
- **À trancher** : les visites de prévention consomment-elles la même capacité que les soins ? Qui est servi en premier
  quand elle manque ? Proposition : les scores les plus bas d'abord (une règle arbitraire, comme l'ordre de construction,
  induirait le joueur en erreur).
- Le Cabinet couvre le quotidien (déjà requis dès le niveau 1) ; l'Hôpital est requis pour les paliers hauts. Deux
  compétences distinctes existent déjà (`medecine-proximite`, `medecine-hospitaliere`), conformément à la règle
  « une compétence = un niveau ».

## 7. Tranche 1 : périmètre proposé

- Score par habitant dans un tableau par maison, tirage à l'arrivée (point de départ et constitution).
- Équilibre mensuel vers le niveau d'environnement.
- Quatre facteurs : variété de nourriture, prévention, eau, éducation primaire (sans pollution).
- Capacité de soin du Cabinet et de l'Hôpital.
- Histogramme (carte d'habitant, maison, ville) et absentéisme par seuil.
- **Prefab** : ajouter les tableaux `health` (7 maisons, 72 valeurs) directement dans le JSON de
  `src/shared/prefabs/anoria-tour-107/city-*.json`, sans migration au chargement.
- **Mobile d'abord** : l'histogramme passe en pile verticale sur téléphone, segments lisibles, zones de toucher d'au moins 40 px.
- **Tests** (peu, essentiels) : l'équilibre ne diverge pas ; la décomposition de l'histogramme égale le niveau
  d'environnement ; l'invariant `health.length === pop` lève une erreur quand il est rompu.

## 8. Décisions à trancher

1. Les morts de santé comptent-elles dans les 25 morts de la fin de partie, ou seulement celles de la famine ?
2. ~~L'arrêt maladie est-il payé par l'employeur ou par la ville ?~~ Tranché le 2026-11-07 : ni l'un ni l'autre (voir `passbycitizen.plan.md`, « Absentéisme et sécurité sociale »).
3. Le score reste-t-il attaché à sa position (même prénom, même santé) tant que l'habitant ne meurt pas ? (suppose un
   ordre de cartes stable)
4. Les visites de prévention et les soins partagent-ils la capacité ? Quel ordre de service quand elle manque ?
5. La santé tue-t-elle ? La croissance est aujourd'hui volontairement découplée de la famine : c'est un changement de
   philosophie à assumer.
6. Les soins sont-ils facturés aux maisons, ou une charge municipale financée par l'impôt ?
