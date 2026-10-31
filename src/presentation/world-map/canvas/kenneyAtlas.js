/**
 * A Kenney hexagon spritesheet: its picture, and the rectangles its XML file (Starling format) gives to each frame name.
 *
 * @typedef {{ x: number, y: number, width: number, height: number }} AtlasFrame
 * @typedef {{ image: HTMLImageElement, frames: Map<string, AtlasFrame> }} LoadedAtlas
 */

/**
 * @param {string} xmlText
 * @param {string} source where it came from, for the error
 * @returns {Map<string, AtlasFrame>}
 */
export function parseStarlingFrames(xmlText, source) {
  const document = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (document.querySelector('parsererror')) throw new Error(`[world-map] the atlas ${source} is not valid XML`);
  const frames = new Map();
  for (const node of document.querySelectorAll('SubTexture')) {
    const name = node.getAttribute('name');
    const frame = {
      x: Number(node.getAttribute('x')),
      y: Number(node.getAttribute('y')),
      width: Number(node.getAttribute('width')),
      height: Number(node.getAttribute('height')),
    };
    if (!name || Object.values(frame).some((value) => !Number.isFinite(value))) {
      throw new Error(`[world-map] the atlas ${source} has a SubTexture with no name or a size that is not a number`);
    }
    frames.set(name, frame);
  }
  if (frames.size === 0) throw new Error(`[world-map] the atlas ${source} names no frame`);
  return frames;
}

/** @param {string} url @returns {Promise<HTMLImageElement>} */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`[world-map] the spritesheet ${url} did not load`));
    image.src = url;
  });
}

/** @param {string} url @returns {Promise<string>} */
async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`[world-map] the atlas ${url} did not load (${response.status})`);
  return response.text();
}

/**
 * @param {{ textureUrl: string, atlasUrl: string }} atlas
 * @returns {Promise<LoadedAtlas>}
 */
export async function loadKenneyAtlas(atlas) {
  const [image, xml] = await Promise.all([loadImage(atlas.textureUrl), fetchText(atlas.atlasUrl)]);
  return { image, frames: parseStarlingFrames(xml, atlas.atlasUrl) };
}
