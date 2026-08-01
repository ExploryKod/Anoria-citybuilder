# Bug : clignotement de scène au rythme des citoyens

**Date :** 2026-08-01  
**Branche :** `main` (post-merge `refactor/on-ecs-ddd--stores-dependencies`)  
**Statut :** corrigé

---

## Vue d’ensemble

Quand un citoyen marche (surtout en entrant depuis l’extérieur sur une route), **toute la scène** clignote : maisons / plateau qui paraissent plus clairs par à-coups, au **même rythme** que le déplacement du personnage — pas une ombre locale sous le citoyen.

| # | Symptôme joueur | Cause courte |
|---|---|---|
| A | Flash global d’éclairage synchronisé avec la marche | `DirectionalLight` embarquée dans les GLB citoyens (`KHR_lights_punctual`) |
| B | (piste initiale) Flash lié aux shadow maps | Frustum / `autoUpdate` — réel mais **secondaire** ; ne suffisait pas à supprimer le bug |

---

## Symptômes

- Citoyen entre depuis hors plateau (route de bord) ou marche sur le réseau.
- Luminosité des meshes (maisons, herbe, etc.) **pulse** au rythme de la marche.
- Perception trompeuse : « le personnage fait clignoter la scène » / « les maisons émettent plus de lumière ».
- Après recentrage vertical de la lumière de scène, le flash restait mais paraissait **plus orienté vers le bas** → confirmation que c’était bien une **lumière directionnelle qui bouge**, pas seulement une shadow map.

---

## Cause racine (A)

Les assets :

- `public/citizen02/citizenAnimated02.glb`
- `public/citizenCool/citizenCoolTwoAnim.glb`

déclarent l’extension glTF **`KHR_lights_punctual`** avec une **`DirectionalLight`** (intensité 1, blanc) attachée au graphe de scène du personnage.

Au `GLTFLoader`, Three.js matérialise cette lumière comme un `THREE.DirectionalLight` enfant du modèle.  
Elle est donc **ajoutée à la scène avec le citoyen** et **se déplace / s’oriente avec lui** → contribution d’éclairage globale recalculée chaque frame → clignotement ville entière.

Ce n’est **pas** une ombre projetée locale : c’est une **deuxième (troisième…) sun** parasite.

Vérification (scan JSON du GLB) :

```text
extensionsUsed: KHR_lights_punctual
nodes: … DirectionalLight → { light: 0 }
lights: [{ type: 'directional', intensity: 1, color: [1,1,1] }]
```

---

## Pistes secondaires (B) — utiles mais insuffisantes

Avant d’identifier la light GLB, on avait traité des smells shadow map réels :

| Zone | Changement | Effet |
|---|---|---|
| `CitizenManager` | `castShadow = false` sur les meshes citoyen | Évite qu’un caster animé invalide la shadow map globale |
| `LightingManager` | Frustum d’ombre centré sur le plateau | Moins de acne / flash aux bords du volume d’ombre |
| `scene.js` | `renderer.shadowMap.autoUpdate = false` + refresh au placement | Moins de rebuild shadow map chaque frame |
| `PerformanceManager` | Plus de `dispose()` / resize dynamique de la shadow map ; ne plus couper `receiveShadow` | Évite des flashs caméra / rebuild |

Ces garde-fous restent en place (hygiène Three.js), mais **le clignotement au rythme de la marche n’a disparu qu’après le strip des lights GLB**.

---

## Correction

Dans `CitizenManager.createCitizenInstance`, après chargement du GLB :

1. `traverse` : collecter tout `child.isLight`
2. Les retirer du parent (`remove`) + `dispose` si dispo
3. Sur les meshes : garder `castShadow = false` / `receiveShadow = false`

Fichier : `src/presentation/three/managers/CitizenManager.js`

---

## Non-régression / pièges

- Tout nouveau citizen GLB exporté depuis Blender/Mixamo avec « lights in scene » reproduira le bug tant que le strip n’est pas fait (ou que la light n’est pas retirée à l’export).
- Ne pas confondre avec un bug « ombre du personnage » : désactiver seulement `castShadow` **ne suffit pas** si une light ponctuelle / directionnelle reste dans le GLB.
- `DecorativeVillageManager` ne charge pas ces GLB citoyens ; hors scope pour ce bug.

---

## Test manuel

1. Nouvelle partie, poser une **route de bord** (accès extérieur).
2. Attendre / forcer l’arrivée d’un citoyen depuis l’extérieur.
3. Observer la marche sur le plateau : **aucune** pulsation de luminosité des maisons / terrain.
4. Contrôle : en DevTools Three / en log temporaire, `citizen.character` ne doit plus contenir de `isLight` après spawn.
