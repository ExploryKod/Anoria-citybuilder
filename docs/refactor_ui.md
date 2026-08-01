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

## Structure cible `ui/`

```
ui/
  admin/                    ← Panneau Administrateur (César 3)
    AdministratorPanel.js
    initAdminSections.js
    finances/  health/  work/  storage/  factory/  commerce/  report/
    food-traceability/
  compta/
    tresorerie/             ← encart trésorerie temps réel
    bilan/                  ← Bilan comptable
    compte-de-resultat/     ← Compte de résultat
    livret/                 ← Livret ville (admin → Finances)
    prets/
    journal/
  carte-ville/
  conseil-urbain/           ← à trancher (voir étape 4)
  boot/
  tools/
  …                         ← meta UI à regrouper (étape 8)
```

---

## Étape 0 — Terminé ✅

**Commits :**
- `81eca4a` — regrouper l’UI par domaines métier (`admin/`, `compta/`, `carte-ville/`, `conseil-urbain/`)
- `4110b6f` — renommer les `*Manager` UI en `*Panel` / `*Presenter` (fichiers)

**Réalisé :**
- Panneau admin sous `ui/admin/` + point d’entrée `initAdminSections.js`
- Compta éclatée : `tresorerie/`, `bilan/`, `compte-de-resultat/`, `livret/`, `prets/`, `journal/`
- Renommages fichiers : `RealtimeBudgetPanel`, `CompteDeResultatPanel`, `JournalPanel`, `PretsPanel`, `ConseilUrbainPanel`, `FoodTraceabilityPanel`, `CommerceSection.js`
- Split Panel/Presenter pour trésorerie et bilan
- 627 tests verts

---

## Étape 1 — Commit du lot SectionPresenter ⏳

**Statut :** modifié, non commité.

**Contenu :**
- Classes admin : `*SectionManager` → `*SectionPresenter`
- Clés registry : `financesSectionPresenter`, `workSectionPresenter`, etc.
- ACL : `getWorkSectionManager()` → `getWorkSectionPresenter()`
- `ParametersPanelManager` → `ParametersPanel` (`parametersPanel`)
- Tests : `globals.test.js`, `salaryIdempotence.behavior.test.js`

**Critère de done :** commit + push, 627 tests verts.

---

## Étape 2 — Harmoniser les noms (français métier)

**Problème :** mélange français / anglais dans les fichiers.

| Actuel | Cible proposée |
|---|---|
| `BalanceSheetPanel` / `BalanceSheetPresenter` | `BilanPanel` / `BilanPresenter` |
| `CityMapPanel` | `CarteVillePanel` |
| `RealtimeBudgetPanel` | `TresoreriePanel` (ou garder si DOM `#realtime-budget-*`) |
| `FinancesSection.js` + classe `FinancesSectionPresenter` | fichier `FinancesSectionPresenter.js` ou dossier `finances/FinancesSection.js` cohérent |

**Critère de done :** une seule langue de nommage fichiers/classes UI ; imports et tests mis à jour.

---

## Étape 3 — Extraire les Presenters manquants

**OK aujourd’hui :** `bilan/`, `tresorerie/`, `livret/`

**Monolithiques à éclater :**

| Fichier | Action |
|---|---|
| `JournalPanel.js` | extraire `JournalPresenter.js` (`renderGeneralLedger`, formatage lignes) |
| `CompteDeResultatPanel.js` | extraire `CompteDeResultatPresenter.js` |
| `PretsPanel.js` | extraire `PretsPresenter.js` |
| `CarteVillePanel.js` | extraire `CarteVillePresenter.js` |
| `FoodTraceabilityPanel.js` | extraire `FoodTraceabilityPresenter.js` |
| Sections admin (`FactorySection.js`, etc.) | presenter dédié ou split progressif par onglet |

**Critère de done :** chaque popup/compta suit le couple Panel + Presenter ; Panels < ~200 LOC de rendu inline.

---

## Étape 4 — Trancher `ConseilUrbainPanel` ⚠️ bug latent

**Problème :** `ConseilUrbainPanel` et `BalanceSheetPanel` accrochent tous deux `#budget-btn` / `#budget-panel`, alors que le HTML de `#budget-panel` affiche le **Bilan comptable**. Le conseil urbain cible des éléments DOM absents (`#red-houses`, `.budget-tab`, …).

**Options :**
1. **Supprimer** `conseil-urbain/` + `initUrbanAdviceCenter()` si feature abandonnée
2. **Restaurer** un panneau dédié `#conseil-urbain-panel` + bouton toolbar séparé

**Critère de done :** un seul listener par bouton ; plus de code mort sur `#budget-panel`.

---

## Étape 5 — Registry runtime cohérent

**Problème :**
- Seul `getWorkSectionPresenter()` existe ; les autres clés passent par `getAppService('…')` ad hoc
- `commerceSectionPresenter` enregistré sans getter ACL
- Le BC comptable lit l’UI (`citizenTaxAmount`, `salary`) via le registre → coupling inverse

**Actions :**
1. Getters ACL symétriques : `getFinancesSectionPresenter()`, `getCommerceSectionPresenter()`, …
2. Documenter les clés registry UI dans `AppRegistry` ou `appRuntime.js`
3. (Plus tard) migrer salary / taxe citoyenne vers persistance domaine, plus lecture directe UI

**Critère de done :** plus d’accès `getAppService('…SectionPresenter')` dispersé hors ACL.

---

## Étape 6 — Corriger tutorial / objectives

**Problème :** `tutorial.js` et `objectives.js` enregistrent tous deux `registerAppService('tutorialManager', …)` ; le second écrase le premier. `ObjectivesManager` → clé `tutorialManager` incohérente.

**Actions :**
1. Clés distinctes : `tutorialManager`, `objectivesManager`
2. Renommer classes / fichiers : `TutorialPanel`, `ObjectivesPanel` (ou Presenter selon rôle)
3. Mettre à jour `appRuntime.js`, `ObjectivesTracker`, `objectives-history.js`

**Critère de done :** plus de collision registry ; noms alignés convention étape 0.

---

## Étape 7 — Uniformiser les sections admin

**Problème :** commerce a `CommerceSection.js` + `initCommerceSection.js` ; les autres sections sont monolithiques (`FinancesSection.js`, …).

**Actions :**
1. Pattern unique : `{domaine}/{Domaine}SectionPresenter.js` + `init{Domaine}Section.js` **ou** tout dans un fichier par section (comme aujourd’hui) mais nom de fichier = `{Domaine}SectionPresenter.js`
2. `initAdminSections.js` importe uniquement des `init*.js`

**Critère de done :** même shape pour finances, commerce, usine, stock, travail, santé, rapport.

---

## Étape 8 — Regrouper la meta UI à la racine `ui/`

Fichiers encore à la racine `ui/` sans dossier métier :

- `tutorial.js`, `objectives.js`, `objectives-history.js`, `ObjectivesTracker.js`
- `parameters.js`
- `PopupManager.js` (vrai Manager — peut rester racine ou `ui/shell/`)
- `nodes.js`, animations, `mobile-controls.js`

**Dossiers proposés :**
```
ui/
  onboarding/     ← tutorial, objectives
  parametres/     ← parameters
  shell/          ← PopupManager, nodes (si souhaité)
```

**Critère de done :** racine `ui/` limitée à boot, buttons, shell ; pas de feature métier orpheline.

---

## Étape 9 — Documentation

**Fichiers obsolètes à mettre à jour :**
- `src/archi.md`, `src/archi2.md`, `src/archi.claude.md`
- `src/contexts/accounting/README.md`, `docs/refactor.md`, `docs/FINANCIAL_DATA_SOURCE_OF_TRUTH.md`
- `docs/NETFLOW_CALCULATION.md`

**Contenu :** chemins `ui/compta/…`, noms Panel/Presenter, suppression refs `ui/budget/`, `LoansManager`, `finances-section.js`.

**Critère de done :** grep `ui/budget/`, `SectionManager`, `LoansManager` → 0 hit hors historique git.

---

## Étape 10 — Dette technique restante (hors rename)

Issues connues à traiter dans le code UI (indépendamment de l’arborescence) :

| Issue | Fichier | Action |
|---|---|---|
| Taux prêt dupliqué | `PretsPanel.js` | centraliser via `LoanRatePolicy` (cf. `archi.md`) |
| `BuildingBreakdownEnrichment.js` | `compta/bilan/` | renommer ou documenter rôle (enrichissement UI bilan) |
| IDs DOM legacy | `index.html` | `#budget-panel` → `#bilan-panel` (breaking CSS/JS coordonné) |
| Commerce lit UI | `CommerceService` | passer `goodsData` en argument, pas global (cf. `archi.md`) |

---

## Correspondance écran joueur ↔ code (référence)

| Écran | DOM | Code |
|---|---|---|
| Panneau Administrateur | `#administrator-panel` | `ui/admin/` |
| Trésorerie temps réel | `#realtime-budget-panel` | `ui/compta/tresorerie/` |
| Bilan comptable | `#budget-panel` | `ui/compta/bilan/` |
| Compte de résultat | `#budget-states-panel` | `ui/compta/compte-de-resultat/` |
| Livret (admin Finances) | `#admin-section-finances` | `ui/compta/livret/` + `ui/admin/finances/` |
| Prêts | `#loans-panel` | `ui/compta/prets/` |
| Journal | `#journal-panel` | `ui/compta/journal/` |
| Carte | `#city-map-panel` | `ui/carte-ville/` |
| Conseil urbain | *(absent)* | `ui/conseil-urbain/` — étape 4 |

---

## Ordre d’exécution recommandé

1. Étape 1 — commit SectionPresenter
2. Étape 4 — trancher conseil urbain (évite régressions sur bilan)
3. Étape 2 — harmonisation noms
4. Étape 3 — extraction Presenters
5. Étape 6 — tutorial/objectives
6. Étape 5 — registry ACL
7. Étape 7 — sections admin
8. Étape 8 — meta UI
9. Étape 9 — doc
10. Étape 10 — dette technique

À chaque étape : `npm test` (627 tests), pas de shims — déplacer + mettre à jour imports directement.
