# Contributions (poste budgétaire) — lien Accounting ↔ Intelligence

**Statut** : note Phase 0 — **pas encore de type journal implémenté**.

Les **contributions** sont des **charges ponctuelles** payées pour **révéler une dépêche** (ex. nouvelles de caravane).  
Ce n’est **pas** un abonnement mensuel.

Le **bulletin / les dépêches** appartiennent au BC **Intelligence**. Le **mouvement d’argent** appartient à **Accounting**.

Spec produit & découpage :  
`src/contexts/intelligence/docs/boundaries.md` et `gameplay.plan.md`.

---

## 1. Type journal cible

| Champ | Valeur cible |
|-------|----------------|
| `type` | `contribution` |
| Nature | Charge (expense) |
| Montant MVP | 10 (par dépêche caravane) — montant passé par l’appelant |
| `businessKey` | `contribution:news:{newsItemId}` (idempotence **à la dépêche**) |
| Label UI FR | `Contribution` / `Contributions` |

### Impacts Accounting à prévoir (quand on implémentera)

- `journalEntryTypeLabel`
- `JournalEntryClassificationPolicy` (expense)
- `IncomeStatementMappingPolicy` (bucket charges — ex. `contributions` ou `other`)
- Livret ville / budget temps réel (`expenseBreakdown`)
- Cumuls annuels si le pattern `cumul_*` est conservé

---

## 2. Port d’entrée (cible)

```
settleContribution({ newsItemId, channelId, amount, turn, businessKey, description })
wasContributionPaidForNews(newsItemId) // ou existsByBusinessKey
```

Intelligence est le **seul** appelant métier prévu en MVP (canal `caravan`, au clic **Payer** sur la modale d’info).  
Autres canaux plus tard via le même type `contribution` + `channelId` / `newsItemId`.

---

## 3. Ce qu’on évite

| Anti-pattern | Pourquoi |
|--------------|----------|
| Abonnement mensuel `contribution:caravan:{year}:{month}` | Produit = paiement à la dépêche |
| Table `news_subscriptions` dans Accounting | Accounting ne gère pas le produit « news » |
| Intelligence qui écrit `db.journal` | Contourne le BC Accounting |
| Bucket CR nommé « Intelligence » | Le joueur voit une **contribution** |

---

## 4. Ordre d’implémentation suggéré

1. Spec Intelligence (fait).
2. Phase 1 Intelligence sans contribution (news ville + modale event + onglet Archives admin).
3. Ajouter `contribution` dans Accounting (type + policies + UI labels) **avec tests journal**.
4. Phase 2 Intelligence : CTA **Payer** / **Lire d’autres nouvelles** (delete) sur event caravane.
