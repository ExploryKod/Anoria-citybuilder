# Plan — `scene.update` incrémentale : une pose ne doit plus refaire le travail de toute la ville

Statut : **à faire** (étapes 0 à 3 ci-dessous). Écrit le 2026-11-11, à partir d'un relevé `[tick-perf]` du joueur-concepteur et de la lecture de `scene.js`,
`roleStatusSprites.js` et du contexte Parcels. Les points marqués **À trancher** attendent une décision. Ce plan complète `docs/plan/performance.plan.md`
(§3.4 « afficher le bâtiment tout de suite », étape 5) : il en reprend le principe et le pousse jusqu'au bout.

**Ce qui est établi et ce qui ne l'est pas.** Les durées viennent d'un relevé en ligne sur une très petite ville (324 cases, une vingtaine de bâtiments, mode
construction). L'extrapolation « environ 2 ms de plus par bâtiment » est une **estimation** tirée de ce relevé, pas une mesure sur une grande ville.

## 1. Le constat

Chaque pose déclenchait un `scene.update` **complet** : une boucle sur les 324 cases, puis une boucle sur les maisons, puis des lectures de toute la table des
bâtiments. Le relevé de 14 poses d'affilée (mode construction) :

| Section de `scene.update` | 1re pose | dernières poses | Dépend d'une pose ? |
|---|---|---|---|
| `population` | 1–13 ms | 1–6 ms | **Non** : `totalPop` est lu (`scene.js`, début de la boucle) mais jamais utilisé |
| `tiles` (324 cases) | 25 ms | 43–55 ms | Seulement pour la case posée |
| `roleSprites` (1 appel par bâtiment) | 0 ms, 8 appels | 26 ms, 23 appels | **Non** : dépendent du **jour** (`ctx.time`, saison, ravitaillement), pas d'une pose |
| `houseRoadIcons` (un recalcul par maison) | 6 ms | 20 ms | **Redondant** : voir ci-dessous |
| `cleanup` + `naturePieces` + `listRows` | 5–10 ms | 5–10 ms | **Non** : relisent toute la table |
| `placeMesh` (324 appels) | 3–5 ms | 3–5 ms | Oui, et c'est déjà peu |
| **Total d'une mise à jour** | ~45 ms | ~80–90 ms | |

Le nombre d'appels de `roleSprites` suit le nombre de bâtiments : **chaque mise à jour refait le travail de tous**, alors que seul le nouveau bâtiment a changé. Le
coût d'une pose croît avec la ville (environ 2 ms par bâtiment : 150 bâtiments donneraient plus de 300 ms à chaque pose, **estimation**).

**Pourquoi `houseRoadIcons` est redondant.** `parcels.syncPlacedBuilding` (`PlaceBuilding`) appelle `RecalculateAllRoadAccess` après **chaque** pose : l'accès routier de
**tous** les bâtiments est recalculé (deux lectures, puis du calcul en mémoire) et `parcels.RoadAccessChanged` est publié pour chaque bâtiment dont l'accès change.
`roadAccessIcons.js` écoute cet événement et met l'icône à jour, à condition que la vue du mesh soit enregistrée (`views.set`). Le recalcul maison par maison de la
mise à jour complète ne fait donc que refaire ce que l'événement a déjà fait.

## 2. Déjà fait (2026-11-11)

- **Affichage immédiat** : `scene.update(city, time, { meshAt: { x, y } })` ne dessine que le mesh de la case posée (et synchronise ses parcelles), dans la même file que
  les mises à jour complètes. Appelé juste après le paiement par les trois poses de `game.js` (bâtiment seul, maisons/champs glissés, route).
- **Mode construction** : le balayage complet est **reporté à la sortie du mode** (`settlePendingChanges`) pour les bâtiments, maisons et champs. Il reste fait après un
  tracé de route (une route change les icônes « sans route » des maisons voisines) et après une démolition.
- Hors de ce plan, mais mêmes causes de lenteur : pick de survol limité aux zones traversées par le rayon, culling par zone avec boîtes en cache, stades de culture
  inactifs masqués (`kenneyFarmFieldAdapter.js`).

## 3. Étapes (chacune livrable et mesurable seule)

| Étape | Contenu | Remarque |
|---|---|---|
| **0** | **Gains sans risque.** (a) Retirer la lecture inutile `housing.getCityPopulationSummary()` (`totalPop` n'est jamais lu) **après avoir vérifié qu'elle n'a aucun effet de bord**. (b) `houseRoadIcons` : au lieu de recalculer chaque maison, n'enregistrer la vue de l'icône (`syncRoadAccess`) que pour les maisons dont le mesh est **nouveau** (un ensemble, comme `employeesSchemaChecked`), et laisser l'événement Parcels faire le reste | Un seul `syncRoadAccess` par mesh nouveau, pour l'état initial : l'événement ne part que quand le compte de routes change, une vue enregistrée après coup resterait périmée |
| **1** | **Passe de pose ciblée** (le gros gain). Étendre `meshAt` en vraie passe pour **un** bâtiment : après le dessin, seulement pour ce bâtiment, `ensureBuildingEmployeesSchema`, `syncResidentialHouseMeshFromDb` (maisons), `applyRoleStatusSprites`, `syncRoadAccess`, vue de ravitaillement de la maison. **Aucune** section globale (`listRows`, `cleanup`, `naturePieces`, `population`). Les trois poses de `game.js` l'utilisent au lieu du `scene.update` complet, **aussi pour les routes** (l'événement Parcels met à jour les maisons voisines) | Le balayage complet reste à la sortie du mode construction, à la démolition et au tour. Exclure le mode éditeur (`usesEditorLikePresentation`) |
| **2** | **Le tour** (`sceneBefore` / `sceneAfter`, 20–30 ms chacun, en croissance). Seul le jour change vraiment les sprites : le balayage y est légitime, on le rend moins coûteux. Une lecture groupée des vues de ravitaillement au lieu d'une par maison (`houseSupplyView`, environ 2 ms par appel) ; ne pas refaire les sprites d'un bâtiment dont la vue n'a pas changé | À faire **après** l'étape 1, d'après la mesure |
| **3** | **La présentation de l'emploi** (`refreshEmploymentPresentation`, qui boucle aussi sur tous les bâtiments) n'est pas dans le relevé. Ajouter un `lap` pour la mesurer **avant** d'y toucher | Mesurer d'abord |

## 4. Cible et vérification

- Une pose hors mode construction passe de ~90 ms (à 23 bâtiments, en croissance) à un coût **constant**, de l'ordre de 10 ms.
- Avec `show-tick-perf` : plus de ligne `scene.update` complète à chaque pose, et plus de croissance avec le nombre de bâtiments. Garder le relevé **avant** (ci-dessus) pour
  comparer.
- Poser une maison à côté d'une route, puis une route vers une maison isolée : l'icône « sans route » apparaît et disparaît comme avant.
- Poser un champ de 2×2 (plusieurs cases, un seul mesh à la case d'origine) : un seul mesh, pas de doublon après le balayage complet de la sortie du mode construction.
- **Tests** (peu, essentiels, voir CLAUDE.md) : au plus une règle de non-régression, **une passe ciblée suivie d'un balayage complet ne crée pas de mesh en double**. `scene.js`
  n'a presque pas de harnais de test : si le test ne peut pas se faire sans monter toute la scène, le dire plutôt que de l'inventer.

## 5. Risques

- **Icônes périmées** si l'événement Parcels part avant l'enregistrement de la vue : d'où le `syncRoadAccess` initial de l'étape 0 (b).
- **Bâtiments de plusieurs cases** : seule la case d'origine porte le mesh (`placeTileMeshIfNeeded`) ; à vérifier sur un champ.
- **Un bâtiment dont la pose en change d'autres** (un hub, un distributeur) : leurs sprites dépendent du ravitaillement, pas de la pose ; les liens sont déjà refaits par
  `syncSupplyLinksAfterBuildingChange` et `refreshPlacementPresentation`. À confirmer avec un hub posé près de maisons.
- **Démolition** : hors périmètre, elle garde le balayage complet (la boucle retire le mesh).

## 6. À trancher

1. **Périmètre** : étapes 0 et 1 seulement (les poses), ou aussi l'étape 2 (le tour) ? Recommandation : 0 et 1, puis mesurer.
2. **Mode construction** : une fois la passe ciblée faite, les icônes d'un bâtiment posé (« sans route », « sans travailleur ») pourraient s'afficher **tout de suite** pendant la
   construction, pour un coût minime, au lieu d'attendre la sortie du mode. Recommandation : oui.
