# Bug : une ligne de TVA à zéro bloque le règlement du mois

**Date :** 2026-10-18
**Contexte :** écritures à deux jambes (journal en partie double), branche `feature/transactions`
**Statut :** corrigé

---

## Symptômes observés

Au passage de mois (tour 35 dans le test), le jeu s'arrête avec :

```
[journal] could not record vat (turn 35): [ledger] the leg 512 of the écriture "vat" must be a positive whole number of centimes on one side only (debit 0, credit 0)
```

Tout le règlement du mois est perdu (il est écrit « tout ou rien »), et la partie ne peut plus avancer.

## Cause racine

- Une écriture comptable déplace de l'argent des deux côtés : le journal refuse une écriture dont le montant est 0 (`EntryLegsPolicy.assertBalanced`). Une écriture de zéro n'existe pas.
- La vente d'un service sans TVA (taux 0 %) produisait quand même une ligne `vat` de 0 € (`serviceSaleLines`).
- Avant la partie double, une ligne à un seul montant acceptait 0 sans effet. En passant aux deux jambes, le journal est devenu strict, mais tous les écrivains n'évitaient pas d'écrire des zéros : presque tous le faisaient déjà (salaires, loyers, impôts, subventions), pas la vente de services.

## Correctif

`serviceSaleLines` (`ProducerChargePolicy.js`) ne produit plus une ligne dont le montant est 0 : un service sans TVA n'a pas de ligne de TVA.

## Test de non-régression

`tests/contexts/accounting/serviceLines.regression.test.js` : « a service with no VAT has no VAT line: a line of zero is not written ».

## Leçon

Quand une règle devient stricte (ici : pas d'écriture de zéro), chercher tous les écrivains qui la contournaient sans le savoir. Un zéro n'est pas une écriture : le service qui calcule les lignes ne doit pas les produire.
