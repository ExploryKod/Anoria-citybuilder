# Rust/WASM, performance de la simulation et modes de jeu (en ligne / hors-ligne)

Note de réflexion (2026-10-25). Ce n'est pas une décision : c'est l'état de l'analyse, pour la retrouver. Les
chiffres de performance ne sont pas mesurés ; voir « Prochaines étapes ».

Voir aussi : `MULTIPLAYER_ARCHITECTURE.md`, `INTEGRATION_MULTIPLAYER.md` (le serveur WebSocket et ses options),
`../hosting/HOSTING_WEBSOCKET.md`, `../optimization/OPTIMISATION_THREEJS_WEBGL.md`.

Note sur l'existant : le dossier `server/` et les documents multijoueur ci-dessus viennent d'une **ancienne tentative**,
un multijoueur **sur le même hameau** (plusieurs joueurs dans une même scène). Ce n'est pas le cadrage de cette note
(un hameau comme unité de simulation et de scène, des villes ou des hameaux qui échangent). Ils servent de point de
départ technique (WebSocket, déploiement), pas de conception à reprendre telle quelle.

## 1. Le problème posé

JS tourne sur un seul thread. Le tick (un jour) enchaîne simulation ECS, économie, persistance et HUD ; il est lié au
calcul (voir la mémoire « game speed fast-forward deferred »). Les hameaux limitent les meshes par scène, mais pas le
coût de simulation : il croît avec le nombre total de hameaux.

Constat : pour un city builder, le moteur de rendu limite rarement ; la simulation, si.

## 2. Three.js + Phaser face à Godot

- Rendu : Three.js (WebGPU) tient bien des dizaines de milliers de bâtiments avec `InstancedMesh`/`BatchedMesh`, LOD et
  culling. Godot offre davantage « clé en main », sans écart décisif.
- Phaser est 2D : il n'apporte rien au rendu 3D et ajoute une seconde boucle à synchroniser. Optionnel si l'interface est en DOM.
- Simulation : GDScript n'est pas plus rapide que du JS optimisé. Le gain de Godot vient de C#/C++/Rust et de vrais threads.
- Distribution : le web est instantané mais limité (mémoire du navigateur, quotas IndexedDB). L'export web de Godot est lourd.

## 3. Les hameaux comme partition

Un hameau = une unité de scène (bornes de meshes) et d'état (la comptabilité est déjà par `hamletId`). Limite : la
simulation des hameaux dormants. Piste : un mode « dormant » qui simule en agrégé ou moins souvent, en produisant les
mêmes écritures du journal (une seule source de valeur).

## 4. Rust via WebAssembly dans le navigateur

Architecture type : un Web Worker héberge le module WASM et fait tourner le tick ; le thread principal ne fait que
Three.js et l'interface, en lisant des tableaux typés dans une mémoire partagée.

- À déporter : pathfinding et accessibilité routière, moteur de flux du `supply`, fold du journal.
- À garder en JS : IndexedDB, DOM, Three.js.
- Contraintes : `SharedArrayBuffer` exige les en-têtes COOP/COEP ; avec une mémoire WASM partagée, toute la mémoire est
  partagée ; la frontière JS↔WASM coûte cher si les appels sont fins (appels grossiers, tableaux typés).
- Go en WASM navigateur : binaire lourd, pas de parallélisme réel, interop plus lente. Peu adapté.

## 5. Notre architecture DDD facilite-t-elle la migration ?

Oui pour les coutures, non pour le format des données.

- Pour : politiques de domaine pures sur données simples (`WorkerAllocationPolicy`, 17 politiques du `supply`), dépôts
  comme ports, racine de composition `src/composition/`, ECS et boucle dans `src/engine/`.
- Contre : le chemin chaud est asynchrone et lié aux dépôts ; les données sont des objets à identifiants chaînes, pas des
  tableaux denses ; granularité de politique trop fine pour traverser une frontière WASM ; une dizaine de fichiers de
  `contexts/` importent de l'infrastructure ou de la présentation.

## 6. Première couture évaluée : `DistributeCityWorkers`

`execute()` se coupe déjà en lecture (dépôts) / calcul pur (glouton déterministe) / écriture (`saveWorkers`,
`saveWorkerSources`). Entrées entières possibles : maisons (indice, population, profil), lieux de travail (indice,
`workerNeed`, compétence, niveau), table de qualification précalculée, ordre des compétences.

Mais gain de performance probablement faible :
- les écritures (deux `await` IndexedDB par lieu de travail) dominent sans doute ; les regrouper en un lot est un gain JS ;
- `qualifyingSources` refiltre toutes les maisons à chaque appel (coût en affectations × maisons) ; une mémoïsation par
  `(compétence, niveau)` suffit ;
- l'échelle (quelques centaines de maisons) est modeste ; la cadence d'appel réelle est à vérifier.

À réserver à Rust : moteur de flux du `supply`, pathfinding, fold du journal. `DistributeCityWorkers` ne vaut que comme
pilote pour apprendre la chaîne (build WASM avec Vite, worker, tableaux typés, test de parité JS/Rust).

**Mesuré le 2026-10-25** (détails : `../plan/upgrade_perf_oct25.md`, section 2 bis) : le calcul de `DistributeCityWorkers`
prend 0,1 à 0,4 ms, la lecture et l'écriture 20 à 40 ms chacune. La couture est écartée. Sur une ville de 57 bâtiments, le jour
coûte ~1,4 s, dont `supply.monthlyResourceCycle` à 325 ms par tick : c'est lui, et les deux `scene.update`, qu'il faut regarder
d'abord, en JS, avant toute question de Rust.

## 7. Ce qui existe ailleurs (recherche)

Aucun projet trouvé ne reproduit exactement « simulation locale en Rust/WASM dans un worker + Three.js ».

- Voxelize : serveur Rust natif ; seul le mesher est compilé en WASM dans le navigateur ; client Three.js ; pas de chiffres.
- threers : portage de l'API Three.js en Rust (wgpu), v0.0.8 ; ne répond pas au besoin.
- Realm of Echoes : Three.js + logique de jeu Rust/WASM **côté serveur** (Cloudflare Workers) ; pas de chiffres ni de code.
- Citybound, Traffloat, utopia : simulations de ville en Rust (actifs ou non, détails non vérifiés).
- Dustline, Autopolis : Three.js avec cœur de simulation déterministe séparé, en TypeScript.
- Technique : <https://web.dev/articles/webassembly-threads> et <https://tweag.io/blog/2022-11-24-wasm-threads-and-messages/>
  (mémoire partagée, pièges de `wasm-bindgen`, `postMessage` sous Firefox).

## 8. Le VPS change la question : où tourne la simulation ?

| Modèle | La simulation tourne | Le serveur sert à | Coût |
|---|---|---|---|
| A. Client autoritaire | navigateur (JS ou Rust/WASM en worker) | sauvegarde, échanges | faible |
| B. Serveur autoritaire | VPS (Rust ou Go natif) | tout : état, règles, validation | le CPU de chaque ville simulée est à notre charge |
| C. Hybride | un noyau Rust, natif sur le VPS et WASM chez le joueur | les deux | un seul code de règles, plus d'outillage |

- Un tour est un jour : pas de contrainte temps réel, donc Go serveur est viable (pauses du ramasse-miettes invisibles).
- L'argument fort de Rust est le modèle C (un seul noyau compilé aux deux endroits) ; Go n'offre pas cela.
- Le hameau est l'unité naturelle de découpage serveur (une goroutine ou une tâche par hameau).
- Un serveur autoritaire déplace le coût du CPU des joueurs vers le VPS.
- Le journal et le fold passent d'IndexedDB à une base serveur ; le client lit des instantanés ou des diffs.

## 9. Deux modes (en ligne / hors-ligne) : un cœur, deux enveloppes

Ne pas écrire les règles deux fois (comptabilité, emploi, approvisionnement, calendrier) : elles divergeraient, et la
comptabilité en partie double ne le supporte pas. Séparer les **enveloppes**, pas les règles :

- hors-ligne : adaptateurs IndexedDB (Dexie) ;
- en ligne : adaptateurs SQL et WebSocket sur le VPS ;
- les ports existants (`EmploymentBuildingRepository`, `SupplyBuildingRepository`, le journal en écriture directe) sont
  déjà la jonction.

Voie la moins coûteuse : faire tourner le même code JS sur le VPS (Node ou Bun) avec des adaptateurs SQL. Réserves : les
fichiers de `contexts/` qui importent de l'infrastructure ou de la présentation, et tout accès direct aux API du
navigateur. Rust viendrait ensuite, seulement si la mesure le justifie, comme noyau compilé aux deux endroits.

## 10. Sauvegarde portable entre les deux modes

Le joueur doit pouvoir passer d'un mode à l'autre avec sa partie. Il faut une **archive portable**, indépendante de la
base : le journal d'écritures, les prêts, l'horloge (`gameSettings`/`clock`, avec `daysPerMonth` figé à la création),
l'état des bâtiments et des hameaux. Le prefab `anoria-tour-107` (cinq exports pris ensemble par « Tout télécharger » en pause) en couvre l'essentiel : la ville, les deux journaux, les transactions et les relations.

Règle du projet : aucune sauvegarde ancienne à migrer. Les deux modes tournent sur la même version du cœur ; une archive
d'une version inconnue est refusée explicitement, jamais réparée à la volée. L'archive doit donc être versionnée.

## 10 bis. Décision (2026-10-25) : le CPU de simulation reste chez le joueur

Contrainte : projet de loisir, budget serré. Un serveur de jeu qui simule toutes les parties coûterait de l'ordre de
200 €/mois (bare metal) : exclu. Retenu :

- **Multijoueur** : monde partagé de hameaux, et villes individuelles qui échangent. Pas de « plusieurs joueurs dans le
  même hameau en temps réel ».
- **Modèle A (client autoritaire)** : chaque client simule ses propres hameaux (JS aujourd'hui, Rust/WASM en worker plus
  tard si la mesure le justifie). Le modèle B (serveur autoritaire) et le noyau natif sur le VPS sont écartés.
- **Rôle du VPS (petit, upgradable)** : comptes, stockage des archives de sauvegarde (section 10), relais WebSocket des
  échanges entre joueurs, état partagé léger (offres, commandes, prix, événements du monde). Aucun tour de jeu n'y est simulé.
- **Échanges entre hameaux** : asynchrones et agrégés, jamais une synchronisation fine à chaque tour. Chaque côté les
  inscrit au journal comme n'importe quelle écriture (une seule source de valeur).
- **Triche** : acceptée comme risque d'un jeu de loisir. Contrôles peu coûteux côté serveur : écritures équilibrées,
  bornes plausibles, versions d'archive connues ; une vérification par rejeu d'un échantillon de parties reste possible
  hors ligne, à la demande, sans simulation permanente.
- **Conséquence pour Rust** : il n'est plus lié au serveur. Son intérêt se limite à la performance de la simulation dans
  le navigateur ; le modèle C (même noyau natif et WASM) perd son avantage principal. Go ne sert qu'à un éventuel relais.

## 11. Prochaines étapes (ordre recommandé)

1. Instrumenter le tick (`performance.now()` autour de la lecture, du calcul et de l'écriture ; ECS, économie, HUD) sur le
   prefab `anoria-tour-107`, pour savoir où part le temps.
2. Corrections JS évidentes : mémoïser les sources qualifiantes, regrouper les écritures en un lot.
3. Définir l'archive de sauvegarde portable et vérifier ce que l'export du prefab couvre déjà.
4. Valider le mode en ligne en faisant tourner le cœur sous Node avec un adaptateur SQL minimal.
5. Seulement si une charge de calcul le justifie : un premier module Rust (flux du `supply`, pathfinding ou fold du
   journal), derrière la même interface, avec un test de parité JS/Rust.

Questions ouvertes : multijoueur en monde partagé ou villes individuelles qui échangent ? Solo hors-ligne à conserver ?
