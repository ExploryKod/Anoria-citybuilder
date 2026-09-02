import bpy
import os
from pathlib import Path

# Racine des ressources du projet
ROOT = Path("/home/amaury/devweb/city-builders/Anoria-citybuilder/public/resources")

# Dossiers Kenney à importer (ajoute/enlève des packs)
GLB_DIRS = [
    ROOT / "kenney_nature-kit/Models/GLTF format",
    ROOT / "kenney_city-kit-commercial_2.1/Models/GLB format",
    ROOT / "kenney_city-kit-suburban_20/Models/GLB format",
    ROOT / "kenney_city-kit-industrial_1.0/Models/GLB format",
    ROOT / "kenney_castle-kit/Models/GLB format",
]

GRID_COLS = 20      # assets par ligne
SPACING = 1.2       # 1 tuile Kenney ≈ 1 m
index = 0

for glb_dir in GLB_DIRS:
    if not glb_dir.is_dir():
        print(f"Skip (missing): {glb_dir}")
        continue

    pack_name = glb_dir.parent.parent.name
    pack_coll = bpy.data.collections.new(pack_name)
    bpy.context.scene.collection.children.link(pack_coll)

    for glb in sorted(glb_dir.glob("*.glb")):
        col = index % GRID_COLS
        row = index // GRID_COLS
        x, y = col * SPACING, -row * SPACING

        bpy.ops.import_scene.gltf(filepath=str(glb))
        imported = bpy.context.selected_objects
        if not imported:
            continue

        empty = bpy.data.objects.new(glb.stem, None)
        empty.location = (x, y, 0)
        pack_coll.objects.link(empty)

        for obj in imported:
            obj.parent = empty
            obj.location.x += x
            obj.location.y += y

        index += 1
        print(f"Imported {glb.name}")

print(f"Done: {index} assets")