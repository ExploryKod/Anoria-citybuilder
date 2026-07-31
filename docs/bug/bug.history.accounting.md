# Historique des erreurs lié au budget et au BC accounting

## Bug ouvert — premier placement maison échoue (juillet 2026)

### Symptôme

- Nouvelle partie avec `VITE_INITIAL_FUNDS=5000`
- HUD, journal et livret admin affichent **5000€**
- **Premier clic** pour poser une maison → échec (message perçu comme « fonds insuffisants »)
- Après quelques tours, la construction redevient possible

### Correction importante (31/07/2026)

**Ce n’est pas un problème de montant insuffisant.** Une maison coûte **10€** (`src/js/meshs/data.js`). Même avec la valeur config par défaut **200€**, le solde serait largement suffisant.

L’hypothèse « sync 5000→200 au clic » **ne tient pas** comme explication principale de l’échec au premier placement.

### Ce que dit le code aujourd’hui

| Point | Détail |
|---|---|
| Vérification trésorerie à la construction | **Supprimée** lors de la migration BC (`// removed the insufficient funds check`) |
| `addConstructionExpense` | Délègue à `RecordConstructionExpense` ; échec si `!result.recorded` → `reason: not_recorded` (ou autre raison BC) |
| Popup rouge « Fonds Insuffisants » | Uniquement si `paymentResult.reason === 'insufficient_funds'` — **jamais retourné** par le chemin actuel (code mort côté `game.js`) |
| Popup orange « Erreur de Construction » | Affiche le `reason` réel (`not_recorded`, `database_error`, `duplicate`, etc.) |

### Pistes restantes (par ordre de probabilité)

1. **Échec BC / journal** (`not_recorded`, `invalid_turn`, …) — pas un refus pour manque d’argent
2. **Race au démarrage** — singleton accounting / buffer journal stale avant `forceReinitialize()` (partiellement adressé : `budgetReadyPromise`, reset contexte)
3. **Erreur persistance bâtiment** après débit (`database_error` dans `PlaceBuildingWithPayment`)
4. **Confusion UI** — popup orange ou conseil urbanistique « Fonds insuffisants » vs popup rouge construction

### Correctifs déjà appliqués (non liés au montant 10€ vs 200€)

- `getCurrentBudget()` : ne downgrade plus `funds` au tour 0 ; upgrade config uniquement si `expectedInitialFunds > budget.funds`
- `forceReinitialize()` : clear journal, reset `SessionLedgerBuffer`, reset accounting context
- `game.js` : `budgetReadyPromise` avant `placeBuildingWithPayment`
- Bug séparé corrigé : `getCurrentBudget()` ne remettait plus les fonds à la config après un **investissement** construction (car `expenses` reste à 0)

### Reproduction / diagnostic

Au moment de l’échec, vérifier dans la console :

```js
// après échec — le log existe déjà dans PlaceBuildingWithPayment / game.js
// paymentResult complet : { success, reason, message }
```

- **Popup rouge** → théoriquement impossible avec le code migré ; indiquer si encore observé (cache navigateur / build non rechargé)
- **Popup orange** → noter le `reason` exact affiché

### Prochaines actions

- [x] Journaliser les échéances impayées (`info_loan_interest` / `info_loan_repayment`, informatif explicite)
- [ ] Confirmer couleur + `reason` exact en jeu après hard refresh
- [ ] Si `not_recorded` : tracer `recordConstructionExpense` → `RecordLedgerEntry` (hydration buffer, `turn`, contexte accounting)
- [ ] Mapper les `reason` BC vers des messages joueur clairs ; retirer ou réimplémenter proprement `insufficient_funds`
- [ ] Test d’intégration « nouvelle partie → première construction tour 0 »
