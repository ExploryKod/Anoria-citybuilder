/**
 * Heuristic classifier for Kenney Hexagon Pack terrain tiles.
 *
 * Roles:
 * - fill: terrain colour reaches the hex edge — tiles seamlessly in large biomes
 * - islet: inner terrain blob surrounded by a grass (or other) margin
 * - framed: thick coloured rim / silhouette tile around the whole hex
 * - prop: full-bleed base with prominent objects (trees, rocks, buildings)
 * - transition: different terrain colours on opposing edges (biome borders)
 * - miniature: sub-atlas icon (smaller than the standard 120×140 frame)
 * - unknown: could not classify confidently
 */

/** @typedef {'fill' | 'islet' | 'framed' | 'prop' | 'transition' | 'miniature' | 'unknown'} KenneyTileRole */

/** Reference Kenney terrain frame size (pointy-top). */
export const KENNEY_HEX_REF_WIDTH = 120;
export const KENNEY_HEX_REF_HEIGHT = 140;

/** Pointy-top hex edge sample coordinates for the reference frame. */
export const KENNEY_HEX_EDGE_SAMPLES = Object.freeze([
  [60, 4],
  [60, 136],
  [8, 35],
  [112, 35],
  [8, 105],
  [112, 105],
  [30, 16],
  [90, 16],
  [30, 124],
  [90, 124],
  [20, 70],
  [100, 70],
]);

/** Six edge groups for transition detection (pointy-top). */
export const KENNEY_HEX_EDGE_GROUPS = Object.freeze([
  Object.freeze([
    [60, 4],
    [45, 10],
    [75, 10],
  ]),
  Object.freeze([
    [30, 16],
    [8, 35],
    [20, 28],
  ]),
  Object.freeze([
    [90, 16],
    [112, 35],
    [100, 28],
  ]),
  Object.freeze([
    [20, 70],
    [8, 105],
    [30, 124],
  ]),
  Object.freeze([
    [100, 70],
    [112, 105],
    [90, 124],
  ]),
  Object.freeze([
    [60, 136],
    [45, 130],
    [75, 130],
  ]),
]);

/** Visually verified overrides (stem without .png). */
export const KENNEY_TILE_MANUAL_OVERRIDES = Object.freeze({
  grass_05: 'fill',
  grass_06: 'fill',
  grass_03: 'islet',
  grass_04: 'islet',
  grass_12: 'prop',
  grass_14: 'prop',
  grass_16: 'prop',
  sand_01: 'islet',
  sand_02: 'fill',
  sand_14: 'prop',
  dirt_06: 'fill',
  dirt_01: 'framed',
  stone_01: 'framed',
  stone_02: 'fill',
  stone_14: 'fill',
  mars_01: 'framed',
  mars_14: 'prop',
});

/**
 * @typedef {{ r: number, g: number, b: number, a: number }} Rgba
 */

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 */
export function scaleKenneyPoint(x, y, width, height) {
  return [
    (x / KENNEY_HEX_REF_WIDTH) * width,
    (y / KENNEY_HEX_REF_HEIGHT) * height,
  ];
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {number} x
 * @param {number} y
 * @returns {Rgba}
 */
export function samplePixel(data, width, height, x, y) {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)));
  const py = Math.max(0, Math.min(height - 1, Math.round(y)));
  const index = (py * width + px) * 4;
  return {
    r: data[index],
    g: data[index + 1],
    b: data[index + 2],
    a: data[index + 3],
  };
}

/**
 * @param {Rgba} color
 */
export function isOpaque(color) {
  return color.a > 128;
}

/**
 * @param {Rgba} a
 * @param {Rgba} b
 */
export function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

/**
 * @param {Rgba} color
 */
export function isGrassGreen(color) {
  return (
    color.g > 85
    && color.g > color.r + 20
    && color.g > color.b + 12
    && color.r < 140
  );
}

/**
 * @param {Rgba} color
 */
export function isFrameBrown(color) {
  return (
    color.r > 120
    && color.g > 60
    && color.g < color.r * 0.85
    && color.b < color.g * 0.75
  );
}

/**
 * @param {Rgba} color
 */
export function isMarsRed(color) {
  return color.r > 150 && color.g < 110 && color.b < 100;
}

/**
 * @param {Rgba} color
 */
export function isStoneGrey(color) {
  const spread = Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b);
  return spread < 45 && color.r > 90 && color.r < 210;
}

/**
 * @param {Rgba} color
 */
export function isDarkSilhouette(color) {
  return color.r < 55 && color.g < 55 && color.b < 55;
}

/**
 * @param {Rgba[]} colors
 */
export function averageColor(colors) {
  if (colors.length === 0) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  const total = colors.reduce(
    (acc, color) => ({
      r: acc.r + color.r,
      g: acc.g + color.g,
      b: acc.b + color.b,
      a: acc.a + color.a,
    }),
    { r: 0, g: 0, b: 0, a: 0 }
  );

  const count = colors.length;
  return {
    r: total.r / count,
    g: total.g / count,
    b: total.b / count,
    a: total.a / count,
  };
}

/**
 * @param {Rgba[]} colors
 */
export function colorVariance(colors) {
  if (colors.length < 2) return 0;
  const avg = averageColor(colors);
  return (
    colors.reduce((sum, color) => sum + colorDistance(color, avg) ** 2, 0) / colors.length
  );
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} radius
 * @returns {Rgba[]}
 */
export function sampleCenterRegion(data, width, height, cx, cy, radius) {
  const samples = [];
  const step = Math.max(2, Math.round(Math.min(width, height) / 30));
  for (let y = cy - radius; y <= cy + radius; y += step) {
    for (let x = cx - radius; x <= cx + radius; x += step) {
      const color = samplePixel(data, width, height, x, y);
      if (isOpaque(color)) samples.push(color);
    }
  }
  return samples;
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {number} cx
 * @param {number} cy
 * @param {number} innerRadius
 * @param {number} outerRadius
 * @returns {Rgba[]}
 */
export function sampleAnnulus(data, width, height, cx, cy, innerRadius, outerRadius) {
  const samples = [];
  const step = Math.max(2, Math.round(Math.min(width, height) / 28));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < innerRadius || dist > outerRadius) continue;

      const color = samplePixel(data, width, height, x, y);
      if (isOpaque(color)) samples.push(color);
    }
  }

  return samples;
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 */
function countTreeLikePixels(data, width, height) {
  let count = 0;
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.min(width, height) * 0.42;
  const step = Math.max(2, Math.round(Math.min(width, height) / 40));

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const dx = x - cx;
      const dy = y - cy;
      if (Math.sqrt(dx * dx + dy * dy) > maxRadius) continue;

      const color = samplePixel(data, width, height, x, y);
      if (!isOpaque(color)) continue;

      const darkGreen = color.g > 50 && color.g < 130 && color.r < 90 && color.b < 90;
      const darkOutline = color.r < 45 && color.g < 45 && color.b < 45;
      if (darkGreen || darkOutline) count += 1;
    }
  }

  return count;
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {ReadonlyArray<readonly [number, number]>} points
 */
function sampleScaledPoints(data, width, height, points) {
  return points
    .map(([x, y]) => {
      const [sx, sy] = scaleKenneyPoint(x, y, width, height);
      return samplePixel(data, width, height, sx, sy);
    })
    .filter(isOpaque);
}

/**
 * @param {string} stem
 * @param {KenneyTileRole} role
 */
export function applyManualOverride(stem, role) {
  return /** @type {KenneyTileRole | undefined} */ (KENNEY_TILE_MANUAL_OVERRIDES[stem]) ?? role;
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @param {string} [stem]
 * @returns {KenneyTileRole}
 */
export function classifyKenneyTerrainTile(data, width, height, stem = '') {
  if (width < 100 || height < 115) {
    const scaledRole = classifyKenneyTerrainTileCore(data, width, height);
    return applyManualOverride(stem, scaledRole === 'miniature' ? scaledRole : scaledRole);
  }

  return applyManualOverride(stem, classifyKenneyTerrainTileCore(data, width, height));
}

/**
 * @param {Uint8Array} data
 * @param {number} width
 * @param {number} height
 * @returns {KenneyTileRole}
 */
function classifyKenneyTerrainTileCore(data, width, height) {
  const cx = width / 2;
  const cy = height / 2;
  const edgeColors = sampleScaledPoints(data, width, height, KENNEY_HEX_EDGE_SAMPLES);

  if (edgeColors.length < 6) {
    return 'unknown';
  }

  const centerRadius = Math.min(width, height) * 0.2;
  const centerColors = sampleCenterRegion(data, width, height, cx, cy, centerRadius);
  const outerRing = sampleAnnulus(
    data,
    width,
    height,
    cx,
    cy,
    Math.min(width, height) * 0.36,
    Math.min(width, height) * 0.48
  );
  const innerDisk = sampleCenterRegion(data, width, height, cx, cy, Math.min(width, height) * 0.22);

  const edgeAvg = averageColor(edgeColors);
  const centerAvg = averageColor(centerColors);
  const outerAvg = averageColor(outerRing);
  const innerAvg = averageColor(innerDisk);
  const edgeCenterDistance = colorDistance(edgeAvg, centerAvg);
  const outerInnerDistance = colorDistance(outerAvg, innerAvg);
  const centerVariance = colorVariance(centerColors);
  const edgeVariance = colorVariance(edgeColors);

  const edgeGreenRatio = edgeColors.filter(isGrassGreen).length / edgeColors.length;
  const outerGreenRatio = outerRing.filter(isGrassGreen).length / Math.max(outerRing.length, 1);
  const centerIsGrass = isGrassGreen(centerAvg);
  const innerIsGrass = isGrassGreen(innerAvg);
  const centerDarkRatio = centerColors.filter(isDarkSilhouette).length / Math.max(centerColors.length, 1);

  const edgeGroupColors = KENNEY_HEX_EDGE_GROUPS.map((group) => averageColor(
    sampleScaledPoints(data, width, height, group)
  ));

  let maxEdgeSpread = 0;
  for (let i = 0; i < edgeGroupColors.length; i += 1) {
    for (let j = i + 1; j < edgeGroupColors.length; j += 1) {
      maxEdgeSpread = Math.max(maxEdgeSpread, colorDistance(edgeGroupColors[i], edgeGroupColors[j]));
    }
  }

  const opposingPairs = [
    [0, 3],
    [1, 4],
    [2, 5],
  ];
  let strongOpposingPairs = 0;
  for (const [a, b] of opposingPairs) {
    if (colorDistance(edgeGroupColors[a], edgeGroupColors[b]) > 58) {
      strongOpposingPairs += 1;
    }
  }

  const treePixels = countTreeLikePixels(data, width, height);

  if (centerDarkRatio > 0.35 && edgeCenterDistance > 40) {
    return 'framed';
  }

  if (outerGreenRatio > 0.45 && !innerIsGrass && outerInnerDistance > 30) {
    return 'islet';
  }

  if (edgeGreenRatio > 0.5 && !centerIsGrass && edgeCenterDistance > 30) {
    return 'islet';
  }

  const edgeIsFrame = isFrameBrown(edgeAvg) || isMarsRed(edgeAvg);
  const centerIsFrame = isFrameBrown(centerAvg) || isMarsRed(centerAvg);
  if (edgeIsFrame && !centerIsFrame && edgeCenterDistance > 25) {
    return 'framed';
  }

  if (isStoneGrey(edgeAvg) && !isStoneGrey(centerAvg) && edgeCenterDistance > 28 && edgeVariance < 500) {
    return 'islet';
  }

  if (treePixels > 50) {
    return 'prop';
  }

  if (edgeCenterDistance < 36 && centerVariance > 850 && treePixels > 25) {
    return 'prop';
  }

  if (edgeCenterDistance < 38 && maxEdgeSpread < 50 && centerVariance < 1100 && treePixels < 45) {
    return 'fill';
  }

  if (strongOpposingPairs >= 2 && edgeCenterDistance > 30) {
    return 'transition';
  }

  if (edgeCenterDistance > 36 && edgeGreenRatio < 0.35) {
    return 'framed';
  }

  if (width < 100 || height < 115) {
    return 'miniature';
  }

  return 'unknown';
}

/**
 * @param {string} biome e.g. Grass, Sand
 * @param {string} fileName e.g. grass_06.png
 */
export function parseKenneyTerrainMeta(biome, fileName) {
  const stem = fileName.replace(/\.png$/i, '');
  const prefix = stem.split('_')[0] ?? stem;
  return {
    biome,
    stem,
    prefix,
    frame: fileName.endsWith('.png') ? fileName : `${fileName}.png`,
  };
}

/** Preferred fill tile per biome (verified visually). All biomes are curated — see *TileCatalog.js */
export const KENNEY_FILL_PREFERENCES = Object.freeze({
  Sand: ['sand_02', 'sand_07', 'sand_06'],
  Dirt: ['dirt_06', 'dirt_04'],
  Stone: ['stone_02', 'stone_14', 'stone_07'],
  DarkDirt: ['mars_06', 'mars_07'],
});

/**
 * Pick default fill tile per biome for gameplay terrain keys.
 * @param {ReadonlyArray<{ biome: string, stem: string, frame: string, role: KenneyTileRole }>} entries
 */
export function pickDefaultFillFrames(entries) {
  const fillByBiome = new Map();
  for (const entry of entries) {
    if (entry.role !== 'fill') continue;
    const list = fillByBiome.get(entry.biome) ?? [];
    list.push(entry);
    fillByBiome.set(entry.biome, list);
  }

  const pickBiome = (biome) => {
    const list = fillByBiome.get(biome) ?? [];
    const preferred = KENNEY_FILL_PREFERENCES[biome] ?? [];
    for (const stem of preferred) {
      const hit = list.find((item) => item.stem === stem);
      if (hit) return hit.frame;
    }
    const sorted = [...list].sort((a, b) => a.stem.localeCompare(b.stem));
    return sorted[0]?.frame ?? null;
  };

  return {
    coast: pickBiome('Sand'),
    desert: pickBiome('DarkDirt'),
    hill: pickBiome('Dirt'),
    mountain: pickBiome('Stone'),
  };
}
