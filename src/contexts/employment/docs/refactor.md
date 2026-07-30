# Employment — notes d’architecture

Historique des slices DDD. **Comportement actuel** : [`presentation.md`](presentation.md) (source de vérité UI).

---

## Statut

| Slice | Description | Statut |
|---|---|---|
| A | `GetCityEmploymentSummary` + barre d’état / work-section | ✅ |
| B | ECS `employment.redistribute` dans le pipeline | ✅ |
| C | Redistribution après `housing.evolution` (même tick ECS) | ✅ |
| D | `syncEmploymentAfterBuildingChange` (placement / bulldoze poste) | ✅ |
| E | Présentation : no-work uniquement via `refreshEmploymentPresentation` ; Supply découplé ; entry points `game.js` | ✅ |

---

## Slice E (présentation consolidée)

**Résolu** : `scene.update` utilisait autrefois `housesStore.getHouse` en parallèle de `GetCityEmploymentSummary`. Désormais : Employment BC read model + ACL Construction.

**Changement** :

1. Suppression des blocs no-work marché / moulin / ferme / usine dans `scene.update`.
2. `refreshEmploymentPresentation` = seule poseur d’icônes emploi.
3. Sprites Supply (`isBuying`, saisons ferme…) restent dans `scene.update` ; gating staff via `GetBuildingSupplyView` + `OperationalGatePolicy`.
4. Helpers `game.js` : `refreshEmploymentPresentationForCity`, `runSimulationPass`, `runScenePresentationPass`.

---

## Invariants presentation (post slice E)

- Une seule formule `understaffed` : `worker === 0 && workerNeed > 0 && roadCount > 0`.
- `lack` (manque barre) ≠ condition icône (sous-effectif partiel sans icône).
- ACL : `src/js/**` → Employment via `acl/employment.js` uniquement.

Voir [`presentation.md`](presentation.md) pour les flux complets.
