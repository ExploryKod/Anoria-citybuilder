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

## Étape 2 — Harmoniser les noms (français métier) ✅

| Avant | Après |
|---|---|
| `BalanceSheetPanel` / `BalanceSheetPresenter` | `BilanPanel` / `BilanPresenter` |
| `CityMapPanel` / `CityMapPresenter` | `CarteVillePanel` / `CarteVillePresenter` |
| `RealtimeBudgetPanel` / `RealtimeBudgetPresenter` | `TresoreriePanel` / `TresoreriePresenter` |
| `*Section.js` (classe Presenter) | `*SectionPresenter.js` |

**Note :** le domaine accounting garde les noms EN (`BalanceSheet`, `RealtimeBudgetViewModel`, ACL `getBalanceSheet`). DOM shell bilan : `#bilan-panel` (étape 10) ; trésorerie live : `#realtime-budget-*` (inchangé).

---

## Étape 3 — Extraire les Presenters manquants ✅

Journal, CompteDeResultat, Prets, CarteVille, FoodTraceability (+ dead code supprimé).

---

## Étape 4 — Trancher `ConseilUrbainPanel` ✅

Code mort supprimé ; `#bilan-panel` = bilan uniquement.

---

## Étape 5 — Registry runtime cohérent ✅

**Réalisé :**
- Getters ACL : `getFinancesSectionPresenter`, `getCommerceSectionPresenter`, `getFactorySectionPresenter`, `getStorageSectionPresenter`, `getHealthSectionPresenter`, `getReportSectionPresenter` (+ `getWorkSectionPresenter`)
- Clés documentées dans `AppRegistry.js`
- `createAccountingContext` utilise les getters (plus de `getAppService('…SectionPresenter')` hors ACL)

**Reporté (DDD) :** ~~salary / taxe citoyenne hors lecture UI directe~~ → ✅ `LocalStorageFiscalSettingsRepository`

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
| Commerce `goodsData` sans lecture UI | ✅ BC via `LocalStorageCommerceRepository` |
| Salary / taxe hors SectionPresenters | ✅ `LocalStorageFiscalSettingsRepository` |
| `#budget-panel` → `#bilan-panel` (+ `#bilan-btn`, CSS `bilan-panel*.css`) | ✅ ; `#realtime-budget-*` / `#budget-states-*` inchangés |

---

## Correspondance écran joueur ↔ code

| Écran | DOM | Code |
|---|---|---|
| Panneau Administrateur | `#administrator-panel` | `src/ui/admin/` |
| Trésorerie temps réel | `#realtime-budget-panel` | `src/ui/compta/tresorerie/TresoreriePanel.js` |
| Bilan comptable | `#bilan-panel` | `src/ui/compta/bilan/BilanPanel.js` |
| Compte de résultat | `#budget-states-panel` | `src/ui/compta/compte-de-resultat/` |
| Livret (admin Finances) | `#admin-section-finances` | `src/ui/compta/livret/` + `src/ui/admin/finances/` |
| Prêts | `#loans-panel` | `src/ui/compta/prets/` |
| Journal | `#journal-panel` | `src/ui/compta/journal/` |
| Carte | `#city-map-panel` | `src/ui/carte-ville/CarteVillePanel.js` |
| Tutoriel / Objectifs | | `src/ui/onboarding/` |

---

## Suite possible

1. Clarifier `presentation/three` vs `infrastructure/` (hors UI)
2. Optionnel : `#budget-states-panel` → nom FR compte de résultat ; classes contenu `.budget-item`
