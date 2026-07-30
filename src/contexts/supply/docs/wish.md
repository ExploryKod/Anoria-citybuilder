# Supply — souhaits produit

Notes de cible pour le bounded context **Supply** (chaîne alimentaire, desserte, sprites carte).  
État actuel du code documenté dans [`README.md`](../README.md) et [`presentation.md`](../../employment/docs/presentation.md) (emploi ≠ supply).

---

## 1. Fermes « trop loin » (sans connexion exploitable)

### Problème / gap actuel

- **Employment** : les fermes peuvent embaucher **sans route** (`isEligibleWorkplace` — voir Employment BC).
- **Supply** : récolte, vente marché/moulin exigent encore `OperationalGatePolicy` (route + ouvriers) — une ferme isolée peut être staffée mais **inactive** côté logistique.
- Aucun sprite carte dédié « ferme trop loin / non raccordée » — seulement absence d’activité (pas de récolte) ou icônes emploi (`no-work` si 0 ouvrier).

### Souhait

Quand une ferme n’est **pas raccordable** au réseau d’exploitation (voir §2), afficher immédiatement sur la tuile un statut explicite du type **« trop loin »** (sprite + éventuellement tooltip / panel info), distinct de :

- `no-work` (Employment — manque d’ouvriers),
- sprites saison (`grow-food`, `harvest`, …),
- icône route Parcels.

### Idéal cible — parcelle agricole par chaîne de fermes

Une ferme **ne se raccorde pas** en étant collée directement à une route.

**Règle proposée :**

1. Une **parcelle agricole** = composante connexe de tuiles `Farm-*` (4-voisins ou 8-voisins — à trancher).
2. La parcelle est **exploitable** si **au moins une ferme** de la composante est **adjacente à une route** (tuile route voisine).
3. Toutes les fermes de la même parcelle **héritent** du statut « raccordée » (même réseau logistique).
4. Sinon → parcelle / fermes marquées **« trop loin »** (pas de récolte, pas de vente — ou règles dégradées à définir).

**Superficie (ha) :**

- En interne : compter les **cases** (tuiles ferme) de la parcelle.
- En UI : afficher en **hectares** (conversion configurable, ex. `1 case = 1 ha` ou autre ratio admin).
- **Plafond** : une parcelle ne peut pas dépasser **X cases** (donc X ha affichés) — X configurable (config / admin).
- Au-delà : refus de placement ou fusion de parcelles interdite (UX à préciser).

**BC Supply — pistes techniques :**

- Nouvelle policy ex. `FarmParcelPolicy` / `FarmConnectivityPolicy` (composantes, ancre route, surface).
- Commandes : recalcul après pose/suppression ferme ou route (`parcels.roadAccess` ou hook dédié).
- Read model : `GetBuildingSupplyView` (ferme) → `{ parcelId, parcelSizeHa, connectedToRoad, tooFarFromNetwork }`.
- Persistance : flags sur ferme ou snapshot parcelle (à designer — éviter duplication sur chaque tuile si possible).

**Hors scope Supply (mais lié) :**

- L’emploi reste géré par Employment ; une ferme « trop loin » peut quand même employer (décision produit actuelle).

---

## 2. Marché trop loin des fermes d’approvisionnement

### Problème / gap actuel

| Élément | Aujourd’hui |
|---|---|
| Flag `noFarmsNearby` | Persisté (`UpdateMarketFarmProximity`) — voisins graph, pas distance Manhattan aux fermes productives |
| Carte 3D | Pas de sprite dédié « marché trop loin des fermes » — seulement teinte orange sur `isBuying` si `noFarmsNearby` |
| Panel info (clic) | Message texte si `noFarmsNearby` (~`game.js`) |
| `marketTooFar` | Existe pour **maisons** (hors portée d’un marché), pas pour la relation marché → fermes |

### Souhait

Dès qu’un marché **ne peut pas s’approvisionner** auprès des fermes (critère à aligner avec la logique d’achat réelle — voisins, parcelle raccordée, distance max, etc.) :

- Afficher **tout de suite** un **sprite dédié** sur le marché (comme `isBuying` / `no-food`), **sans** devoir ouvrir la modal info.
- Le sprite doit être **distinct** de `no-work` (Employment) et de `no-food` (stock vide).

### Idéal cible

1. **Définir une règle unique** « marché peut acheter à la ferme F » :
   - F dans une parcelle **raccordée** (§1),
   - F opérationnelle (`OperationalGatePolicy` : ouvriers + route parcelle),
   - F à portée (voisinage actuel et/ou `MarketRangePolicy` — à unifier).
2. Si **aucune** ferme éligible à portée → `marketTooFarFromFarms = true` (nom à stabiliser).
3. Exposer via `GetBuildingSupplyView` ; `scene.update` pose le sprite Supply (même pattern que `isBuying`).
4. Panel info : conserver le détail texte, synchronisé avec le même read model.

**Piste sprite :** nouvelle texture statut (ex. `market-too-far` / « fermes inaccessibles »), position meta dans `scene.js` à côté de `isBuying`.

---

## 3. Synthèse priorités

| # | Souhait | BC | UI |
|---|---|---|---|
| A | Parcelle agricole + chaîne jusqu’à la route + plafond surface (ha) | Supply (+ Parcels pour voisins/route) | Sprite « trop loin », compteur ha panel ferme |
| B | Marché sans fermes approvisionnables | Supply | Sprite dédié immédiat sur la carte |
| C | Un read model Supply unique pour flags + sprites (pas de logique dupliquée modal / scene) | Supply queries | `scene.update` consomme `GetBuildingSupplyView` uniquement |

---

## 4. Références code actuelles (point de départ)

```
UpdateMarketFarmProximity     → noFarmsNearby (voisins)
MarketBuysFromNearbyFarms     → achat automne, skip ferme sans route
UpdateHousesMarketReach         → marketTooFar (maisons)
OperationalGatePolicy         → route + staff pour opérer
scene.js (marché)               → isBuying + teinte orange si noFarmsNearby
```

Docs liées : [`refactor.md`](refactor.md), [`history.md`](history.md).
