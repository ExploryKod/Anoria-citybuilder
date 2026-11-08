/**
 * SVG pie chart for hub storage — real occupation of total capacity.
 */

import { buildingName } from '../../../shell/CatalogVocabulary.js';
import { html } from '../../../shell/safeHtml.js';

/** What the hub cannot attribute (goods that arrived before it kept track): said as it is, not named. */
const UNKNOWN_ORIGIN = 'Origine inconnue';

/**
 * The name of who delivered a part of a good: the producer type as the catalog names it, and — when the goods were
 * moved from another hub — the hub type they came through ("Champ d'oliviers – Entrepôt").
 */
const originLabel = ({ producerName, producerType, via }) => {
  // A trade city that sent the goods is named; a building that made them is named by its catalog type.
  const made = producerName ? producerName : producerType === '' ? UNKNOWN_ORIGIN : buildingName(producerType);
  return via ? `${made} – ${buildingName(via)}` : made;
};

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} startDeg
 * @param {number} endDeg
 */
function wedgePath(cx, cy, r, startDeg, endDeg) {
  const sweep = endDeg - startDeg;
  if (sweep <= 0.01) return '';
  if (sweep >= 359.99) {
    endDeg = startDeg + 359.99;
  }

  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startDeg));
  const y1 = cy + r * Math.sin(toRad(startDeg));
  const x2 = cx + r * Math.cos(toRad(endDeg));
  const y2 = cy + r * Math.sin(toRad(endDeg));
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;

  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
}

/**
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {number} midDeg
 */
function labelPoint(cx, cy, r, midDeg) {
  const toRad = (deg) => ((deg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(toRad(midDeg)),
    y: cy + r * Math.sin(toRad(midDeg)),
  };
}

/**
 * Under a good, who delivered each part of it, each with the tone it has on the chart. Said whenever the hub
 * knows more than "unknown".
 * @param {object} seg
 */
function originLines(seg) {
  const parts = (seg.parts ?? []).filter((part) => part.amount > 0);
  if (parts.length === 0 || (parts.length === 1 && parts[0].producerType === '' && !parts[0].producerName && !parts[0].via)) return html``;
  return html`${parts
    .map(
      (part) => html`
        <div class="hub-pie-legend-item hub-pie-legend-item--origin" data-product="${seg.productId}">
          <span class="hub-pie-legend-swatch"><span class="hub-pie-legend-swatch-dark" style="background:${part.color}"></span></span>
          <span class="hub-pie-legend-text">↳ ${originLabel(part)} — ${part.amount}</span>
        </div>`
    )}`;
}

/**
 * @param {object} view
 * @param {ReadonlyArray<string>} [summaryLines] Short lines under the pie (capacity, autonomy, ...)
 */
export function renderHubStoragePieChart(view, summaryLines = []) {
  const segments = view.pieSegments ?? [];
  if (segments.length === 0) return html``;

  const cx = 100;
  const cy = 100;
  const r = 88;
  const labelR = 58;

  const wedges = segments
    .flatMap((seg) => {
      const parts = [];
      let cursor = seg.startAngle;

      if (seg.kind === 'elsewhere') {
        parts.push(
          html`<path class="hub-pie-wedge hub-pie-wedge--elsewhere" d="${wedgePath(cx, cy, r, cursor, cursor + seg.idleAngle)}" fill="${seg.colors.dark}" data-product="${seg.productId}" />`
        );
        return parts;
      }

      if (seg.kind === 'free') {
        const idle = seg.idleAngle ?? seg.segmentAngle ?? 0;
        if (idle > 0.01) {
          parts.push(
            html`<path class="hub-pie-wedge hub-pie-wedge--free" d="${wedgePath(cx, cy, r, cursor, cursor + idle)}" fill="#eceff1" data-product="__free__" />`
          );
        }
        return parts;
      }

      if (seg.darkAngle > 0.01) {
        // One wedge per producer type that delivered it, in its own tone of the good's colour.
        const pieces = seg.parts?.length ? seg.parts : [{ startAngle: cursor, angle: seg.darkAngle, color: seg.colors.dark }];
        for (const piece of pieces) {
          if (piece.angle <= 0.01) continue;
          parts.push(
            html`<path class="hub-pie-wedge hub-pie-wedge--dark" d="${wedgePath(cx, cy, r, piece.startAngle, piece.startAngle + piece.angle)}" fill="${piece.color}" data-product="${seg.productId}" />`
          );
        }
        cursor += seg.darkAngle;
      }

      const paleStart = seg.paleStartAngle ?? cursor;
      if (seg.paleAngle > 0.01) {
        parts.push(
          html`<path class="hub-pie-wedge hub-pie-wedge--pale" d="${wedgePath(cx, cy, r, paleStart, paleStart + seg.paleAngle)}" fill="${seg.colors.pale}" data-product="${seg.productId}" />`
        );
      }

      return parts;
    });

  const labels = segments
    .filter((seg) => seg.kind === 'product' && (seg.darkAngle > 12 || seg.segmentAngle > 18))
    .map((seg) => {
      const mid = seg.startAngle + Math.max(seg.darkAngle, seg.segmentAngle) / 2;
      const { x, y } = labelPoint(cx, cy, labelR, mid);
      return html`
        <text class="hub-pie-label" x="${x}" y="${y - 4}" text-anchor="middle">${seg.emoji}</text>
        <text class="hub-pie-qty" x="${x}" y="${y + 10}" text-anchor="middle">${seg.amount}</text>
      `;
    });

  const legend = segments
    .filter((seg) => seg.kind !== 'free')
    .map((seg) => {
      if (seg.kind === 'elsewhere') {
        return html`
        <div class="hub-pie-legend-item hub-pie-legend-item--elsewhere" data-product="${seg.productId}">
          <span class="hub-pie-legend-swatch"><span class="hub-pie-legend-swatch-dark" style="background:${seg.colors.dark}"></span></span>
          <span class="hub-pie-legend-text">${seg.label} — ${seg.amount}</span>
        </div>`;
      }
      const overClass = seg.overMax ? ' hub-pie-legend-item--over' : '';
      return html`
        <div class="hub-pie-legend-item${overClass}" data-product="${seg.productId}">
          <span class="hub-pie-legend-swatch">
            <span class="hub-pie-legend-swatch-dark" style="background:${seg.colors.dark}"></span>
            <span class="hub-pie-legend-swatch-pale" style="background:${seg.colors.pale}"></span>
          </span>
          <span class="hub-pie-legend-emoji">${seg.emoji}</span>
          <span class="hub-pie-legend-text">${seg.label} — ${seg.amount}</span>
        </div>
        ${originLines(seg)}
      `;
    });

  return html`
    <div class="hub-pie-chart">
      <figure class="hub-pie-figure">
        <svg class="hub-pie-svg" viewBox="0 0 200 200" role="img" aria-label="Occupation de l'entrepôt">
          <circle cx="${cx}" cy="${cy}" r="${r + 1}" fill="#fff" stroke="#dee2e6" stroke-width="1" />
          ${wedges}
          ${labels}
        </svg>
      </figure>
      <div class="hub-pie-details">
        <div class="hub-pie-legend">${legend}</div>
        <p class="hub-pie-caption">${summaryLines.map((line) => html`<span class="hub-pie-summary-line">${line}</span>`)}</p>
      </div>
    </div>
  `;
}

/**
 * Replace pie chart DOM in place (no full modal reload).
 *
 * @param {HTMLElement} root
 * @param {object} view
 * @param {ReadonlyArray<string>} [summaryLines]
 * @param {string} [titleText] Replaces the chart's title (the flow it now draws).
 */
export function patchHubStoragePieChart(root, view, summaryLines = [], titleText = null, noteText = null) {
  const section = root.querySelector('.hub-storage-chart-section');
  if (!section) return;
  const title = section.querySelector('.hub-storage-chart-title');
  if (title && titleText) title.textContent = titleText;
  // The title node is kept (or made), as a node: its markup is never read back as a string.
  let titleNode = title;
  if (!titleNode) {
    titleNode = document.createElement('h3');
    titleNode.className = 'hub-storage-chart-title';
    titleNode.textContent = titleText ?? 'Stock';
  }
  // The note the catalog gives the flow (null: none), kept under the title each time the chart is redrawn.
  const chart = document.createElement('div');
  chart.innerHTML = html`${noteText ? html`<p class="hub-storage-chart-note">${noteText}</p>` : ''}${renderHubStoragePieChart(view, summaryLines)}`;
  section.replaceChildren(titleNode, ...chart.childNodes);
}
