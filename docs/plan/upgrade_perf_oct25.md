# Plan : améliorer la performance du tick (octobre 2026)

Branche : `feature/perf-migration` (depuis `develop`). Début : 2026-10-25.
Contexte et réflexions de fond : `../architecture/RUST_WASM_ET_MODES_DE_JEU.md`.

## 1. Objectif

Faire baisser le coût d'un jour de jeu, mesuré, avant de choisir tout changement d'architecture (worker, Rust/WASM,
serveur). On ne porte rien en Rust tant que la mesure ne l'exige pas.

## 2. Mesures de départ (2026-10-25)

Instrumentation en place (dev uniquement, tag `[tick-perf]`) :
- `src/composition/runGameTick.js` : une ligne par tick complet (`city`, `scene`, `ecs`, `persist`, `budget`, `hud`,
  `objectives`).
- `DistributeCityWorkers` renvoie `timings` ; `createEmploymentContext.js` affiche
  `employment.distribute read/compute/write`.
- Lecture : `pnpm console:tag tick-perf --follow` (vider le journal : `: > dev-diagnostics.log`).

Ville de 9 à 10 maisons, 16 lieux de travail, jours 117 à 176, mode dev avec DevTools ouverts :

| Étape | Typique | Remarque |
|---|---|---|
| tick complet | 1,3 à 4,3 s | pour 10 bâtiments |
| `scene` | 600 à 1 000 ms | somme de deux `scene.update` ; 1,5 à 2 s quand une maison est posée |
| `ecs` | 450 à 800 ms | pointes à 1,2 s |
| `hud` | environ 180 ms | stable |
| `budget` | 1 à 3 ms | **sauf tous les 5 jours (fin de mois) : 374 à 1 869 ms, en hausse avec la partie** |
| `persist`, `city` | moins de 12 ms | négligeable |
| `employment.distribute` | lecture 30 ms, calcul 0,2 ms, écriture 20 ms | environ 50 ms |

Enseignements :
- Le calcul de `DistributeCityWorkers` (0,2 ms) ne justifie ni Rust ni optimisation : la couture Rust évaluée en premier
  est écartée.
- Le budget de fin de mois grandit avec l'âge de la partie (388, 374, 460, 529, 600, 657, 657, 802, 808, puis 1 207,
  1 496, 1 869 ms) : coût qui dépend de la taille de l'historique (journal ?). **Hypothèse, non vérifiée.**
- `scene` et `ecs` sont très élevés pour si peu d'objets : allers-retours IndexedDB en série (des `await` dans des
  boucles) ou travail refait à chaque tick ? **Hypothèse, non vérifiée.**

Réserves : mode dev de Vite, DevTools ouverts, relais de console. Les proportions informent, pas les valeurs absolues.

## 2 bis. Mesures sur une partie réelle (2026-10-25, 144 jours)

Source : `dev-diagnostics.log` de la partie qui avait produit l'ancien prefab (tour 144, remplacé depuis par `anoria-tour-107`) (mode dev, DevTools ouverts, 57 bâtiments à
la fin). Tag `[tick-perf]`.

**Coût d'un jour, moyenne par tranche de 24 jours (ms)**

| Jours | Jours mesurés | Total | ECS | Scène (2 appels) | HUD | Budget |
|---|---|---|---|---|---|---|
| 1–24 | 24 | 703 | 148 | 412 | 108 | 33 |
| 25–48 | 24 | 1 191 | 432 | 508 | 141 | 105 |
| 49–72 | 24 | 1 603 | 675 | 610 | 143 | 170 |
| 73–96 | 19 | 1 371 | 655 | 549 | 157 | 5 (*) |
| 97–120 | 19 | 1 289 | 557 | 546 | 174 | 5 (*) |
| 121–144 | 20 | 1 528 | 531 | 806 | 179 | 5 (*) |

(*) Après le jour 74 le règlement mensuel ne s'exécute plus (voir 2 ter) : le budget y est sous-estimé. À ~800 ms toutes les
5 jours, la fin de mois ajoute de l'ordre de 160 ms par jour en moyenne.

Moyenne des jours ≥ 20 : total 1 375 ms = ECS 554 + scène avant 330 + scène après 266 + HUD 155 + budget 65 + persistance 5.
Le coût d'un jour **double** en 50 jours avec la croissance de la ville, puis reste haut.

**ECS, par système (moyenne sur 180 ticks)**

| Système | ms |
|---|---|
| `supply.monthlyResourceCycle` | 324,5 |
| `housing.evolution` | 92,9 |
| `employment.redistribute` | 52,2 |
| `commerce.monthlyCityTrade` | 5,9 |
| `parcels.roadAccess` | 5,8 |
| `housing.populationGrowth` | 5,3 |
| autres (4) | moins de 5 chacun |

`supply.monthlyResourceCycle` (le cycle « mensuel » s'exécute chaque jour, voir la note sur les ticks) croît avec la ville :
44 ms (ticks 1–30), 210, 391, 517 (ticks 91–120), puis 408 et 377 ms. C'est 60 % de l'ECS.

**Fin de mois (règlement du budget), jours 5 à 70 (ms)**

| Jour | `producerCharges` | `monthBatchOverhead` | Total des étapes |
|---|---|---|---|
| 5 | 55 | 5 | 79 |
| 25 | 483 | 25 | 538 |
| 45 | 416 | 31 | 487 |
| 60 | 999 | 292 | 1 350 |
| 70 | 697 | 40 | 799 |

`producerCharges` (le règlement des charges des producteurs et des ménages) fait plus de 80 % du total de la fin de mois et croît
de 55 à 700–1 000 ms avec la ville.

**Verdict sur les hypothèses de départ**
- **Confirmé : `DistributeCityWorkers` est négligeable.** Calcul 0,1–0,4 ms ; lecture 20–40 ms et écriture 15–35 ms
  (regroupables en lot). Aucun intérêt à y toucher en Rust ni en JS pour le calcul.
- **Confirmé, sous une autre forme : le coût de fin de mois grandit.** Il croît avec la ville et l'activité (`producerCharges`),
  pas par une étape cachée. Pas de preuve qu'il dépende seulement de l'âge du journal.
- **Non confirmé : allers-retours IndexedDB en série dans `scene` et `ecs`.** Pas de mesure plus fine encore (étape 3).
- **Nouvelles cibles, par ordre de poids :** (1) `supply.monthlyResourceCycle` ; (2) les deux `scene.update` (~600 ms, dont
  le second est un doublon probable quand rien n'a changé) ; (3) `producerCharges` en fin de mois ; (4) le HUD à ~155 ms chaque
  jour, même sans changement ; (5) `housing.evolution` à 93 ms.

## 2 ter. Bug découvert pendant les mesures : le règlement mensuel s'est gelé au jour 75

En analysant le prefab, on a vu que **tous les règlements mensuels (salaires, allocations, loyers, entretien, cotisations)
s'arrêtent au tour 70** (dernier règlement avant le jour 75). Les jours 75, 80, … 140 n'ont aucun rapport de tick : le tour
a levé une exception à chaque début de mois. Au jour 74, la maison violette `923c8241` (construite au tour 28) est démolie.
`GameLoop` n'attrape pas l'exception : l'horloge a déjà avancé et est sauvegardée, c'est un rejet de promesse non géré, sans
trace taguée.

**Cause reproduite** (import du vrai prefab, règlement du jour 145) :
`[ProcessTurnBudget] budget operations failed at turn 145: [producer] building 923c8241-… has no catalog name for its journal lines`,
levée par `nameOf` (`SettleProducerCharges.js:170`), appelée par `#recordDebtPayment` (:684), appelée par `#settleCompanyMonth` (:617).
Le château d'eau (`WaterTank`) doit 22,68 € de salaires à cette maison. Chaque mois il paie ses vieilles dettes avant le reste,
tombe sur celle-là, et veut nommer le créancier qui n'existe plus : tout le lot du mois est annulé (le mécanisme de lot est sain),
et cela se répète à chaque début de mois. C'est la seule dette ouverte dont le créancier a disparu (18 dettes ouvertes en tout).

Conséquence : 14 mois sans revenus pour les ménages, qui n'ont plus pu payer la nourriture (qui existait).
**Corrigé** (tranche 1 de `../gameplay/PLAN_DEMOLITION_LIQUIDATION.md`) : démolir un bâtiment passe ses écritures comme une liquidation ; les dettes qui lui
sont dues sont abandonnées par une écriture explicite ; la maison du maire ne peut plus être démolie ; un pop-up prévient ; `GameLoop` trace désormais l'échec
d'un jour. Reste à décider si `GameLoop` doit aussi mettre le jeu en pause avec un message. Le prefab devra être ré-exporté. Le test de reproduction complet
(2 minutes) n'a pas été gardé ; le test de non-régression est un test unitaire (`demolitionLiquidation.regression.test.js`).

## 2 quater. Run complet de 107 jours, règlement mensuel intact (2026-10-25, après correctifs)

Premier run sans gel du règlement : 107 jours sur 107 mesurés, les 21 fins de mois réglées (70 bâtiments à la fin, 7 maisons, 72 habitants). Mode dev, DevTools ouverts.

| Jours | Total | ECS | Scène (2 appels) | HUD | Budget (moyenne/jour) |
|---|---|---|---|---|---|
| 1–25 | 1 147 | 206 | 723 | 140 | 75 |
| 26–50 | 1 484 | 483 | 709 | 181 | 105 |
| 51–75 | 1 862 | 681 | 805 | 190 | 180 |
| 76–107 | 2 279 | 903 | 899 | 212 | 260 |

- **Le jour double en 100 jours** (1,15 s à 2,28 s) pour une ville qui passe d'environ 15 à 70 bâtiments.
- **La fin de mois est le poste qui grandit le plus vite.** Total des étapes : 77 ms (jour 5), 666 ms (milieu), **1 568 ms (jour 105)**. `producerCharges` seul passe de 47 ms à
  **1 418 ms**, soit environ 30 fois, alors que la ville a grandi d'environ 5 fois : le coût dépend aussi de la taille du journal (l'hypothèse « coût qui grandit avec
  l'historique », notée non vérifiée en 2 bis, est maintenant étayée). Piste : `payablesOf` et les lectures du journal sont refaites pour chaque bâtiment ; à lire une fois
  et à partager (le repli du journal est déjà incrémental ailleurs).
- ECS : `supply.monthlyResourceCycle` 357 ms, `housing.evolution` 112, `employment.redistribute` 56. La scène (~900 ms) et le HUD (~210 ms) croissent aussi lentement.
- **Cible à ce rythme** : à 100 jours, un jour de fin de mois coûte environ 2 s + 1,6 s ; la cible proposée (moins de 600 ms par jour, fin de mois comprise) est loin.

## 2 quinquies. Premier gain : la fin de mois ne relit plus toute la traçabilité (2026-10-25)

**Cause trouvée** (banc de test sur le vrai prefab `anoria-tour-107`, journal de 4 172 lignes, 9 137 lignes de traçabilité) : `recordEconomyMovement` vérifiait, pour **chaque mouvement écrit**,
qu'il n'existait pas déjà, en lisant toutes les lignes de son type de transaction avec un filtre JavaScript. Une fin de mois écrit plusieurs centaines de mouvements, et la table
grossit avec l'âge de la partie : un coût quadratique, qui explique le ×30 de `producerCharges` (47 ms à 1 418 ms) pour une ville ×5. Les lectures mensuelles du règlement
(`sumServiceFlows`, `sumGoodsFlowsByPair`, `sumUnitsSoldBySeller`, `sumSpoilageByBuilding`) passaient aussi par un balayage de toutes les lignes de leur type.

**Correctif** : schéma Dexie v22, deux index sur `supplyTraceability` : `businessKey` (la vérification d'idempotence devient une recherche) et `[hamletId+year+month]` (une lecture mensuelle
ne touche que les lignes du mois, via `#rowsOfMonth`). Aucun changement de comportement.

**Mesure** (même fin de mois, même prefab, banc `fake-indexeddb`) : **103,7 s → 11,4 s**, et `recordEconomyMovement` : 81 appels en 65 ms. Les valeurs absolues du banc sont gonflées (son arbre de
recherche dégénère quand les clés arrivent triées) : c'est le rapport qui compte. **À confirmer dans le navigateur** : la ligne `[tick-perf] month-end` du jour 105 de la prochaine partie
doit passer sous la barre des 1,4 s de `producerCharges` mesurée avant (dans la partie complète de 107 jours).

**Piège de mesure** : le profil CPU de Node ne remonte pas jusqu'à notre code (les rappels IndexedDB perdent leur appelant). Ce qui marche : chronométrer et **compter les appels** des méthodes de nos
dépôts (le nombre d'appels est exact même sur le banc émulé).

**Chantier suivant : le cycle d'approvisionnement** (`supply.monthlyResourceCycle`, 357 ms par jour dans le navigateur). Un jour, sur le prefab, c'est environ **700 opérations IndexedDB** :
261 `findById`, **145 `updateBuildingFields`** (une transaction chacune, 35 % du temps du cycle sur le banc), 74 écritures de traçabilité, 50 `saveStocks`, 43 `findByResourceRole` (un balayage des
bâtiments chacun), 40 `findRowById`, 19 `listAllBuildingRows`. Pistes : regrouper les écritures d'un cycle en une écriture en lot, et lire les bâtiments une fois par cycle au lieu d'une fois
par appel.

## 3. Étapes

1. **Mesurer plus fin — fait le 2026-10-25** (voir 2 bis ; les chronomètres restent en place, dev, tag `[tick-perf]`, aucun changement de comportement) :
   - temps de chaque système dans `runtime.runSimulation` (`src/engine/ecs`) ;
   - temps de chaque étape de `processGameTurnBudget` en fin de mois (clôture, fold du journal, charges) ;
   - séparer les deux `scene.update` du tick.
2. **Comparer avec un build de production** (`vite build` puis `preview`) pour savoir ce qui vient du mode dev.
3. **Corriger ce que la mesure désigne**, du plus rentable au moins rentable, en JS d'abord. Ordre proposé d'après 2 bis :
   `supply.monthlyResourceCycle` (324 ms par tick), les deux `scene.update` (~600 ms), `producerCharges` en fin de mois
   (jusqu'à 1 s), le HUD (155 ms), `housing.evolution` (93 ms). Pistes générales :
   - fin de mois qui croît avec l'historique : lecture incrémentale plutôt que relecture complète (le fold du journal
     est déjà conçu pour n'ajouter que les nouvelles écritures : vérifier qu'il n'est pas reconstruit à chaque mois) ;
   - allers-retours IndexedDB : regrouper les lectures et écritures en lots (une transaction), notamment
     `saveWorkers`/`saveWorkerSources` (deux `await` par lieu de travail) ;
   - listes recalculées à chaque appel : mémoïser (`qualifyingSources` dans `DistributeCityWorkers`), sans gain
     attendu tant que l'emploi reste à 0,2 ms de calcul ;
   - `scene.update` : ne refaire que ce qui a changé.
4. **Remesurer** après chaque correction avec les mêmes lignes `[tick-perf]`, sur la même ville.
5. **Seulement si une charge de calcul pur reste dominante** : décider d'un worker (JS), puis éventuellement d'un module
   Rust/WASM derrière la même interface, avec test de parité JS/Rust. Candidats probables : moteur de flux du `supply`,
   pathfinding, fold du journal.

## 4. Règles du projet à respecter pendant le travail

- Aucun fallback silencieux : une donnée manquante lève une erreur explicite.
- La trésorerie vient du fold du journal ; aucun second calcul de solde, aucun chiffre dérivé stocké.
- Les clôtures mensuelles restent idempotentes par clé (`type:hamletId:year:month`).
- Pas de migration de sauvegardes anciennes ; si une donnée est fausse, échouer clairement.
- Peu de tests : seulement les règles essentielles et les non-régressions de bugs corrigés.
- Ne pas committer sans demande ; modifier les fichiers avec Edit/Write.

## 5. Critère de réussite

Un jour de jeu sur une ville de départ nettement plus bas que le point de départ (1,3 à 4,3 s sur l'ancien prefab ; 1,4 s en
moyenne sur la partie de 57 bâtiments, 1,6 s au plus chargé), et un coût de fin de mois qui ne croît plus avec la taille de
la ville. Une cible **proposée**, à confirmer après l'étape 2 (build de production) : moins de 600 ms par jour en dev sur la
ville du prefab, fin de mois comprise. Réduire en dev compte même si la production est plus rapide.

## 6. Hors périmètre pour l'instant

Serveur autoritaire, Rust/WASM, multijoueur : voir `../architecture/RUST_WASM_ET_MODES_DE_JEU.md` (décision :
client autoritaire, VPS léger). À reprendre une fois la performance de base comprise.
