# Plan — Fluidité : le compteur « call » et les bâtiments qui apparaissent en retard

Statut : **outil de mesure fait (étape 0)**, le reste est à faire. Écrit le 2026-11-07, après un constat de jeu : le compteur de « call » monte à environ 12 000 et certains bâtiments
ne s'affichent pas tout de suite après la pose. Les points marqués **À trancher** attendent une décision du joueur-concepteur. Ce plan complète
`docs/optimization/OPTIMISATION_THREEJS_WEBGL.md` (guide général) et `docs/plan/upgrade_perf_oct25.md`.

**Ce qui est établi et ce qui ne l'est pas.** L'analyse ci-dessous vient de la **lecture du code** et du chiffre rapporté, **sans aucune mesure faite** :
aucune durée de tour, aucun détail des draw calls par type d'objet. La première étape est donc de mesurer (§4, étape 0). Une cause supposée n'est pas
une cause démontrée tant que cette étape n'a pas parlé.

## 1. Les phénomènes

### 1.1 Les 12 000 « call » — **correction du 2026-11-07 : ce n'est pas un nombre de draw calls**

**La première version de ce plan avait tort.** La colonne jaune de `src/presentation/three/PerfHud.js` lisait `renderer.info.render.calls`. Le moteur du jeu est
le **`WebGPURenderer`** de Three.js (0.185.1), où `info.render.calls` est « le nombre d'appels à `render()` **depuis le démarrage de l'application** »
(`node_modules/three/src/renderers/common/Info.js`) : un compteur qui **ne fait que croître**, d'environ une unité par image. Les 12 000 « call » ne sont donc
que le temps de jeu écoulé (environ 200 secondes à 60 images par seconde), **pas** une charge de rendu. Les draw calls de la dernière image sont dans
`info.render.drawCalls`.

**Fait le 2026-11-07** : le HUD lit maintenant `info.render.drawCalls` (le vrai nombre par image), et un **clic sur ses graphes écrit dans la console un relevé**
(`renderLoadBreakdown.js` : draw calls, triangles, meshes visibles, ombres, ce que l'instanciation économiserait, répartition par catégorie). Le vrai nombre de
draw calls est **inconnu** tant que ce relevé n'a pas été pris en jeu : on ne sait donc pas encore si le rendu est un problème.

Les causes ci-dessous sont des **hypothèses** sur le rendu, à confirmer ou écarter par ce relevé (étape 0). Le retard d'affichage des bâtiments (§1.2) peut venir
du tour de jeu sans que le rendu soit en cause.

Causes possibles du côté du rendu, d'après le code :

- **Aucune instanciation ni fusion de géométries pour les bâtiments et le terrain.** `InstancedMesh` / `mergeGeometries` n'apparaissent que pour les
  champs de ferme (`kenneyFarmFieldAdapter.js`) et des surcouches (`roadPaintPreview.js`, `reachOverlay.js`). Chaque bâtiment est un modèle Kenney cloné
  avec plusieurs meshes, chaque tuile de terrain est un objet à part.
- **Culling par groupe de zone, pas par mesh** (`PerformanceManager.updateFrustumCulling`) : un groupe en partie visible est dessiné en entier.
- **Seconde passe d'ombres à chaque rafraîchissement.** `renderer.shadowMap.autoUpdate = false` (`scene.js`), la carte d'ombres est rendue à la demande
  (`requestShadowRefresh`), notamment quand `updateShadowCasting` change un `castShadow`. Une pose de bâtiment fait donc coûter plus cher l'image qui la suit.

### 1.2 Les bâtiments qui n'apparaissent pas tout de suite

Le navigateur n'a **qu'un seul fil** pour le rendu et pour la simulation. Deux gros consommateurs s'y disputent le temps :

- **Le rendu** : l'envoi des draw calls à chaque image (leur nombre réel est à relever, voir §1.1 : ce n'est pas 12 000).
- **Le tour de jeu** (`src/composition/runGameTick.js`) : systèmes ECS, `scene.update`, persistance, budget, HUD, avec beaucoup d'`await` sur IndexedDB.
  Le code lit la table `houses` en entier **44 fois** (`houses.toArray()`), dont 22 dans `createAccountingContext.js`. Chaque lecture traverse le crochet de
  lecture de `pop` (`db.js`), ce qui ajoute un peu de travail par ligne et par lecture.

La pose écrit d'abord la ligne en base ; le mesh n'est créé que quand la synchronisation de la scène passe, dans ce même tour. Si un tour est en cours,
l'affichage attend sa fin. Plus le rendu est lourd, moins il reste de temps pour le tour, et plus l'attente est visible (si le rendu est lourd : à mesurer).

## 2. L'idée du joueur-concepteur : une pause de construction

Quand on construit, le jeu arrête de tourner et le joueur se concentre sur la construction, avec un indicateur visible. Comme une pause, avec tout ce qui
touche à la construction resté accessible.

- **Ce que ça règle** : le tour ne tourne plus pendant la pose, donc plus de concurrence avec la création de mesh. Aucune simulation à construire : `pauseGame` /
  `playGame` existent (`composition/sessionShell.js`).
- **Ce que ça ne règle pas** : le coût du rendu (draw calls). L'aperçu de pose et la caméra restent lourds, même en pause. C'est un remède au retard
  d'affichage, pas à la fluidité du rendu : les deux chantiers sont indépendants.
- **Indicateur** : un bandeau « Construction — jeu en pause » avec une icône de pause, la barre de construction restant accessible.
- **Reprise** : à la sortie du mode construction, le jeu reprend **seulement s'il tournait avant**. Si le joueur avait déjà mis en pause, on ne le relance pas.
- **Réserve de design** : pendant la pause le temps ne s'écoule pas ; c'est la norme dans les jeux du genre, mais ça change le rythme.
- **Tranché (2026-11-07)** : la pause est **automatique** dès qu'un outil de construction est choisi, et un réglage de la page Paramètres permet de l'activer
  ou non (« Construction en pause »), en disant au joueur que **ça permet d'optimiser les performances**. **Ordre décidé** : on optimise d'abord **sans** la
  pause, pour régler les plus gros problèmes à la source ; la pause vient après, comme réglage complémentaire (étape 6 ci-dessous). Valeur par défaut du réglage :
  à fixer en le construisant (le plus sûr pour la fluidité : activé).

## 3. Les pistes, de la plus efficace à la moins efficace

1. **Réduire les draw calls** (le vrai levier) :
   - instancier (`InstancedMesh`) les bâtiments et les tuiles qui répètent le même modèle et le même matériau ;
   - fusionner le terrain statique par zone ;
   - culler par mesh et non par groupe de zone.
2. **Ombres** : regrouper les demandes de rafraîchissement, pour qu'une rafale de poses déclenche une seule passe d'ombres.
3. **Tour de jeu** :
   - lire la table `houses` **une fois par tour** et partager le résultat (aujourd'hui 44 lectures) ;
   - découper le tour en tranches avec une pause entre elles, pour que le navigateur dessine une image entre deux.
4. **Afficher le bâtiment tout de suite** : créer le mesh au moment de la pose et écrire en base ensuite, au lieu d'attendre le passage du tour. Touche à l'ordre
   « base d'abord » : à étudier avec soin (une pose refusée ou échouée doit retirer le mesh).

## 4. Étapes

| Étape | Contenu | Remarque |
|---|---|---|
| **0** | **Mesurer** : relever les lignes `[tick-perf]` (tour, `scene.update`, mois, systèmes ECS) et le relevé du rendu (clic sur les graphes du HUD : `[render-load]`) | **Outil fait le 2026-11-07** (HUD corrigé, relevé par catégorie) ; **les mesures sont à prendre en jeu**. Avant toute optimisation de rendu ou de tour |
| **1** | Les plus gros problèmes **sans la pause** : ceux que l'étape 0 désigne (rendu, tour), en commençant par les pistes les moins risquées (§3.2, §3.3) | Décidé le 2026-11-07 : la pause n'est pas la première réponse |
| **2** | Regrouper les rafraîchissements d'ombres (§3.2) | Peu risqué ; à vérifier sur la mesure de l'étape 0 |
| **3** | Une seule lecture de `houses` par tour (§3.3) | Touche beaucoup de lecteurs (comptabilité, emploi, HUD) ; une lecture partagée doit rester **à jour** dans le tour |
| **4** | Instanciation des bâtiments et du terrain répétés, culling par mesh (§3.1) | Le gros chantier ; à lancer si l'étape 0 confirme que le rendu est le goulot |
| **5** | Tour découpé en tranches (§3.3), affichage immédiat du bâtiment (§3.4) | Après les étapes précédentes, si le retard persiste |
| **6** | **Pause de construction automatique** avec indicateur, activable dans Paramètres (« Construction en pause : permet d'optimiser les performances ») (§2) | Réglage complémentaire, pas la première réponse |

## 5. Vérification

- **Étape 0** : conserver les mesures **avant** (nombre de draw calls au même endroit de la carte, durées de tour) pour les comparer à chaque étape.
- **Pause de construction** : poser dix bâtiments d'affilée avec un tour lourd en cours ; chaque bâtiment s'affiche sans attendre le tour. Sortir du mode
  construction relance le jeu s'il tournait, pas s'il était déjà en pause.
- **Tests** (peu, essentiels, voir CLAUDE.md) : une règle de non-régression sur la reprise (« ne relance que si le jeu tournait »). Pas de test par libellé ni
  par réglage.
- **Mobile** : l'indicateur de pause et la barre de construction doivent tenir sur un téléphone (cibles de 40 px au moins, pas de défilement horizontal).

> **Suite (2026-11-11)** : l'affichage immédiat du bâtiment (§3.4) est commencé (`scene.update(..., { meshAt })`) et le balayage complet de la ville après chaque pose est
> traité dans `docs/plan/scene-update-incremental.plan.md`.

## 6. Ce que la mesure a dit, et ce qui a été fait (2026-11-07, même jour)

**La mesure** (relevé du rendu et lignes `[tick-perf]` pris en ligne sur une petite partie : 8 maisons, 9 lieux de travail, 25 jours).

- **Rendu : pas le problème.** 610 draw calls par image, 57 000 triangles, 481 meshes visibles dont 32 déjà instanciés. L'instanciation (étape 4) **n'est pas lancée** : son
  gain serait faible. À reprendre seulement si une grosse ville montre un nombre de draw calls en milliers.
- **Le tour de jeu est le goulot, et il grossit** : de 150 ms (jour 2) à 1,4 s (jour 25) pour une très petite ville. Les postes :
  - le **HUD** : 100 à 200 ms à chaque tour, dès le jour 2 (une dizaine de balayages complets de la table des bâtiments, pays et hameau) ;
  - `supply.monthlyResourceCycle`, étape `produce` : de 0,3 à 598 ms ;
  - `housing.evolution` : de 0,8 à 370 ms pour 8 maisons ;
  - la fin de mois (`budget`) : jusqu'à 600 ms (`houseRents` 280 ms, `producerCharges`, `monthBatchOverhead`).
- **Une erreur non rattrapée** à l'ouverture de la barre de construction (pastille « niv. N » de la banque centrale) : corrigée (`lowestHouseTierForWorkers(..., appointed)`).

**Décision du joueur-concepteur : on n'attend pas d'autre mesure** (rejouer est trop long, et les durées diffèrent d'un ordinateur à l'autre) : on optimise sur ce que le
code montre, par des corrections qui valent sur toute machine (moins de travail, pas de réglage à une durée).

**Fait, sans mesure d'après :**

1. **HUD hors du tour** : rafraîchi au plus toutes les 750 ms, hors du chemin du tour, avec un dernier rafraîchissement après la dernière demande (`coalescedRefresh.js`).
2. **Dépôt d'approvisionnement** (`DexieSupplyBuildingRepository.#activeRows`) : le test de rôle se fait sur les lignes *tenues*, et seules celles qui passent sont copiées
   (avant : **toutes** les lignes de la table copiées à chaque appel, des centaines de fois par jour). `listNaturalResources` (appelé à chaque producteur, sur tous les arbres
   et rochers) ne copie plus que le petit stock de chacun.
3. **`housing.evolution` dans une lecture unique de l'approvisionnement** (`supply.readOnce`) : par maison, l'accès aux entrepôts (`describeActivitySupplyAccess`) faisait
   plusieurs balayages complets de la table ; il lit maintenant les bâtiments une fois pour toute la passe.
4. **Mesures fines laissées en place** (`show-tick-perf`) : `[tick-perf] housing.evolution` (par étape) et `[tick-perf] role=…` (bâtiments les plus lents).

**Reste, non traité** (à reprendre sur lecture du code, sans exiger de rejouer) :

- La fin de mois : chaque `getJournalEntries()` copie et trie **tout** le journal (`SessionJournalStore`), appelé une quinzaine de fois par mois, et le journal grossit. Un cache
  invalidé à chaque écriture le rendrait gratuit, mais ses lignes sont partagées : il faut d'abord s'assurer qu'aucun appelant ne les modifie.
- Le journal, les flux privés et les transactions (`docs/logs`, 0,5 à 1 Mo après 25 jours) grossissent sans borne dans une partie : un coût qui monte avec le temps de jeu.
- La pause de construction automatique (étape 6 du §4) reste à faire, comme réglage complémentaire.
