# Bug : les achats des maisons n'écrivaient ni la vente du vendeur ni la TVA

**Date :** 2026-10-18 (trouvé en passant, pendant la branche `feature/transactions`)
**Contexte :** `RecordConsumerPurchases`, livraison de biens aux maisons
**Statut :** corrigé

---

## Symptômes observés

- Le journal d'une partie ne montrait aucune ligne `vat`, ni la vente (`producer_revenue`) correspondant à un achat de maison, seulement l'achat de la maison (`consumer_purchase`).
- Les distributeurs n'encaissaient pas ce que les maisons payaient ; la ville ne percevait pas la TVA de ces ventes.

## Cause racine

- Une livraison à une maison est écrite en trois lignes : l'achat de la maison, la vente du vendeur (HT) et la TVA de la ville.
- Les trois lignes avaient la **même clé métier**. Le journal refuse une ligne dont la clé existe déjà, et `#record` tolère ce refus (`duplicate_business_key`) sans erreur : seule la première ligne était écrite, les deux autres étaient prises pour des doublons.
- Ces ventes ne sont écrites nulle part ailleurs (`sumGoodsFlowsByPair` exclut volontairement les ventes aux maisons).

## Correctif

Chaque ligne a sa propre clé métier : la clé de la livraison plus le type de la ligne (`RecordConsumerPurchases.#record`). Une même livraison rejouée n'ajoute toujours rien.

## Test de non-régression

`tests/contexts/accounting/consumerPurchases.regression.test.js` : avec un journal qui refuse les clés en double comme le vrai, les trois lignes sont écrites (11 € de la maison, 10 € pour le vendeur, 1 € de TVA), reliées par un même flux, et une livraison rejouée n'en ajoute pas.

## Conséquences à surveiller

Les distributeurs encaissent maintenant ces ventes (leur caisse et leur résultat montent) et la ville perçoit la TVA : l'équilibre économique peut bouger. Le journal d'une partie commencée avant le correctif garde ses lignes manquantes.

## Leçon

Une clé d'idempotence doit identifier la ligne, pas seulement l'événement qui la produit. Un refus « doublon » toléré sans bruit cache ce genre d'erreur : en cas de doublon, vérifier que c'est bien la même ligne.
