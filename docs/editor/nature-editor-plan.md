# Nature editor — plan d’implémentation

Mode éditeur accessible depuis le menu (**Éditeur nature**) ou `/game?mode=editor`.
Hors mission / tutoriel : pas d’objectifs, pas de tutoriel auto, simulation en pause.

## Déjà en place

| Pièce | Fichier |
|-------|---------|
| Boot menu → `game.html` | `index.html`, `bootSession.js` (`editor`) |
| Session `gameMode` | `src/shared/gameplay/gameMode.js` |
| UI éditeur (bandeau, masquage) | `src/presentation/dom/editor/applyEditorModeUi.js` |
| Bootstrap | `GameSessionBootstrap.js` |

## À faire (phases)

### Phase 1 — Catalogue Kenney nature

- Script `scripts/kenney/scanKenneyNatureKit.mjs` (miroir city-kit)
- Registre généré : previews PNG isométriques + chemins GLB
- Séparation **terrain** (`ground_*`, `cliff_*`, `platform_*`) vs **nature** (`tree_*`, `rock_*`, props)

### Phase 2 — Outils UI (barre du bas)

Deux boutons FAB à côté cheval / construction / gomme / sélection (éditeur uniquement) :

1. **Terrain** — carousel Splide comme `MobileCompactToolbar`
2. **Nature** — idem, assets non-grille (props)

Réutiliser : `ToolPanel.js`, `MobileCompactToolbar.js`, `ActiveToolRegistration.js` → `game.setActiveToolId`.

### Phase 3 — Couches Three.js

| Couche | `SceneTilePort.layer` | Stockage |
|--------|----------------------|----------|
| Terrain peint | `terrain` | `city.tiles[x][y].terrainId` |
| Objets nature | `nature` | liste dédiée (Dexie ou layout JSON) |

Factories : `registerTerrainSceneFactories.js`, adapter Kenney existant.

### Phase 4 — Fichier source de vérité (export / import)

Format suggéré (un fichier ou plusieurs par couche) :

```json
{
  "version": 1,
  "citySize": 16,
  "terrain": [["nature:ground_grass", "..."]],
  "natureObjects": [
    { "assetId": "nature:tree_pine", "x": 3, "y": 5, "rotationY": 0 }
  ],
  "shore": { "enabled": false, "seed": 42, "padding": 4 }
}
```

- **Export** : bouton dans le bandeau éditeur → `download` JSON
- **Import** : hydratation avant `scene.initialize()` (étendre ou parallèle à `HydrateCityTilesFromBuildings`)

## État actuel du jeu

- Terrain grille : toujours `grass` / `nature:ground_grass` en mémoire ; pas de persistance terrain par tuile
- Bâtiments : Dexie `houses`
- Rive : code présent, `islandBeachBorderEnabled: false`

## Points d’accroche

- `isEditorMode()` — `sessionShell.js` / `gameMode.js`
- `scene.initialize(city, { seedNature })` — désactiver `seedNature` en éditeur
- `presentationConfig.js` — flags rivage / éditeur
