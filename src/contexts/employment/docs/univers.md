# Règle métier (Employment bounded context)

À chaque **tick de simulation** (un mois en jeu), le bounded context **Employment** remplit les postes à partir de la main-d'œuvre disponible dans les maisons routées.

Présentation UI / icônes : [`presentation.md`](presentation.md).  
Règles détaillées (pool, chômage, manque) : [`rules.md`](rules.md).

## 1. Source de main-d'œuvre

- Seules les **maisons** avec **`roadCount > 0`** contribuent au pool.
- Pool ouvrier = Σ **citoyens** (`LaborPoolPolicy.workerPopFromHouse`) — élites exclues.

## 2. Postes à pourvoir

- Bâtiment **non-maison**, **non-route**, `workerNeed > 0`.
- **Fermes** : embauche **sans route**.
- **Autres postes** : `roadCount > 0` requis.

## 3. Redistribution (gloutonne par priorité)

1. Reset : `employees.worker = 0` sur tous les postes.
2. Tri par priorité secteur (**1 = la plus haute** ; config + localStorage).
3. Affectation : `min(déficit, pool restant)` jusqu'à épuisement du pool.

## 4. Métriques (read model)

- **Chômage** = citoyens non assignés (`workerPool − totalAssigned`).
- **Manque** = déficit sur les postes (`Σ max(0, need − worker)`).
- **Icône no-work** = poste routé avec **`worker === 0`** uniquement (pas sous-effectif partiel).

Ne pas confondre chômage et manque — voir [`rules.md`](rules.md) §5.
