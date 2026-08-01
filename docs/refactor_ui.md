# Refactor UI — plan par étapes

Objectif : aligner l’arborescence et le vocabulaire du code UI sur les écrans du jeu, avec des noms explicites pour les non-développeurs, et une séparation claire **Panel** (câblage DOM) / **Presenter** (rendu) / **Manager** (vrai coordinateur d’état).

Branche de travail : `refactor/on-ecs-ddd--stores-dependencies`

---

## Convention de nommage (cible)

| Rôle | Suffixe | Exemples |
|---|---|---|
| Popup / modale : init, événements, chargement données | `*Panel.js` | `JournalPanel`, `PretsPanel`, `BilanPanel` |
| Rendu pur (view model → DOM) | `*Presenter.js` | `BilanPresenter`, `CityLedgerPresenter` |
| Section admin : classe interne | `*SectionPresenter` | `FinancesSectionPresenter` |
| Coordinateur d’état (pile modales, temps, assets…) | `*Manager.js` | `PopupManager`, `TimeManager` |

**Manager** ne doit pas désigner un simple presenter DOM.

---

## Structure actuelle `src/ui/`

```
src/ui/                         ← hissé hors de src/js/ (js/ = acl + utils)
  admin/
    AdministratorPanel.js
    initAdminSections.js        ← importe uniquement init*Section.js
    finances/ health/ work/ storage/ factory/ commerce/ report/
    food-traceability/
  compta/
    tresorerie/ bilan/ compte-de-resultat/ livret/ prets/ journal/
  carte-ville/
  boot/
  tools/
  onboarding/                   ← TutorialPanel, ObjectivesPanel, tracker, history
  parametres/                   ← ParametersPanel
  shell/                        ← PopupManager, nodes, animations, mobile-controls
  buttons.js
```

`src/js/` ne contient plus que `acl/` et `utils/`.

---

## Étape 0 — Terminé ✅

**Commits :**
- `81eca4a` — regrouper l’UI par domaines métier (`admin/`, `compta/`, `carte-ville/`, `conseil-urbain/`)
- `4110b6f` — renommer les `*Manager` UI en `*Panel` / `*Presenter` (fichiers)

---

## Étape 1 — SectionPresenter ✅

Classes admin `*SectionManager` → `*SectionPresenter`, clés registry, ACL.

---

## Étape 2 — Harmoniser les noms (français métier) — **reportée**

| Actuel | Cible proposée |
|---|---|
| `BalanceSheetPanel` / `BalanceSheetPresenter` | `BilanPanel` / `BilanPresenter` |
| `CityMapPanel` | `CarteVillePanel` |
| `RealtimeBudgetPanel` | `TresoreriePanel` |

---

## Étape 3 — Extraire les Presenters manquants ✅

Journal, CompteDeResultat, Prets, CityMap, FoodTraceability (+ dead code supprimé).

---

## Étape 4 — Trancher `ConseilUrbainPanel` ✅

Code mort supprimé ; `#budget-panel` = bilan uniquement.

---

## Étape 5 — Registry runtime cohérent ✅

**Réalisé :**
- Getters ACL : `getFinancesSectionPresenter`, `getCommerceSectionPresenter`, `getFactorySectionPresenter`, `getStorageSectionPresenter`, `getHealthSectionPresenter`, `getReportSectionPresenter` (+ `getWorkSectionPresenter`)
- Clés documentées dans `AppRegistry.js`
- `createAccountingContext` utilise les getters (plus de `getAppService('…SectionPresenter')` hors ACL)

**Reporté (DDD) :** salary / taxe citoyenne hors lecture UI directe.

---

## Étape 6 — Tutorial / objectives ✅

- `TutorialPanel` → clé `tutorialManager`
- `ObjectivesPanel` → clé **`objectivesManager`** (plus de collision)
- `getObjectivesManager()` ; tracker / history branchés correctement

---

## Étape 7 — Uniformiser les sections admin ✅

Chaque section a `init{Domaine}Section.js` ; `initAdminSections.js` n’importe que des `init*.js` (+ `AdministratorPanel`).

---

## Étape 8 — Meta UI + hoist `src/ui` ✅

- Dossiers `onboarding/`, `parametres/`, `shell/`
- `src/js/ui` → `src/ui`

---

## Étape 9 — Documentation ✅

Ce fichier + chemins majeurs accounting / FINANCIAL_DATA_SOURCE_OF_TRUTH.

---

## Étape 10 — Dette technique (partiel)

| Issue | Statut |
|---|---|
| Taux prêt via `LoanRatePolicy` | ✅ déjà en place |
| `BuildingBreakdownEnrichment.js` | enrichissement UI bilan (pas de rename) |
| `#budget-panel` → `#bilan-panel` | **reporté** (breaking DOM/CSS) |
| Commerce `goodsData` sans global | **reporté** (lot DDD Commerce) |

---

## Correspondance écran joueur ↔ code

| Écran | DOM | Code |
|---|---|---|
| Panneau Administrateur | `#administrator-panel` | `src/ui/admin/` |
| Trésorerie temps réel | `#realtime-budget-panel` | `src/ui/compta/tresorerie/` |
| Bilan comptable | `#budget-panel` | `src/ui/compta/bilan/` |
| Compte de résultat | `#budget-states-panel` | `src/ui/compta/compte-de-resultat/` |
| Livret (admin Finances) | `#admin-section-finances` | `src/ui/compta/livret/` + `src/ui/admin/finances/` |
| Prêts | `#loans-panel` | `src/ui/compta/prets/` |
| Journal | `#journal-panel` | `src/ui/compta/journal/` |
| Carte | `#city-map-panel` | `src/ui/carte-ville/` |
| Tutoriel / Objectifs | | `src/ui/onboarding/` |

---

## Suite possible

1. Étape 2 — renames FR
2. Étape 10 restante — DOM bilan + Commerce goodsData
3. Clarifier `presentation/three` vs `infrastructure/` (hors UI)
