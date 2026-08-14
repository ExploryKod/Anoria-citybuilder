# Accessibilité clavier (jeu)

Référence des comportements clavier / focus pour Anoria (écran de jeu `game.html`). Objectifs : navigation Tab sans « fantômes », modales piégées, jeu figé derrière les overlays, construction autonome au clavier.

Références utiles : [RGAA 4](https://accessibilite.numerique.gouv.fr/) (critères 12.x focus / modales), [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) (Dialog, Tabs), WCAG 2.4.3 / 2.4.7.

---

## Principes

1. **Un seul propriétaire du clavier** — soit le HUD / une modale, soit la caméra / le placement. Jamais les deux en même temps.
2. **Ce qui est invisible n’est pas focusable** — `display: none`, `[hidden]`, `inert`, et `tabindex="-1"` (roving). L’opacité `0` seule **ne suffit pas**.
3. **Modale ouverte = monde figé** — pause simu + pas de pan caméra + pas de nudge placement + HUD derrière `inert` quand le dialogue est hors `#game-window`.
4. **Tab reste dans la modale** — piège complet (cycle) ; Échap ferme.

---

## Fichiers clés

| Fichier | Rôle |
|---|---|
| `src/presentation/dom/shell/modalFocus.js` | Session focus partagée : piège Tab (capture), Échap, restore focus, `getFocusableElements` |
| `src/presentation/dom/shell/EventBlocker.js` | Coupe souris / touches jeu vers Three.js ; **ne bloque pas** Tab / Échap ; bloque encore les touches caméra même si le focus est dans la modale (sauf champs / tablists) |
| `src/presentation/dom/shell/PopupManager.js` | Suit les popups actives, sync EventBlocker, pose `inert` sur `#game-window` pour les dialogues hors fenêtre de jeu |
| `src/presentation/three/scene.js` | `isGameWorldInputLocked()` — refuse clavier caméra / placement si overlay ouverte |
| `src/presentation/dom/admin/AdministratorPanel.js` | Onglets APG des catégories admin |
| `src/presentation/three/placementRotationHud.js` | HUD tourner / confirmer : `hidden` + `inert` + `tabindex="-1"` hors pose |
| `src/presentation/dom/styles/main.css` | Tokens `--focus-ring` ; `visibility: hidden` sur overlays inactifs |

---

## Parcours Tab HUD (hors modale)

Ordre typique après fermeture du tutoriel (focus sur la porte de sortie) :

1. Quitter (`#game-exit-home-btn`) — coin haut droit
2. Rail population (sous la porte)
3. Construction, voyage, démolir, sélectionner (FABs bas)
4. Gestion, Admin, carte 2D, filtres, légende, tutoriel, objectifs…
5. Commandes temps (pause / replay / vitesses), paramètres…

### Anti Tab fantômes

Contrôles cachés autrefois encore dans l’ordre Tab (placement ×2, pause, Rejouer, paramètres en opacity 0). Mitigations :

- `inert` + `aria-hidden` sur overlays inactifs (`#pause-overlay`, `#over-overlay`, `#info-building-overlay`, `#parameters-panel`, `#panel-layout`, D-pad…)
- HUD placement : attribut `hidden` + `display: none` (pas seulement `visibility: hidden`)
- Boutons placement / Rejouer : `tabindex="-1"` hors usage
- À la fermeture tutoriel / objectifs : restore seulement si l’élément est réellement focusable ; sinon atterrissage sur `#game-exit-home-btn`

---

## Modales & overlays

### Ouverture

1. Ajouter la classe visible (`.active` / `.visible`)
2. `popupManager.forceOpenPopup(id)` (si géré) → EventBlocker + éventuellement `inert` sur `#game-window`
3. `createModalFocusSession({ panel, onEscape, initialFocus })`
4. `pauseGame()` (via PopupManager ou le panneau)

Dialogues **hors** `#game-window` (admin, bilan, prêts, journal, CdR, carte ville, news, …) : le HUD reçoit `inert`.

Dialogues **dans** `#game-window` (pause, info bâtiment, game over) : pas d’`inert` sur toute la fenêtre (sinon la modale elle-même serait inert) ; le piège Tab + `isGameWorldInputLocked` suffisent.

### Fermeture

1. Retirer la classe / `forceClosePopup` (lève `inert`)
2. `focusSession.release()` — restore focus en `requestAnimationFrame` (après levée de `inert`)
3. `playGame()` si plus aucune popup qui pause

### Piège Tab (`modalFocus.js`)

- Listener `keydown` en **capture**
- Chaque Tab : `preventDefault` + focus manuel du précédent / suivant dans `getFocusableElements(panel)`
- Ignore les nœuds `tabIndex < 0`, `[hidden]`, `[inert]`, et toute chaîne d’ancêtres `display: none` / `visibility: hidden`

### Touches caméra sous modale

Même avec le focus dans le dialogue, flèches / WASD / ZQSD / R·T / V / +/- ne doivent pas paner la scène :

- `EventBlocker` les bloque encore (sauf `input` / `textarea` / `select` / `[contenteditable]`, et patterns APG `tablist` / `listbox` / `menu` / …)
- `scene.isGameWorldInputLocked()` court-circuite `onKeyBoardDown` si popup, info bâtiment, paramètres, tutoriel, objectifs, menu voyage, loader ou barre construction ouverts

---

## Voyage entre hameaux (carrousel)

Bouton charrette `#hamlet-travel-btn` (à côté de la construction, barre du bas) → `#hamlet-travel-menu` (`role="listbox"`).

| Entrée | Effet |
|---|---|
| Entrée / Espace (sur le bouton) | Ouvre / ferme |
| Tab (menu ouvert) | Cycle flèches (si visibles) ↔ destinations ↔ bouton |
| ← → / ↑ ↓ | Destination précédente / suivante |
| Home / End | Première / dernière destination |
| Échap | Ferme et rend le focus au bouton |
| Entrée sur une destination inactive | Charge cette scène (loader) |

Les flèches n’apparaissent que si la liste dépasse le viewport. Le hameau **actif** est vert (`aria-checked="true"`). Menu fermé : `hidden` + `inert`. Fichier : `HamletTravelMenu.js`.

---

## Panneau administrateur (onglets)

Les catégories (Finances, Santé, Commerce, …) sont un **tablist APG**, pas une file Tab plate de tous les boutons de toutes les sections.

| Entrée | Effet |
|---|---|
| ← → / ↑ ↓ | Change de catégorie (roving `tabindex`) |
| Home / End | Première / dernière catégorie |
| Tab | Entre dans le **panneau actif uniquement** (ex. Commerce → bouton **Carte**) |
| Entrée / Espace | Active l’onglet et focus le premier contrôle du panneau |
| Échap | Ferme l’admin |

Fichier : `AdministratorPanel.js`. Sections inactives : `hidden` + `aria-hidden="true"`.

Exemple pour ouvrir la carte commerce au clavier : Admin → flèches jusqu’à Commerce → Tab (ou Entrée).

---

## Construction au clavier

Avec un outil de pose actif et un fantôme :

| Entrée | Effet |
|---|---|
| Flèches | Déplacent le fantôme d’une case (relatif à la caméra) |
| Entrée | Confirme la pose |
| R | Rotation (chemins / outils concernés) |
| WASD / ZQSD | Pan caméra (si aucune modale) |

HUD tactile « Tourner / Confirmer » : hors du Tab order tant qu’il est masqué.

---

## Tutoriel & objectifs

- `EventBlocker` avec `excludeSelectors` sur le panneau
- Piège Tab / Échap propres
- `#game-window` en `inert` pendant l’affichage
- Fermeture : focus sur un contrôle HUD visible (porte, objectifs, construction…)

---

## Barre de construction (mobile / compact)

- Roving tabindex sur les outils du carrousel
- Flèches catégorie / outils gérées localement
- Classe `mobile-build-bar-open` sur `documentElement` → caméra et scène ignorent les flèches map

---

## Focus visible

- Variables `--focus-ring` / `--focus-ring-offset` dans `main.css`
- Anneaux renforcés sur FABs bas (`legends.css`) et commandes pause / replay (`hud.css`)
- Éviter `outline: none` sans `:focus-visible` de remplacement

---

## Checklist rapide (nouvelle modale)

1. Racine : `role="dialog"`, `aria-modal="true"`, `aria-labelledby` / `aria-label`, `aria-hidden` sync
2. Fermée : `hidden` ou `display: none` **ou** `inert` (pas seulement opacity)
3. Ouverture : `createModalFocusSession` + enregistrement PopupManager si bloquante
4. Boutons réels `<button type="button">` (pas de `div` cliquable sans `tabindex` / rôle)
5. Vérifier Tab : uniquement contrôles de la modale ; flèches ne bougent plus la carte
6. Fermeture Échap + restore focus sur le déclencheur

---

## Limites connues / suites possibles

- Certains panneaux métier (contenu admin riche) peuvent encore avoir des contrôles générés sans `type="button"` ou sans label — à auditer au fil des sections.
- La carte commerce plein écran et les sous-modales denrées ont leur propre session focus ; imbriquer plusieurs pièges demande de release le parent proprement.
- Tests automatisés focus order non encore branchés (à envisager Playwright / axe).
