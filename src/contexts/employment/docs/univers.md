# Règle métier (Employment bounded context)

À chaque tour de redistribution (mensuel), le bounded context **Employment** remplit les bâtiments qui peuvent employer des travailleurs à partir de la main-d'oeuvre disponible dans les maisons.

## 1. Source de main-d'oeuvre
- Seules les **maisons** qui ont un **accès routier** (`roadCount > 0`) contribuent au pool.
- Le pool de main-d'oeuvre augmente de `pop` (population) pour chaque maison contributrice.

## 2. Postes à pourvoir
- Un **poste** est un bâtiment **non-maison** et **non-route** avec `workerNeed > 0`.
- Les postes doivent aussi avoir `roadCount > 0` (sinon ils sont ignorés).

## 3. Redistribution (gloutonne par priorité)
1. On réinitialise d'abord tous les postes : `employees.worker = 0` (en conservant `workerNeed` et `sector`).
2. On trie les postes par **priorité de secteur** (priorité **1 = la plus haute**, puis 2, 3, ...).
   - Le `sector` appartient au snapshot du bâtiment ; la correspondance `sector -> priorité` vient de l’extérieur (priorités admin en `localStorage`).
3. Pour chaque poste dans l’ordre :
   - on affecte `workers = min(workerNeed - worker, workersRemaining)`
   - on n’affecte jamais plus que `workerNeed`
   - dès que le pool est épuisé, on s’arrête.

## 4. Définition importante (présentation)
- `workerNeed`/`worker` décrivent le **niveau de staffing des postes**.
- “chômage” (main-d'oeuvre non utilisée) est une **autre métrique** calculée à partir du pool vs la somme des `employees.worker`. Les deux ne doivent pas être confondus.
