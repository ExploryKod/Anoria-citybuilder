# `src/infrastructure/` — tech transverse

Ce dossier accueille l’infrastructure **cross-cutting** (partagée entre BCs), pas les adapters d’un contexte métier.

## Règle de placement

| Quoi | Où |
|---|---|
| Adapters d’un BC (Dexie, ECS systems, sprites Three liés au BC, toasts) | `contexts/*/infrastructure/` |
| Rendu WebGL / scène / meshes | `src/presentation/three/` |
| HUD DOM, panneaux, shell | `src/ui/` |
| Tech transverse (réseau, etc.) | `src/infrastructure/` (ici) |

## Contenu actuel

- **`multiplayer/`** — WebSocket / `MultiplayerManager` (seul code live)

Les sous-dossiers vides éventuels (`persistence/`, `rendering/`, `runtime/`, …) sont des **réserves**. Ne pas y pousser du code BC ni y déplacer `scene.js` / adapters de contexte « pour remplir le scaffold ».

Voir aussi `src/archi.md` §3 (cible des couches) et `docs/refactor_ui.md`.
